# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TemplatesController < BaseController
        before_action :ensure_admin_or_hr
        before_action :set_template, only: [:show, :update, :destroy, :activate, :archive, :duplicate, :reassign_mappings, :download, :preview]

        # GET /api/v1/admin/templates
        def index
          @templates = ::Templates::Template
                       .for_organization(current_organization)
                       .order(created_at: :desc)

          # Filter by status
          @templates = @templates.where(status: params[:status]) if params[:status].present?

          # Filter by module
          @templates = @templates.by_module(params[:module_type]) if params[:module_type].present?

          # Filter by main category
          @templates = @templates.by_main_category(params[:main_category]) if params[:main_category].present?

          # Filter by subcategory
          @templates = @templates.where(category: params[:category]) if params[:category].present?

          # Search by name
          if params[:q].present?
            @templates = @templates.where(name: /#{Regexp.escape(params[:q])}/i)
          end

          render json: {
            data: @templates.map { |t| template_json(t) },
            meta: {
              total: @templates.count,
              categories: ::Templates::Template::CATEGORIES,
              statuses: ::Templates::Template::STATUSES
            }
          }
        end

        # GET /api/v1/admin/templates/:id
        def show
          render json: {
            data: template_json(@template, detailed: true)
          }
        end

        # POST /api/v1/admin/templates
        def create
          @template = ::Templates::Template.new(template_params)
          @template.organization = current_organization
          @template.created_by = current_user

          if @template.save
            # Handle file upload if present
            handle_file_upload if params[:file].present?

            render json: {
              data: template_json(@template),
              message: "Template creado exitosamente"
            }, status: :created
          else
            render json: {
              error: "Error al crear template",
              errors: @template.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/admin/templates/:id
        def update
          if @template.update(template_params)
            # Handle file upload if present
            handle_file_upload if params[:file].present?

            render json: {
              data: template_json(@template),
              message: "Template actualizado exitosamente"
            }
          else
            render json: {
              error: "Error al actualizar template",
              errors: @template.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # DELETE /api/v1/admin/templates/:id
        def destroy
          @template.destroy
          render json: { message: "Template eliminado exitosamente" }
        end

        # POST /api/v1/admin/templates/:id/activate
        def activate
          @template.activate!
          render json: {
            data: template_json(@template),
            message: "Template activado exitosamente"
          }
        rescue ::Templates::Template::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_content
        end

        # POST /api/v1/admin/templates/:id/archive
        def archive
          @template.archive!
          render json: {
            data: template_json(@template),
            message: "Template archivado exitosamente"
          }
        end

        # POST /api/v1/admin/templates/:id/duplicate
        def duplicate
          new_template = @template.duplicate!
          render json: {
            data: template_json(new_template),
            message: "Template duplicado exitosamente"
          }, status: :created
        end

        # GET /api/v1/admin/templates/categories
        def categories
          modules = ::Templates::Template::MODULES.map do |key, config|
            { value: key, label: config[:label], icon: config[:icon] }
          end

          main_categories = ::Templates::Template::MAIN_CATEGORIES.map do |key, label|
            { value: key, label: label, module: ::Templates::Template::CATEGORY_TO_MODULE[key] }
          end

          subcategories = ::Templates::Template::SUBCATEGORIES.map do |key, config|
            { value: key, label: config[:label], main_category: config[:main] }
          end

          # Group subcategories by main category for easier frontend consumption
          grouped = subcategories.group_by { |s| s[:main_category] }

          # Third party types for legal module
          third_party_types = ::Legal::ThirdParty::TYPES.map do |type|
            { value: type, label: I18n.t("legal.third_party.types.#{type}", default: type.humanize) }
          end

          render json: {
            data: subcategories, # Legacy: flat list of subcategories
            modules: modules,
            main_categories: main_categories,
            subcategories: subcategories,
            grouped: grouped,
            category_to_module: ::Templates::Template::CATEGORY_TO_MODULE,
            third_party_types: third_party_types
          }
        end

        # GET /api/v1/admin/templates/:id/third_party_requirements
        def third_party_requirements
          set_template
          return unless @template

          render json: {
            data: {
              template_id: @template.uuid,
              template_name: @template.name,
              default_third_party_type: @template.default_third_party_type,
              suggested_person_type: @template.suggested_person_type,
              required_fields: @template.required_third_party_fields,
              uses_third_party: @template.uses_third_party_variables?,
              variables: @template.variables,
              variables_count: @template.variables&.count || 0
            }
          }
        end

        # GET /api/v1/admin/templates/variable_mappings
        def variable_mappings
          render json: {
            data: ::Templates::Template.available_variable_mappings(current_organization),
            grouped: ::Templates::Template.grouped_variable_mappings(current_organization).transform_values do |mappings|
              mappings.map { |m| { name: m.name, key: m.key, description: m.description } }
            end
          }
        end

        # POST /api/v1/admin/templates/:id/upload
        def upload
          set_template

          unless params[:file].present?
            return render json: { error: "Archivo requerido" }, status: :bad_request
          end

          handle_file_upload

          render json: {
            data: template_json(@template),
            message: "Archivo subido exitosamente",
            variables: @template.variables
          }
        end

        # POST /api/v1/admin/templates/:id/reassign_mappings
        def reassign_mappings
          @template.reassign_all_mappings!

          render json: {
            data: template_json(@template, detailed: true),
            message: "Mappings reasignados exitosamente"
          }
        end

        # GET /api/v1/admin/templates/:id/download
        def download
          unless @template.file_id
            return render json: { error: "El template no tiene archivo adjunto" }, status: :not_found
          end

          file_content = @template.file_content

          if file_content
            send_data file_content,
                      filename: @template.file_name || "#{@template.name}.docx",
                      type: @template.file_content_type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      disposition: "attachment"
          else
            render json: { error: "No se pudo obtener el archivo" }, status: :internal_server_error
          end
        end

        # GET /api/v1/admin/templates/:id/preview
        def preview
          unless @template.file_id
            return render json: { error: "El template no tiene archivo adjunto" }, status: :not_found
          end

          # First, try to use stored PDF preview (works on Heroku without LibreOffice)
          if @template.preview_file_id
            preview_content = @template.preview_content
            if preview_content
              return send_data preview_content,
                        filename: "#{@template.name || 'preview'}.pdf",
                        type: "application/pdf",
                        disposition: "inline"
            end
          end

          # If file is already a PDF, serve it directly
          if @template.file_name&.end_with?(".pdf")
            file_content = @template.file_content
            if file_content
              return send_data file_content,
                        filename: @template.file_name,
                        type: "application/pdf",
                        disposition: "inline"
            end
          end

          file_content = @template.file_content

          unless file_content
            return render json: { error: "No se pudo obtener el archivo" }, status: :internal_server_error
          end

          # Convert Word to PDF using LibreOffice (local development)
          temp_dir = Dir.mktmpdir
          begin
            # Write Word file
            docx_path = File.join(temp_dir, "template.docx")
            File.binwrite(docx_path, file_content)

            # Convert to PDF using LibreOffice
            soffice_paths = [
              `which soffice`.strip,
              "/opt/homebrew/bin/soffice",           # macOS Homebrew
              "/usr/bin/soffice",                    # Linux standard
            ]

            soffice_path = soffice_paths.find { |p| p.present? && File.exist?(p) }

            unless soffice_path
              # No LibreOffice and no stored preview - return error
              return render json: { error: "Preview PDF no disponible. Re-sube el archivo desde un entorno con LibreOffice." }, status: :service_unavailable
            end

            system(soffice_path, "--headless", "--convert-to", "pdf", "--outdir", temp_dir, docx_path)

            pdf_path = File.join(temp_dir, "template.pdf")

            unless File.exist?(pdf_path)
              return render json: { error: "Error al convertir el documento a PDF" }, status: :internal_server_error
            end

            pdf_content = File.binread(pdf_path)

            # Store this preview for future use
            @template.store_pdf_preview!(pdf_content)
            @template.save

            send_data pdf_content,
                      filename: "#{@template.name || 'preview'}.pdf",
                      type: "application/pdf",
                      disposition: "inline"
          ensure
            FileUtils.rm_rf(temp_dir)
          end
        end

        private

        def ensure_admin_or_hr
          return if current_user.admin? || current_user.has_role?("hr")

          render json: {
            error: "Acceso denegado. Se requieren privilegios de administrador o HR."
          }, status: :forbidden
        end

        def set_template
          @template = ::Templates::Template.find_by(
            uuid: params[:id],
            organization_id: current_organization.id
          )

          return if @template

          render json: { error: "Template no encontrado" }, status: :not_found
        end

        def template_params
          params.require(:template).permit(
            :name,
            :description,
            :module_type,
            :main_category,
            :category,
            :certification_type,
            :certification_type_label,
            :default_third_party_type,
            :company_id,
            :preview_scale,
            :preview_page_height,
            :sequential_signing,
            variable_mappings: {}
          )
        end

        def handle_file_upload
          file = params[:file]

          # Validate file type
          unless file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @template.errors.add(:file, "debe ser un documento Word (.docx)")
            return
          end

          # Validate file size (10MB max)
          if file.size > 10.megabytes
            @template.errors.add(:file, "no debe exceder 10MB")
            return
          end

          @template.attach_file(
            file.tempfile,
            filename: file.original_filename,
            content_type: file.content_type
          )
        end

        def template_json(template, detailed: false)
          json = {
            id: template.uuid,
            name: template.name,
            description: template.description,
            module_type: template.module_type,
            module_type_label: template.module_type_label,
            main_category: template.main_category,
            main_category_label: template.main_category_label,
            category: template.category,
            category_label: template.category_label,
            status: template.status,
            version: template.version,
            file_name: template.file_name,
            file_size: template.file_size,
            variables: template.variables,
            signatories_count: template.signatories.count,
            certification_type: template.certification_type,
            certification_type_label: template.certification_type_label,
            default_third_party_type: template.default_third_party_type,
            uses_third_party: template.uses_third_party_variables?,
            company_id: template.company_id,
            company_name: template.company_id.present? ? ::Identity::Company.where(uuid: template.company_id, organization_id: current_organization.id).first&.name : nil,
            sequential_signing: template.sequential_signing != false,
            preview_scale: template.preview_scale || 0.7,
            preview_page_height: template.preview_page_height || 842,
            pdf_width: template.pdf_width || 612,
            pdf_height: template.pdf_height || 792,
            pdf_page_count: template.pdf_page_count || 1,
            created_at: template.created_at.iso8601,
            updated_at: template.updated_at.iso8601
          }

          if detailed
            json[:variable_mappings] = template.variable_mappings
            json[:signatories] = template.signatories.by_position.map { |s| signatory_json(s) }
            json[:available_mappings] = ::Templates::Template.available_variable_mappings(current_organization)
            json[:required_third_party_fields] = template.required_third_party_fields
            json[:suggested_person_type] = template.suggested_person_type
          end

          json
        end

        def signatory_json(signatory)
          {
            id: signatory.uuid,
            role: signatory.role,
            signatory_type_code: signatory.signatory_type_code,
            effective_code: signatory.effective_code,
            role_label: signatory.role_label,
            label: signatory.label,
            position: signatory.position,
            required: signatory.required,
            placeholder_text: signatory.placeholder_text,
            page_number: signatory.page_number,
            x_position: signatory.x_position,
            y_position: signatory.y_position,
            width: signatory.width,
            height: signatory.height,
            date_position: signatory.date_position || "right",
            show_label: signatory.show_label.nil? ? true : signatory.show_label,
            show_signer_name: signatory.show_signer_name || false
          }
        end
      end
    end
  end
end
