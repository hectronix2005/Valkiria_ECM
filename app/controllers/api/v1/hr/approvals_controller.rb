# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Approvals management for supervisors and HR staff
      # rubocop:disable Metrics/ClassLength
      class ApprovalsController < BaseController
        before_action :ensure_approver_access
        before_action :set_approvable, only: [:show, :approve, :reject, :download_document, :sign_document]

        # GET /api/v1/hr/approvals
        # Params: status=pending (default) or status=history
        def index
          if params[:status] == "history"
            @approvals = fetch_history_approvals
            render json: {
              data: {
                vacation_requests: @approvals[:vacations].map { |v| vacation_json(v) },
                certification_requests: @approvals[:certifications].map { |c| certification_json(c) }
              },
              meta: {
                total: @approvals[:vacations].count + @approvals[:certifications].count
              }
            }
          else
            @approvals = fetch_pending_approvals
            render json: {
              data: {
                vacation_requests: @approvals[:vacations].map { |v| vacation_json(v) },
                certification_requests: @approvals[:certifications].map { |c| certification_json(c) }
              },
              meta: {
                total_pending: @approvals[:vacations].count + @approvals[:certifications].count
              }
            }
          end
        end

        # GET /api/v1/hr/approvals/:id
        def show
          render json: { data: approvable_json(@approvable, detailed: true) }
        end

        # POST /api/v1/hr/approvals/:id/approve
        def approve
          case @approvable
          when ::Hr::VacationRequest
            @approvable.approve!(actor: current_employee, reason: params[:reason])
            NotificationService.vacation_approved(@approvable)
          when ::Hr::EmploymentCertificationRequest
            # Certifications need to go through processing first
            @approvable.start_processing!(actor: current_employee) if @approvable.pending?
            @approvable.complete!(actor: current_employee, document_uuid: params[:document_uuid] || @approvable.document_uuid || SecureRandom.uuid)
            NotificationService.certification_completed(@approvable)
          end

          render json: {
            data: approvable_json(@approvable),
            message: "Request approved successfully"
          }
        rescue StandardError => e
          handle_approval_error(e)
        end

        # POST /api/v1/hr/approvals/:id/reject
        def reject
          return render_missing_reason if params[:reason].blank?

          @approvable.reject!(actor: current_employee, reason: params[:reason])

          case @approvable
          when ::Hr::VacationRequest
            NotificationService.vacation_rejected(@approvable)
          when ::Hr::EmploymentCertificationRequest
            NotificationService.certification_rejected(@approvable)
          end

          render json: {
            data: approvable_json(@approvable),
            message: "Request rejected"
          }
        rescue StandardError => e
          handle_approval_error(e)
        end

        # GET /api/v1/hr/approvals/:id/download_document
        def download_document
          unless @approvable.document_uuid
            return render json: { error: "No hay documento generado" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.where(uuid: @approvable.document_uuid).first
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          pdf_content = generated_doc.file_content
          unless pdf_content
            return render json: { error: "Archivo PDF no encontrado" }, status: :not_found
          end

          filename = case @approvable
                     when ::Hr::VacationRequest
                       "solicitud_vacaciones_#{@approvable.request_number}.pdf"
                     when ::Hr::EmploymentCertificationRequest
                       "certificacion_#{@approvable.request_number}.pdf"
                     else
                       "documento_#{@approvable.request_number}.pdf"
                     end

          send_data pdf_content,
                    type: "application/pdf",
                    filename: filename,
                    disposition: "inline"
        end

        # POST /api/v1/hr/approvals/:id/sign_document
        def sign_document
          unless @approvable.document_uuid
            return render json: { error: "No hay documento para firmar" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.where(uuid: @approvable.document_uuid).first
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Get user's digital signature
          signature = current_user.signatures.where(is_default: true).first || current_user.signatures.first
          unless signature
            return render json: {
              error: "No tienes una firma configurada. Ve a tu perfil para crear una.",
              action_required: { type: "configure_signature" }
            }, status: :unprocessable_content
          end

          # Find pending signature using model's role-based matching
          # This allows any HR staff to sign HR slots, any supervisor to sign supervisor slots, etc.
          sig_slot = generated_doc.pending_signature_for(current_user)

          unless sig_slot
            return render json: {
              error: "No tienes firma pendiente en este documento",
              available_signatures: generated_doc.signatures.select { |s| s["signed_at"].blank? }.map { |s| s["label"] }
            }, status: :unprocessable_content
          end

          # Sign the document using the standard method (which respects signature order)
          generated_doc.sign!(user: current_user, signature: signature)

          render json: {
            data: approvable_json(@approvable, detailed: true),
            message: "Documento firmado exitosamente como #{sig_slot['label']}"
          }
        rescue ::Templates::GeneratedDocument::SignatureError => e
          render json: { error: e.message }, status: :unprocessable_content
        rescue StandardError => e
          Rails.logger.error("Error signing approval document: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: { error: "Error al firmar: #{e.message}" }, status: :unprocessable_content
        end

        private

        def ensure_approver_access
          return if current_employee.hr_staff? || current_employee.hr_manager? || current_employee.supervisor?

          render json: { error: "Access denied. Approver privileges required." }, status: :forbidden
        end

        def set_approvable
          @approvable = find_approvable(params[:id])

          return if @approvable

          render json: { error: "Request not found" }, status: :not_found
        end

        def find_approvable(uuid)
          ::Hr::VacationRequest.where(uuid: uuid).first ||
            ::Hr::EmploymentCertificationRequest.where(uuid: uuid).first
        end

        def fetch_pending_approvals
          {
            vacations: pending_vacations_scope,
            certifications: pending_certifications_scope
          }
        end

        def fetch_history_approvals
          {
            vacations: history_vacations_scope,
            certifications: history_certifications_scope
          }
        end

        def pending_vacations_scope
          base_scope(::Hr::VacationRequest).pending.order(submitted_at: :asc)
        end

        def pending_certifications_scope
          # Include both pending and processing (with document awaiting signatures)
          base_scope(::Hr::EmploymentCertificationRequest)
            .where(:status.in => %w[pending processing])
            .order(submitted_at: :asc)
        end

        def history_vacations_scope
          base_scope(::Hr::VacationRequest)
            .where(:status.in => %w[approved rejected cancelled])
            .order(decided_at: :desc)
            .limit(50)
        end

        def history_certifications_scope
          base_scope(::Hr::EmploymentCertificationRequest)
            .where(:status.in => %w[completed rejected cancelled])
            .order(completed_at: :desc)
            .limit(50)
        end

        def base_scope(klass)
          if current_employee.hr_staff? || current_employee.hr_manager?
            klass.where(organization_id: current_organization.id)
          else
            klass.where(:employee_id.in => current_employee.subordinates.pluck(:id))
          end
        end

        def approvable_json(record, detailed: false)
          case record
          when ::Hr::VacationRequest
            vacation_json(record, detailed: detailed)
          when ::Hr::EmploymentCertificationRequest
            certification_json(record, detailed: detailed)
          end
        end

        def vacation_json(vacation, detailed: false)
          # Check document status
          doc = vacation.document_uuid.present? ? ::Templates::GeneratedDocument.where(uuid: vacation.document_uuid).first : nil
          pdf_ready = doc && !doc.pending_pdf? && doc.draft_file_id.present?

          json = {
            id: vacation.uuid,
            type: "vacation_request",
            request_number: vacation.request_number,
            vacation_type: vacation.vacation_type,
            start_date: vacation.start_date&.iso8601,
            end_date: vacation.end_date&.iso8601,
            days_requested: vacation.days_requested,
            status: vacation.effective_status,
            status_label: vacation.effective_status_label,
            submitted_at: vacation.submitted_at&.iso8601,
            employee: employee_summary(vacation.employee),
            has_document: vacation.document_uuid.present?,
            document_uuid: vacation.document_uuid,
            pdf_ready: pdf_ready,
            can_sign: doc ? doc.pending_signature_for(current_user).present? : false
          }

          if detailed
            json.merge!(
              reason: vacation.reason,
              notes: vacation.notes,
              history: vacation.history,
              document: doc ? document_info(doc) : nil
            )
          end

          json
        end

        def document_info(doc)
          {
            uuid: doc.uuid,
            name: doc.name,
            status: doc.status,
            pdf_ready: !doc.pending_pdf? && doc.draft_file_id.present?,
            signatures: doc.signatures.map do |sig|
              {
                signatory_type_code: sig["signatory_type_code"],
                label: sig["label"],
                position: sig["position"],
                signed: sig["signed_at"].present?,
                signed_at: sig["signed_at"],
                signed_by_name: sig["signed_by_name"],
                required: sig["required"]
              }
            end
          }
        end

        def certification_json(certification, detailed: false)
          # Check document status
          doc = certification.document_uuid.present? ? ::Templates::GeneratedDocument.where(uuid: certification.document_uuid).first : nil
          pdf_ready = doc && !doc.pending_pdf? && doc.draft_file_id.present?

          json = {
            id: certification.uuid,
            type: "certification_request",
            request_number: certification.request_number,
            certification_type: certification.certification_type,
            purpose: certification.purpose,
            status: certification.status,
            estimated_days: certification.estimated_days,
            submitted_at: certification.submitted_at&.iso8601,
            employee: employee_summary(certification.employee),
            has_document: certification.document_uuid.present?,
            document_uuid: certification.document_uuid,
            pdf_ready: pdf_ready,
            can_sign: doc ? doc.pending_signature_for(current_user).present? : false
          }

          if detailed
            json.merge!(
              language: certification.language,
              include_salary: certification.include_salary,
              include_position: certification.include_position,
              additional_info: certification.special_instructions,
              document: doc ? document_info(doc) : nil
            )
          end

          json
        end

        def employee_summary(employee)
          return nil unless employee

          {
            id: employee.uuid,
            name: employee.full_name,
            department: employee.department,
            job_title: employee.job_title,
            available_vacation_days: employee.available_vacation_days
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

        def render_missing_reason
          render json: { error: "Rejection reason is required" }, status: :unprocessable_content
        end

        def handle_approval_error(error)
          Rails.logger.error "Approval error: #{error.class} - #{error.message}"
          Rails.logger.error error.backtrace.first(10).join("\n")

          status = error_status_for(error)

          if status
            render json: { error: error.message }, status: status
          else
            render json: { error: "Error processing approval: #{error.message}" }, status: :internal_server_error
          end
        end

        def error_status_for(error)
          case error
          when ::Hr::VacationRequest::InvalidStateError,
               ::Hr::EmploymentCertificationRequest::InvalidStateError,
               ::Hr::VacationRequest::ValidationError,
               ::Hr::EmploymentCertificationRequest::ValidationError,
               ::Hr::Employee::InsufficientBalanceError,
               Mongoid::Errors::Validations
            :unprocessable_content
          when ::Hr::VacationRequest::AuthorizationError,
               ::Hr::EmploymentCertificationRequest::AuthorizationError
            :forbidden
          end
        end
      end
      # rubocop:enable Metrics/ClassLength
    end
  end
end
