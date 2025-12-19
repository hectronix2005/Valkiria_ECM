# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TemplateSignatoriesController < BaseController
        before_action :ensure_admin_or_hr
        before_action :set_template
        before_action :set_signatory, only: [:show, :update, :destroy]

        # GET /api/v1/admin/templates/:template_id/signatories
        def index
          @signatories = @template.signatories.by_position

          render json: {
            data: @signatories.map { |s| signatory_json(s) },
            meta: {
              total: @signatories.count,
              roles: ::Templates::TemplateSignatory::ROLE_LABELS
            }
          }
        end

        # GET /api/v1/admin/templates/:template_id/signatories/:id
        def show
          render json: { data: signatory_json(@signatory) }
        end

        # POST /api/v1/admin/templates/:template_id/signatories
        def create
          @signatory = @template.signatories.build(signatory_params)

          # Set position to end if not specified
          @signatory.position ||= @template.signatories.count

          if @signatory.save
            render json: {
              data: signatory_json(@signatory),
              message: "Firmante agregado exitosamente"
            }, status: :created
          else
            render json: {
              error: "Error al agregar firmante",
              errors: @signatory.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/admin/templates/:template_id/signatories/:id
        def update
          if @signatory.update(signatory_params)
            render json: {
              data: signatory_json(@signatory),
              message: "Firmante actualizado exitosamente"
            }
          else
            render json: {
              error: "Error al actualizar firmante",
              errors: @signatory.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # DELETE /api/v1/admin/templates/:template_id/signatories/:id
        def destroy
          @signatory.destroy
          render json: { message: "Firmante eliminado exitosamente" }
        end

        # POST /api/v1/admin/templates/:template_id/signatories/reorder
        def reorder
          return render json: { error: "Se requiere lista de IDs" }, status: :bad_request unless params[:ids].present?

          params[:ids].each_with_index do |uuid, index|
            signatory = @template.signatories.find_by(uuid: uuid)
            signatory&.update!(position: index)
          end

          render json: {
            data: @template.signatories.by_position.map { |s| signatory_json(s) },
            message: "Orden actualizado"
          }
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
            uuid: params[:template_id],
            organization_id: current_organization.id
          )

          return if @template

          render json: { error: "Template no encontrado" }, status: :not_found
        end

        def set_signatory
          @signatory = @template.signatories.find_by(uuid: params[:id])

          return if @signatory

          render json: { error: "Firmante no encontrado" }, status: :not_found
        end

        def signatory_params
          params.require(:signatory).permit(
            :role,
            :signatory_type_code,
            :label,
            :position,
            :required,
            :placeholder_text,
            :page_number,
            :x_position,
            :y_position,
            :width,
            :height,
            :custom_user_id,
            :custom_email
          )
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
            custom_user_id: signatory.custom_user_id&.to_s,
            custom_email: signatory.custom_email,
            created_at: signatory.created_at.iso8601
          }
        end
      end
    end
  end
end
