# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Vacation requests management for employees
      class VacationsController < BaseController
        before_action :set_vacation, only: [:show, :update, :destroy, :submit, :cancel, :generate_document, :download_document, :sign_document]

        # GET /api/v1/hr/vacations
        def index
          # Auto-marcar vacaciones pasadas como disfrutadas
          current_employee.vacation_requests.approved.where(:end_date.lt => Date.current).each do |v|
            v.mark_as_enjoyed!
          rescue ::Hr::VacationRequest::InvalidStateError
            next
          end

          @vacations = policy_scope(::Hr::VacationRequest)
            .order(created_at: :desc)

          @vacations = apply_filters(@vacations)
          @vacations = paginate(@vacations)

          render json: {
            data: @vacations.map { |v| vacation_json(v) },
            meta: pagination_meta(@vacations).merge(vacation_balance: vacation_balance_json)
          }
        end

        # GET /api/v1/hr/vacations/:id
        def show
          authorize @vacation

          render json: { data: vacation_json(@vacation, detailed: true), document: document_info }
        end

        # POST /api/v1/hr/vacations
        def create
          @vacation = ::Hr::VacationRequest.new(vacation_params)
          @vacation.employee = current_employee
          @vacation.organization = current_organization

          authorize @vacation

          if @vacation.save
            # Auto-generate document immediately after creation
            generate_vacation_document_if_available

            render json: {
              data: vacation_json(@vacation, detailed: true),
              document: @vacation.document_uuid ? document_info : nil
            }, status: :created
          else
            render json: { errors: @vacation.errors.full_messages }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/hr/vacations/:id
        def update
          authorize @vacation

          unless @vacation.draft?
            return render json: { error: "Can only update draft requests" }, status: :unprocessable_content
          end

          if @vacation.update(vacation_params)
            render json: { data: vacation_json(@vacation) }
          else
            render json: { errors: @vacation.errors.full_messages }, status: :unprocessable_content
          end
        end

        # POST /api/v1/hr/vacations/:id/submit
        def submit
          authorize @vacation, :submit?

          # Verify employee has signed the document (only if PDF is ready)
          if @vacation.document_uuid
            doc = ::Templates::GeneratedDocument.find_by(uuid: @vacation.document_uuid)
            # Only require signature if PDF is available (not pending)
            pdf_ready = doc && !doc.pending_pdf? && doc.draft_file_id.present?
            if pdf_ready && !employee_has_signed?(doc)
              return render json: {
                error: "Debes firmar el documento antes de enviar la solicitud"
              }, status: :unprocessable_content
            end
          end

          @vacation.submit!(actor: current_employee)

          render json: {
            data: vacation_json(@vacation, detailed: true),
            message: "Solicitud de vacaciones enviada para aprobación"
          }
        rescue ::Hr::VacationRequest::InvalidStateError,
               ::Hr::VacationRequest::ValidationError => e
          render json: { error: e.message }, status: :unprocessable_content
        end

        # POST /api/v1/hr/vacations/:id/sign_document
        def sign_document
          authorize @vacation, :show?

          unless @vacation.document_uuid
            return render json: { error: "No hay documento para firmar" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.find_by(uuid: @vacation.document_uuid)
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Get user's signature (use where().first to avoid Mongoid::Errors::DocumentNotFound)
          signature = current_user.signatures.where(is_default: true).first || current_user.signatures.first
          unless signature
            return render json: { error: "No tienes una firma configurada. Ve a tu perfil para crear una." }, status: :unprocessable_content
          end

          # Find the employee signatory slot
          employee_sig = generated_doc.signatures.find { |s| s["signatory_type_code"] == "employee" }
          unless employee_sig
            return render json: { error: "No hay espacio de firma para empleado en este documento" }, status: :unprocessable_content
          end

          if employee_sig["signed_at"].present?
            return render json: { error: "Ya has firmado este documento" }, status: :unprocessable_content
          end

          # Sign the document
          generated_doc.sign!(user: current_user, signature: signature)

          render json: {
            data: vacation_json(@vacation, detailed: true),
            document: document_info,
            message: "Documento firmado exitosamente"
          }
        rescue StandardError => e
          Rails.logger.error("Error signing vacation document: #{e.message}")
          render json: { error: "Error al firmar: #{e.message}" }, status: :unprocessable_content
        end

        # POST /api/v1/hr/vacations/:id/cancel
        def cancel
          authorize @vacation, :cancel?

          @vacation.cancel!(actor: current_employee, reason: params[:reason])

          render json: {
            data: vacation_json(@vacation),
            message: "Vacation request cancelled"
          }
        rescue ::Hr::VacationRequest::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_content
        rescue ::Hr::VacationRequest::AuthorizationError => e
          render json: { error: e.message }, status: :forbidden
        end

        # DELETE /api/v1/hr/vacations/:id
        def destroy
          authorize @vacation, :destroy?

          # Check if vacation can be deleted
          unless can_delete_vacation?
            return render json: {
              error: "No puedes eliminar esta solicitud. Solo se pueden eliminar solicitudes que no hayan sido firmadas o autorizadas por otros."
            }, status: :forbidden
          end

          # Delete associated document if exists
          if @vacation.document_uuid
            doc = ::Templates::GeneratedDocument.find_by(uuid: @vacation.document_uuid)
            doc&.destroy
          end

          @vacation.destroy

          render json: { message: "Solicitud de vacaciones eliminada exitosamente" }
        end

        # POST /api/v1/hr/vacations/:id/generate_document
        def generate_document
          authorize @vacation, :show?

          # Find vacation template
          template = find_vacation_template
          unless template
            return render json: {
              error: "No hay template activo para solicitud de vacaciones"
            }, status: :not_found
          end

          # Build context for variable resolution
          context = {
            employee: @vacation.employee,
            organization: current_organization,
            request: @vacation
          }

          # Generate document
          generator = ::Templates::RobustDocumentGeneratorService.new(template, context)
          generated_doc = generator.generate!

          # Link document to vacation request
          @vacation.update!(document_uuid: generated_doc.uuid)

          render json: {
            data: vacation_json(@vacation, detailed: true),
            document: generated_document_json(generated_doc),
            message: "Documento generado exitosamente"
          }
        rescue StandardError => e
          Rails.logger.error("Error generating vacation document: #{e.message}")
          render json: { error: "Error al generar documento: #{e.message}" }, status: :unprocessable_content
        end

        # GET /api/v1/hr/vacations/:id/download_document
        def download_document
          authorize @vacation, :show?

          unless @vacation.document_uuid
            return render json: { error: "No hay documento generado" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.find_by(uuid: @vacation.document_uuid)
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Get PDF content from GridFS
          pdf_content = generated_doc.file_content
          unless pdf_content
            return render json: { error: "Archivo PDF no encontrado" }, status: :not_found
          end

          send_data pdf_content,
                    type: "application/pdf",
                    filename: "solicitud_vacaciones_#{@vacation.request_number}.pdf",
                    disposition: "inline"
        end

        private

        def set_vacation
          @vacation = ::Hr::VacationRequest.find_by!(uuid: params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "Vacation request not found" }, status: :not_found
        end

        def vacation_params
          params.require(:vacation).permit(
            :vacation_type,
            :start_date,
            :end_date,
            :days_requested,
            :reason,
            :notes
          )
        end

        def apply_filters(scope) # rubocop:disable Metrics/AbcSize
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(vacation_type: params[:type]) if params[:type].present?
          scope = scope.where(:start_date.gte => params[:from]) if params[:from].present?
          scope = scope.where(:end_date.lte => params[:to]) if params[:to].present?
          scope
        end

        def vacation_json(vacation, detailed: false) # rubocop:disable Metrics/MethodLength
          # Check if document exists and needs employee signature
          needs_signature = false
          pdf_ready = false
          if vacation.document_uuid.present?
            doc = ::Templates::GeneratedDocument.find_by(uuid: vacation.document_uuid)
            needs_signature = doc && !employee_has_signed?(doc)
            pdf_ready = doc && !doc.pending_pdf? && doc.draft_file_id.present?
          end

          json = {
            id: vacation.uuid,
            request_number: vacation.request_number,
            vacation_type: vacation.vacation_type,
            start_date: vacation.start_date&.iso8601,
            end_date: vacation.end_date&.iso8601,
            days_requested: vacation.days_requested,
            status: vacation.status,
            status_label: vacation.status_label,
            submitted_at: vacation.submitted_at&.iso8601,
            created_at: vacation.created_at.iso8601,
            has_document: vacation.document_uuid.present?,
            pdf_ready: pdf_ready,
            needs_employee_signature: needs_signature,
            can_delete: can_delete_for_user?(vacation)
          }

          if detailed
            json.merge!(
              reason: vacation.reason,
              notes: vacation.notes,
              decided_at: vacation.decided_at&.iso8601,
              decision_reason: vacation.decision_reason,
              approved_by_name: vacation.approved_by_name,
              approver: vacation.approver ? employee_summary(vacation.approver) : nil,
              document_uuid: vacation.document_uuid,
              history: vacation.history
            )
          end

          json
        end

        def employee_summary(employee)
          {
            id: employee.uuid,
            name: employee.full_name,
            email: employee.user&.email
          }
        end

        def vacation_balance_json
          emp = current_employee
          {
            accrued: emp.accrued_vacation_days,
            scheduled: emp.scheduled_vacation_days,
            enjoyed: emp.enjoyed_vacation_days,
            total_used: emp.total_used_vacation_days,
            available: emp.available_vacation_days
          }
        end

        def current_employee
          @current_employee ||= ::Hr::Employee.for_user(current_user) ||
            ::Hr::Employee.create!(
              user: current_user,
              organization: current_organization,
              job_title: current_user.title,
              department: current_user.department,
              hire_date: Date.current,
              vacation_balance_days: 15.0
            )
        end

        def find_vacation_template
          # Search for vacation template (hr module, vacation category)
          ::Templates::Template.where(
            organization_id: current_organization.id,
            module_type: "hr",
            category: "vacation",
            status: "active"
          ).first
        end

        def generate_vacation_document_if_available
          template = find_vacation_template
          Rails.logger.info "=== Vacation Document Generation ==="
          Rails.logger.info "Looking for template with: module_type=hr, category=vacaciones, org=#{current_organization.id}"
          Rails.logger.info "Template found: #{template&.name || 'NONE'}"
          return unless template

          context = {
            employee: @vacation.employee,
            organization: current_organization,
            request: @vacation,
            user: current_user
          }

          generator = ::Templates::RobustDocumentGeneratorService.new(template, context)
          generated_doc = generator.generate!

          @vacation.update!(document_uuid: generated_doc.uuid)
        rescue StandardError => e
          # Log but don't fail the submit if document generation fails
          Rails.logger.error("Error auto-generating vacation document: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
        end

        def generated_document_json(doc)
          {
            uuid: doc.uuid,
            name: doc.name,
            status: doc.status,
            has_pdf: doc.draft_file_id.present? || doc.final_file_id.present?,
            created_at: doc.created_at.iso8601
          }
        end

        def document_info
          return nil unless @vacation.document_uuid

          doc = ::Templates::GeneratedDocument.find_by(uuid: @vacation.document_uuid)
          return nil unless doc

          {
            uuid: doc.uuid,
            name: doc.name,
            status: doc.status,
            has_pdf: doc.draft_file_id.present? || doc.final_file_id.present?,
            employee_signed: employee_has_signed?(doc),
            signatures: doc.signatures.map do |sig|
              {
                signatory_type_code: sig["signatory_type_code"],
                label: sig["label"],
                signed: sig["signed_at"].present?,
                signed_at: sig["signed_at"],
                signed_by: sig["signed_by_name"]
              }
            end
          }
        end

        def employee_has_signed?(doc)
          employee_sig = doc.signatures.find { |s| s["signatory_type_code"] == "employee" }
          employee_sig && employee_sig["signed_at"].present?
        end

        # Check if vacation can be deleted (for action)
        # Admin/HR can delete any request, owner has restrictions
        def can_delete_vacation?
          can_delete_for_user?(@vacation)
        end

        # Check if current user can delete this vacation (for JSON response)
        def can_delete_for_user?(vacation)
          # Admin and HR can delete any vacation
          return true if current_user.admin? || current_employee&.hr_manager?

          can_delete_vacation_for?(vacation)
        end

        def can_delete_vacation_for?(vacation)
          # For owner: check restrictions
          return false unless vacation.employee_id == current_employee&.id

          # Cannot delete if already approved, enjoyed, or in certain final states
          return false if vacation.approved? || vacation.enjoyed?

          # If there's a document, check that no one else has signed
          if vacation.document_uuid
            doc = ::Templates::GeneratedDocument.find_by(uuid: vacation.document_uuid)
            if doc
              # Check for any signatures from non-employee signatories
              other_signatures = doc.signatures.select do |sig|
                sig["signatory_type_code"] != "employee" && sig["signed_at"].present?
              end
              return false if other_signatures.any?
            end
          end

          true
        end
      end
    end
  end
end
