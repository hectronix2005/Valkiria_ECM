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

          # Filter by category
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
          if @template.generated_documents.completed.any?
            render json: {
              error: "No se puede eliminar un template con documentos generados"
            }, status: :unprocessable_content
          else
            @template.destroy
            render json: { message: "Template eliminado exitosamente" }
          end
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
          render json: {
            data: ::Templates::Template::CATEGORIES.map do |key, label|
              { value: key, label: label }
            end
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

          file_content = @template.file_content

          unless file_content
            return render json: { error: "No se pudo obtener el archivo" }, status: :internal_server_error
          end

          # Convert Word to PDF using LibreOffice
          temp_dir = Dir.mktmpdir
          begin
            # Write Word file
            docx_path = File.join(temp_dir, "template.docx")
            File.binwrite(docx_path, file_content)

            # Convert to PDF using LibreOffice
            soffice_path = `which soffice`.strip
            soffice_path = "/opt/homebrew/bin/soffice" if soffice_path.empty?

            unless File.exist?(soffice_path)
              return render json: { error: "LibreOffice no está instalado para previsualización" }, status: :service_unavailable
            end

            system(soffice_path, "--headless", "--convert-to", "pdf", "--outdir", temp_dir, docx_path)

            pdf_path = File.join(temp_dir, "template.pdf")

            unless File.exist?(pdf_path)
              return render json: { error: "Error al convertir el documento a PDF" }, status: :internal_server_error
            end

            pdf_content = File.binread(pdf_path)

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
            :category,
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
            category: template.category,
            category_label: template.category_label,
            status: template.status,
            version: template.version,
            file_name: template.file_name,
            file_size: template.file_size,
            variables: template.variables,
            signatories_count: template.signatories.count,
            created_at: template.created_at.iso8601,
            updated_at: template.updated_at.iso8601
          }

          if detailed
            json[:variable_mappings] = template.variable_mappings
            json[:signatories] = template.signatories.by_position.map { |s| signatory_json(s) }
            json[:available_mappings] = ::Templates::Template.available_variable_mappings(current_organization)
          end

          json
        end

        def signatory_json(signatory)
          {
            id: signatory.uuid,
            role: signatory.role,
            role_label: signatory.role_label,
            label: signatory.label,
            position: signatory.position,
            required: signatory.required,
            page_number: signatory.page_number,
            x_position: signatory.x_position,
            y_position: signatory.y_position,
            width: signatory.width,
            height: signatory.height
          }
        end
      end
    end
  end
end
