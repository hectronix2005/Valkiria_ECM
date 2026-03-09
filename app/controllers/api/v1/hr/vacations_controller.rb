# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Vacation requests management for employees
      class VacationsController < BaseController
        before_action :set_vacation, only: [:show, :update, :destroy, :submit, :cancel, :generate_document, :download_document, :sign_document]

        # GET /api/v1/hr/vacations
        def index
          # Apply legal cap adjustments and auto-mark enjoyed (only if employee exists)
          if current_employee
            current_employee.apply_legal_cap_adjustments!

            current_employee.vacation_requests.approved.where(:end_date.lte => Date.current).each do |v|
              v.mark_as_enjoyed!
            rescue ::Hr::VacationRequest::InvalidStateError
              next
            end
          end

          @vacations = policy_scope(::Hr::VacationRequest)
            .order(created_at: :desc)

          @vacations = apply_filters(@vacations)
          @vacations = paginate(@vacations)

          # Preload documents to avoid N+1 queries
          doc_uuids = @vacations.map(&:document_uuid).compact
          @preloaded_docs = if doc_uuids.any?
                              ::Templates::GeneratedDocument.where(:uuid.in => doc_uuids).index_by(&:uuid)
                            else
                              {}
                            end

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
          @vacation.employee = current_employee || ::Hr::Employee.find_or_create_for_user!(current_user)
          @vacation.organization = current_organization

          authorize @vacation

          # Pre-validate that we have all required data for the vacation template
          template = find_vacation_template
          if template
            missing_data = validate_vacation_template_data(template)
            if missing_data[:variables].any?
              Rails.logger.warn("Vacation create: missing template data for employee #{current_employee.uuid}: #{missing_data[:variables].map { |v| v[:field] }.join(', ')}")
              return render json: {
                error: "Faltan datos requeridos para generar la solicitud de vacaciones",
                missing_fields: missing_data[:variables].map { |v|
                  {
                    field: v[:field],
                    label: v[:field_label] || v[:field],
                    source: v[:source],
                    variable: v[:variable]
                  }
                },
                employee_id: current_employee.uuid,
                message: build_missing_data_message(missing_data)
              }, status: :unprocessable_content
            end
          end

          save_with_retry(@vacation)

          # Auto-generate document immediately after creation (template already fetched above)
          generate_vacation_document_if_available(template)

          render json: {
            data: vacation_json(@vacation, detailed: true),
            document: @vacation.document_uuid ? document_info : nil
          }, status: :created
        rescue Mongo::Error::OperationFailure => e
          # Should not happen after retry, but handle gracefully
          Rails.logger.error("Vacation create duplicate key after retries: #{e.message}")
          render json: { error: "Error al generar número de solicitud. Intenta de nuevo." }, status: :conflict
        rescue Mongoid::Errors::Validations => e
          Rails.logger.warn("Vacation create failed for employee #{current_employee.uuid}: #{@vacation.errors.full_messages.join(', ')}")
          render json: {
            error: "No se pudo crear la solicitud de vacaciones",
            errors: @vacation.errors.full_messages,
            details: @vacation.errors.messages
          }, status: :unprocessable_content
        rescue ::Hr::VacationRequest::InvalidStateError,
               ::Hr::VacationRequest::ValidationError,
               ::Hr::Employee::InsufficientBalanceError => e
          render json: { error: e.message }, status: :unprocessable_content
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
            doc = ::Templates::GeneratedDocument.where(uuid: @vacation.document_uuid).first
            # Only require signature if PDF is available (not pending)
            pdf_ready = doc&.draft_file_id.present?
            if pdf_ready && !employee_has_signed?(doc)
              return render json: {
                error: "Debes firmar el documento antes de enviar la solicitud"
              }, status: :unprocessable_content
            end
          end

          @vacation.submit!(actor: current_employee)
          NotificationService.vacation_submitted(@vacation)
          NotificationService.notify_document_signers(@vacation, @vacation.status, actor: current_employee)

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
          if employee_mode?
            return render json: { error: "No disponible en modo empleado" }, status: :forbidden
          end
          authorize @vacation, :show?

          unless @vacation.document_uuid
            return render json: { error: "No hay documento para firmar" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.where(uuid: @vacation.document_uuid).first
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Get user's signature (prefer default, then most recently updated)
          signature = current_user.signatures.where(is_default: true).first ||
                      current_user.signatures.where(active: true).order(updated_at: :desc).first
          unless signature
            return render json: {
              error: "No tienes una firma configurada. Ve a tu perfil para crear una.",
              action_required: { type: "configure_signature" }
            }, status: :unprocessable_content
          end

          # Find the next pending signature slot this user can sign
          sig_slot = generated_doc.pending_signature_for(current_user)
          unless sig_slot
            return render json: { error: "No tienes firmas pendientes en este documento" }, status: :unprocessable_content
          end

          if sig_slot["signed_at"].present?
            return render json: { error: "Ya has firmado este documento" }, status: :unprocessable_content
          end

          # Sign the document with the detected signatory type
          generated_doc.sign!(user: current_user, signature: signature, signatory_type_code: sig_slot["signatory_type_code"])

          # Auto-approve vacation when all signatures are complete and request is pending
          auto_approved = false
          if @vacation.pending? && generated_doc.reload.all_required_signed?
            begin
              @vacation.approve!(actor: current_employee, reason: "Aprobada automáticamente al completar todas las firmas")
              NotificationService.vacation_approved(@vacation)
              NotificationService.notify_document_signers(@vacation, @vacation.status, actor: current_employee)
              auto_approved = true
            rescue ::Hr::VacationRequest::InvalidStateError,
                   ::Hr::VacationRequest::AuthorizationError,
                   ::Hr::Employee::InsufficientBalanceError => e
              Rails.logger.warn("Auto-approval failed for #{@vacation.request_number}: #{e.message}")
            end
          end

          @vacation.reload

          render json: {
            data: vacation_json(@vacation, detailed: true),
            document: document_info,
            message: auto_approved ? "Documento firmado y solicitud aprobada exitosamente" : "Documento firmado exitosamente"
          }
        rescue ::Templates::GeneratedDocument::SignatureError,
               Mongoid::Errors::Validations => e
          Rails.logger.error("Error signing vacation document: #{e.message}")
          render json: { error: "Error al firmar: #{e.message}" }, status: :unprocessable_content
        end

        # POST /api/v1/hr/vacations/:id/cancel
        def cancel
          authorize @vacation, :cancel?

          @vacation.cancel!(actor: current_employee, reason: params[:reason])
          NotificationService.notify_document_signers(@vacation, @vacation.status, actor: current_employee)

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
            doc = ::Templates::GeneratedDocument.where(uuid: @vacation.document_uuid).first
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

          # Link document to vacation request (use set to skip model validations)
          @vacation.set(document_uuid: generated_doc.uuid)

          render json: {
            data: vacation_json(@vacation, detailed: true),
            document: generated_document_json(generated_doc),
            message: "Documento generado exitosamente"
          }
        rescue ::Templates::RobustDocumentGeneratorService::GenerationError,
               ::Templates::RobustDocumentGeneratorService::MissingVariablesError,
               ::Templates::DocumentGeneratorService::GenerationError,
               Mongoid::Errors::Validations => e
          Rails.logger.error("Error generating vacation document: #{e.message}")
          render json: { error: "Error al generar documento: #{e.message}" }, status: :unprocessable_content
        end

        # GET /api/v1/hr/vacations/:id/download_document
        def download_document
          authorize @vacation, :show?

          unless @vacation.document_uuid
            return render json: { error: "No hay documento generado" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.where(uuid: @vacation.document_uuid).first
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Get document content from GridFS
          file_content = generated_doc.file_content
          unless file_content
            return render json: { error: "Archivo no encontrado" }, status: :not_found
          end

          # Detect format from file_name extension
          if generated_doc.file_name&.end_with?(".docx")
            send_data file_content,
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      filename: "solicitud_vacaciones_#{@vacation.request_number}.docx",
                      disposition: "inline"
          else
            send_data file_content,
                      type: "application/pdf",
                      filename: "solicitud_vacaciones_#{@vacation.request_number}.pdf",
                      disposition: "inline"
          end
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

        def apply_filters(scope) # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(vacation_type: params[:type]) if params[:type].present?
          scope = scope.where(:start_date.gte => params[:from]) if params[:from].present?
          scope = scope.where(:end_date.lte => params[:to]) if params[:to].present?

          if params[:search].present?
            term = params[:search].strip
            employee_ids = ::Hr::Employee.where(organization: current_organization).any_of(
              { first_name: /#{Regexp.escape(term)}/i },
              { last_name: /#{Regexp.escape(term)}/i },
              { identification_number: /#{Regexp.escape(term)}/i }
            ).pluck(:id)
            scope = scope.in(employee_id: employee_ids)
          end

          scope
        end

        def vacation_json(vacation, detailed: false) # rubocop:disable Metrics/MethodLength
          # Check if document exists and needs signature FROM the current user
          needs_signature = false
          can_sign = false
          pdf_ready = false
          if vacation.document_uuid.present?
            doc = @preloaded_docs&.dig(vacation.document_uuid) ||
                  ::Templates::GeneratedDocument.where(uuid: vacation.document_uuid).first
            needs_signature = doc && current_user_is_employee_signer?(doc) && !employee_has_signed?(doc)
            can_sign = doc&.pending_signature_for(current_user).present?
            pdf_ready = doc&.draft_file_id.present?
          end

          json = {
            id: vacation.uuid,
            request_number: vacation.request_number,
            employee_name: vacation.employee&.full_name,
            employee_identification: vacation.employee&.identification_number,
            vacation_type: vacation.vacation_type,
            start_date: vacation.start_date&.iso8601,
            end_date: vacation.end_date&.iso8601,
            days_requested: vacation.days_requested,
            status: vacation.effective_status,
            status_label: vacation.effective_status_label,
            raw_status: vacation.status,
            submitted_at: vacation.submitted_at&.iso8601,
            created_at: vacation.created_at.iso8601,
            has_document: vacation.document_uuid.present?,
            pdf_ready: pdf_ready,
            needs_employee_signature: needs_signature,
            can_sign: can_sign,
            can_delete: can_delete_for_user?(vacation),
            can_cancel: vacation_cancelable?(vacation)
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
            available: emp.available_vacation_days,
            booked_ranges: booked_date_ranges
          }
        end

        def booked_date_ranges
          current_employee.vacation_requests
            .where(:status.nin => %w[cancelled rejected])
            .pluck(:start_date, :end_date, :request_number)
            .map { |s, e, rn| { start_date: s&.iso8601, end_date: e&.iso8601, request_number: rn } }
        end

        # Save with retry on duplicate request_number (race condition with unique index)
        def save_with_retry(vacation, max_retries: 3)
          retries = 0
          begin
            vacation.save!
          rescue Mongo::Error::OperationFailure => e
            raise unless e.message.include?("E11000") && e.message.include?("request_number")
            raise if (retries += 1) > max_retries

            Rails.logger.warn("Duplicate request_number detected, retrying (#{retries}/#{max_retries})")
            vacation.request_number = nil # Clear to regenerate
            retry
          end
        end

        def find_vacation_template
          # Search for vacation template (hr module, vacation category)
          @vacation_template ||= ::Templates::Template.where(
            organization_id: current_organization.id,
            module_type: "hr",
            category: "vacation",
            status: "active"
          ).first
        end

        # Validate that all required data is available for the vacation template
        def validate_vacation_template_data(template)
          # Build a temporary request context for validation
          temp_request = ::Hr::VacationRequest.new(vacation_params)
          temp_request.employee = current_employee
          temp_request.organization = current_organization

          context = {
            employee: current_employee,
            organization: current_organization,
            request: temp_request,
            user: current_user
          }

          generator = ::Templates::RobustDocumentGeneratorService.new(template, context)
          generator.validate_variables
        end

        def build_missing_data_message(missing_data)
          messages = []

          by_source = missing_data[:variables].group_by { |v| v[:source] }

          if by_source["employee"]&.any?
            fields = by_source["employee"].map { |v| v[:field_label] || v[:field] }.join(", ")
            messages << "Complete los siguientes datos del empleado: #{fields}"
          end

          if by_source["organization"]&.any?
            fields = by_source["organization"].map { |v| v[:field_label] || v[:field] }.join(", ")
            messages << "Faltan datos de la organización: #{fields}. Contacte al administrador."
          end

          messages.join(". ")
        end

        def generate_vacation_document_if_available(template = nil)
          template ||= find_vacation_template
          Rails.logger.info "=== Vacation Document Generation ==="
          Rails.logger.info "Looking for template with: module_type=hr, category=vacation, org=#{current_organization.id}"
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
          @vacation.set(document_uuid: generated_doc.uuid)
        rescue StandardError => e
          # Log but don't fail the create if document generation fails
          Rails.logger.error("Error auto-generating vacation document: #{e.class} - #{e.message}")
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

          doc = ::Templates::GeneratedDocument.where(uuid: @vacation.document_uuid).first
          return nil unless doc

          {
            uuid: doc.uuid,
            name: doc.name,
            status: doc.status,
            has_pdf: doc.draft_file_id.present? || doc.final_file_id.present?,
            pdf_width: doc.template&.pdf_width || 612,
            employee_signed: employee_has_signed?(doc),
            signatures: doc.signatures.map do |sig|
              order_status = doc.signature_with_order_status(sig)
              sig_data = {
                signatory_type_code: sig["signatory_type_code"],
                label: sig["label"],
                user_id: sig["user_id"],
                signed: sig["signed_at"].present?,
                signed_at: sig["signed_at"],
                signed_by: sig["signed_by_name"],
                substituted: sig["substituted"] == true,
                original_user_name: sig["original_user_name"],
                can_sign_now: order_status[:can_sign_now],
                waiting_for: order_status[:waiting_for],
                eligible_users: sig["signed_at"].blank? ? eligible_users_for_signatory_type(sig["signatory_type_code"], doc: doc) : []
              }
              # Include signature image and position for signed entries
              if sig["signed_at"].present? && sig["signature_id"].present?
                user_sig = ::Identity::UserSignature.where(uuid: sig["signature_id"]).first
                sig_data[:signature_image] = user_sig&.to_image_data
              end
              # Include position data from template signatory
              if sig["signatory_id"].present?
                tmpl_sig = doc.template&.signatories&.where(uuid: sig["signatory_id"])&.first
                if tmpl_sig
                  sig_data[:position_box] = {
                    x: tmpl_sig.x_position, y: tmpl_sig.y_position,
                    width: tmpl_sig.width, height: tmpl_sig.height,
                    page: tmpl_sig.page_number
                  }
                end
              end
              sig_data
            end
          }
        end

        def employee_has_signed?(doc)
          employee_sig = doc.signatures.find { |s| s["signatory_type_code"] == "employee" }
          employee_sig && employee_sig["signed_at"].present?
        end

        def current_user_is_employee_signer?(doc)
          employee_sig = doc.signatures.find { |s| s["signatory_type_code"] == "employee" }
          employee_sig && employee_sig["user_id"] == current_user.id.to_s
        end

        # Check if vacation can be deleted (for action)
        # Admin/HR can delete any request, owner has restrictions
        def can_delete_vacation?
          can_delete_for_user?(@vacation)
        end

        # Check if current user can delete this vacation (for JSON response)
        def can_delete_for_user?(vacation)
          # System adjustments can only be deleted by admins
          return current_user.admin? if vacation.system?

          # In employee mode, only allow owner actions
          unless employee_mode?
            # Admin and HR can delete any vacation
            return true if current_user.admin? || current_employee&.hr_manager?
          end

          can_delete_vacation_for?(vacation)
        end

        def vacation_cancelable?(vacation)
          # In employee mode, only allow cancellation as owner (draft/pending only)
          if employee_mode?
            return vacation.employee_id == current_employee&.id &&
              !vacation.rejected? && (vacation.draft? || vacation.pending?)
          end

          policy = ::Hr::VacationRequestPolicy.new(current_user, vacation)
          result = policy.cancel?
          Rails.logger.debug("vacation_cancelable? #{vacation.uuid} status=#{vacation.status} result=#{result} user_admin=#{current_user.admin?}")
          result
        rescue StandardError => e
          Rails.logger.error("vacation_cancelable? error for #{vacation.uuid}: #{e.class} - #{e.message}")
          false
        end

        def can_delete_vacation_for?(vacation)
          # For owner: check restrictions
          return false unless vacation.employee_id == current_employee&.id

          # Cannot delete if already approved, enjoyed, or in certain final states
          return false if vacation.approved? || vacation.enjoyed?

          # If there's a document, check that no one else has signed
          if vacation.document_uuid
            doc = ::Templates::GeneratedDocument.where(uuid: vacation.document_uuid).first
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
