# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Employment certification requests management
      class CertificationsController < BaseController
        before_action :set_certification, only: [:show, :update, :destroy, :cancel, :generate_document, :download_document, :sign_document]

        # GET /api/v1/hr/certifications
        def index
          @certifications = policy_scope(::Hr::EmploymentCertificationRequest)
            .order(created_at: :desc)

          @certifications = apply_filters(@certifications)
          @certifications = paginate(@certifications)

          render json: {
            data: @certifications.map { |c| certification_json(c) },
            meta: pagination_meta(@certifications)
          }
        end

        # GET /api/v1/hr/certifications/:id
        def show
          authorize @certification

          render json: { data: certification_json(@certification, detailed: true) }
        end

        # POST /api/v1/hr/certifications
        def create
          @certification = ::Hr::EmploymentCertificationRequest.new(certification_params)
          @certification.employee = current_employee
          @certification.organization = current_organization

          authorize @certification

          if @certification.save
            render json: { data: certification_json(@certification) }, status: :created
          else
            render json: { errors: @certification.errors.full_messages }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/hr/certifications/:id
        def update
          authorize @certification

          unless @certification.pending?
            return render json: { error: "Can only update pending requests" }, status: :unprocessable_content
          end

          if @certification.update(certification_params)
            render json: { data: certification_json(@certification) }
          else
            render json: { errors: @certification.errors.full_messages }, status: :unprocessable_content
          end
        end

        # POST /api/v1/hr/certifications/:id/cancel
        def cancel
          authorize @certification, :cancel?

          @certification.cancel!(actor: current_employee)

          render json: {
            data: certification_json(@certification),
            message: "Certification request cancelled"
          }
        rescue ::Hr::EmploymentCertificationRequest::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_content
        rescue ::Hr::EmploymentCertificationRequest::AuthorizationError => e
          render json: { error: e.message }, status: :forbidden
        end

        # DELETE /api/v1/hr/certifications/:id
        def destroy
          authorize @certification, :destroy?

          @certification.destroy!

          render json: { message: "Certificación eliminada exitosamente" }
        end

        # POST /api/v1/hr/certifications/:id/generate_document
        def generate_document
          authorize @certification, :generate_document?

          # Find appropriate template
          template = find_template_for_certification
          unless template
            return render json: {
              error: "No hay template activo para este tipo de certificación"
            }, status: :unprocessable_content
          end

          # Build context for variable resolution
          context = {
            employee: @certification.employee,
            organization: current_organization,
            request: @certification,
            user: current_user
          }

          # Generate document using robust service for better formatting
          generator = ::Templates::RobustDocumentGeneratorService.new(template, context)
          generated_doc = generator.generate!

          # Link document to certification
          @certification.update!(
            document_uuid: generated_doc.uuid,
            status: "processing"
          )

          render json: {
            data: {
              certification: certification_json(@certification, detailed: true),
              document: generated_document_json(generated_doc)
            },
            message: "Documento generado exitosamente"
          }
        rescue ::Templates::RobustDocumentGeneratorService::MissingVariablesError => e
          render json: {
            error: e.message,
            error_type: "missing_variables",
            missing_data: e.missing_data,
            action_required: build_action_required(e.missing_data)
          }, status: :unprocessable_content
        rescue ::Templates::RobustDocumentGeneratorService::GenerationError => e
          render json: { error: e.message }, status: :unprocessable_content
        end

        # POST /api/v1/hr/certifications/:id/sign_document
        def sign_document
          authorize @certification, :sign_document?

          unless @certification.document_uuid
            return render json: { error: "No hay documento para firmar" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.where(uuid: @certification.document_uuid).first
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Verificar que el usuario puede firmar este documento
          unless generated_doc.can_be_signed_by?(current_user)
            # Verificar si es HR y hay firma pendiente de HR
            # Check both signatory_role and signatory_type_code for HR signatures
            pending_hr = generated_doc.signatures.find do |s|
              s["status"] == "pending" && (
                s["signatory_role"] == "hr" ||
                s["signatory_type_code"] == "hr" ||
                s["signatory_label"]&.downcase&.include?("recursos humanos")
              )
            end
            if pending_hr && hr_or_admin?
              # Asignar este usuario HR como firmante
              pending_hr["user_id"] = current_user.id.to_s
              pending_hr["user_name"] = current_user.full_name
              generated_doc.save!
            else
              return render json: { error: "No tienes firma pendiente en este documento" }, status: :forbidden
            end
          end

          # Obtener la firma digital del usuario
          signature = ::Identity::UserSignature.where(user_id: current_user.id, is_default: true).first
          signature ||= ::Identity::UserSignature.where(user_id: current_user.id).first

          unless signature
            return render json: {
              error: "No tienes firma digital configurada",
              action_required: {
                type: "configure_signature",
                label: "Configurar mi firma digital",
                url: "/profile"
              }
            }, status: :unprocessable_content
          end

          # Aplicar la firma
          generated_doc.sign!(user: current_user, signature: signature)

          render json: {
            message: "Documento firmado exitosamente",
            document: {
              uuid: generated_doc.uuid,
              status: generated_doc.status,
              pending_signatures: generated_doc.pending_signatories.map { |s| s["signatory_label"] },
              completed_signatures: generated_doc.signed_signatories.map { |s| s["signatory_label"] },
              all_signed: generated_doc.all_required_signed?
            }
          }
        rescue ::Templates::GeneratedDocument::SignatureError => e
          render json: { error: e.message }, status: :unprocessable_content
        end

        # GET /api/v1/hr/certifications/:id/download_document
        def download_document
          authorize @certification, :show?

          unless @certification.document_uuid
            return render json: { error: "No hay documento generado" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.where(uuid: @certification.document_uuid).first
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          # Empleados solo pueden descargar documentos con todas las firmas
          unless can_download_document?(generated_doc)
            pending = generated_doc.pending_signatories.map { |s| s["signatory_label"] }.join(", ")
            return render json: {
              error: "Documento pendiente de firmas",
              message: "El documento requiere firmas de: #{pending}",
              pending_signatures: generated_doc.pending_signatories,
              completed_signatures: generated_doc.signed_signatories
            }, status: :forbidden
          end

          file_content = generated_doc.file_content
          unless file_content
            return render json: { error: "Error al leer el archivo" }, status: :internal_server_error
          end

          send_data file_content,
                    filename: generated_doc.file_name || "certificacion.pdf",
                    type: "application/pdf",
                    disposition: "inline"
        end

        private

        def set_certification
          @certification = ::Hr::EmploymentCertificationRequest.find_by!(uuid: params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "Certification request not found" }, status: :not_found
        end

        def certification_params
          params.require(:certification).permit(
            :certification_type,
            :purpose,
            :purpose_details,
            :language,
            :delivery_method,
            :addressee,
            :include_salary,
            :include_position,
            :include_department,
            :include_start_date,
            :additional_info,
            :special_instructions
          )
        end

        def apply_filters(scope)
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(certification_type: params[:type]) if params[:type].present?
          scope
        end

        # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
        def certification_json(certification, detailed: false)
          # Get document info if exists
          doc_info = nil
          if certification.document_uuid
            generated_doc = ::Templates::GeneratedDocument.where(uuid: certification.document_uuid).first
            if generated_doc
              doc_info = {
                status: generated_doc.status,
                can_download: can_download_document?(generated_doc),
                pending_signatures: generated_doc.pending_signatories.map { |s| s["signatory_label"] },
                completed_signatures: generated_doc.signed_signatories.map { |s| s["signatory_label"] },
                all_signed: generated_doc.all_required_signed?
              }
            end
          end

          json = {
            id: certification.uuid,
            request_number: certification.request_number,
            certification_type: certification.certification_type,
            purpose: certification.purpose,
            status: certification.status,
            estimated_days: certification.estimated_days,
            submitted_at: certification.submitted_at&.iso8601,
            created_at: certification.created_at.iso8601,
            document_uuid: certification.document_uuid,
            document_info: doc_info
          }

          if detailed
            json.merge!(
              language: certification.language,
              delivery_method: certification.delivery_method,
              include_salary: certification.include_salary,
              include_position: certification.include_position,
              include_department: certification.include_department,
              include_start_date: certification.include_start_date,
              additional_info: certification.additional_info,
              completed_at: certification.completed_at&.iso8601,
              rejection_reason: certification.rejection_reason,
              processed_by: certification.processed_by ? employee_summary(certification.processed_by) : nil
            )
          end

          json
        end
        # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

        def employee_summary(employee)
          {
            id: employee.uuid,
            name: employee.full_name,
            email: employee.user&.email
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

        def find_template_for_certification
          # Find active template for certification category
          ::Templates::Template
            .for_organization(current_organization)
            .active
            .where(category: "certification")
            .first
        end

        def generated_document_json(doc)
          {
            id: doc.uuid,
            name: doc.name,
            status: doc.status,
            file_name: doc.file_name,
            pending_signatures: doc.pending_signatures_count,
            total_signatures: doc.total_required_signatures,
            created_at: doc.created_at.iso8601
          }
        end

        def build_action_required(missing_data)
          actions = []

          if missing_data[:by_source]["employee"]&.any?
            actions << {
              type: "edit_employee",
              label: "Completar datos del empleado",
              employee_id: missing_data[:employee_id],
              employee_name: missing_data[:employee_name],
              fields: missing_data[:by_source]["employee"].map { |v| v[:field] }
            }
          end

          if missing_data[:by_source]["organization"]&.any?
            actions << {
              type: "edit_organization",
              label: "Completar datos de la organización",
              fields: missing_data[:by_source]["organization"].map { |v| v[:field] }
            }
          end

          if missing_data[:by_source][nil]&.any?
            actions << {
              type: "configure_mappings",
              label: "Configurar mapeo de variables",
              variables: missing_data[:by_source][nil].map { |v| v[:variable] }
            }
          end

          actions
        end

        # HR/Admin pueden descargar documentos sin firmas completas
        # Empleados solo pueden descargar documentos completamente firmados
        def can_download_document?(generated_doc)
          return true if hr_or_admin?
          return true if generated_doc.completed?
          return true if generated_doc.signatures.empty? # Sin requisito de firmas

          false
        end

        def hr_or_admin?
          current_user.has_role?(:admin) ||
            current_user.has_role?(:hr) ||
            current_user.has_role?(:hr_manager)
        end
      end
    end
  end
end
