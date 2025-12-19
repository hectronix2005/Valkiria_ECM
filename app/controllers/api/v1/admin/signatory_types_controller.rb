# frozen_string_literal: true

module Api
  module V1
    module Admin
      class SignatoryTypesController < BaseController
        before_action :ensure_admin_or_hr
        before_action :set_signatory_type, only: [:show, :update, :destroy, :toggle_active]

        # GET /api/v1/admin/signatory_types
        def index
          @types = ::Templates::SignatoryType
                   .for_organization(current_organization)
                   .ordered

          # Filter by active status
          if params[:active].present?
            @types = params[:active] == "true" ? @types.active : @types.inactive
          end

          # Filter system vs custom
          if params[:type].present?
            @types = params[:type] == "system" ? @types.system_types : @types.custom_types
          end

          render json: {
            data: @types.map { |t| type_json(t) },
            meta: {
              total: @types.count
            }
          }
        end

        # GET /api/v1/admin/signatory_types/:id
        def show
          render json: { data: type_json(@signatory_type) }
        end

        # POST /api/v1/admin/signatory_types
        def create
          @signatory_type = ::Templates::SignatoryType.new(type_params)
          @signatory_type.organization = current_organization
          @signatory_type.created_by = current_user
          @signatory_type.is_system = false

          if @signatory_type.save
            render json: {
              data: type_json(@signatory_type),
              message: "Tipo de firmante creado exitosamente"
            }, status: :created
          else
            render json: {
              error: "Error al crear tipo de firmante",
              errors: @signatory_type.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/admin/signatory_types/:id
        def update
          if @signatory_type.system?
            return render json: {
              error: "No se pueden modificar tipos de firmante del sistema"
            }, status: :forbidden
          end

          if @signatory_type.update(type_params)
            render json: {
              data: type_json(@signatory_type),
              message: "Tipo de firmante actualizado exitosamente"
            }
          else
            render json: {
              error: "Error al actualizar tipo de firmante",
              errors: @signatory_type.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # DELETE /api/v1/admin/signatory_types/:id
        def destroy
          if @signatory_type.system?
            return render json: {
              error: "No se pueden eliminar tipos de firmante del sistema"
            }, status: :forbidden
          end

          if @signatory_type.in_use?
            return render json: {
              error: "No se puede eliminar este tipo de firmante porque está siendo usado en #{@signatory_type.usage_count} plantilla(s)"
            }, status: :conflict
          end

          @signatory_type.destroy
          render json: { message: "Tipo de firmante eliminado exitosamente" }
        end

        # POST /api/v1/admin/signatory_types/:id/toggle_active
        def toggle_active
          @signatory_type.toggle_active!

          render json: {
            data: type_json(@signatory_type),
            message: @signatory_type.active? ? "Tipo de firmante activado" : "Tipo de firmante desactivado"
          }
        end

        # POST /api/v1/admin/signatory_types/seed_system
        def seed_system
          ::Templates::SignatoryType.seed_system_types!

          render json: {
            message: "Tipos de firmante del sistema creados exitosamente",
            count: ::Templates::SignatoryType.system_types.count
          }
        end

        # POST /api/v1/admin/signatory_types/reorder
        def reorder
          return render json: { error: "Se requiere lista de IDs" }, status: :bad_request unless params[:ids].present?

          params[:ids].each_with_index do |uuid, index|
            type = ::Templates::SignatoryType.find_by(uuid: uuid)
            type&.update!(position: index)
          end

          render json: { message: "Orden actualizado" }
        end

        private

        def ensure_admin_or_hr
          return if current_user.admin? || current_user.has_role?("hr")

          render json: {
            error: "Acceso denegado. Se requieren privilegios de administrador o HR."
          }, status: :forbidden
        end

        def set_signatory_type
          @signatory_type = ::Templates::SignatoryType.find_by(uuid: params[:id])

          return if @signatory_type

          render json: { error: "Tipo de firmante no encontrado" }, status: :not_found
        end

        def type_params
          params.require(:signatory_type).permit(
            :name,
            :code,
            :description,
            :active,
            :position
          )
        end

        def type_json(type)
          {
            id: type.uuid,
            name: type.name,
            code: type.code,
            description: type.description,
            is_system: type.is_system,
            active: type.active,
            position: type.position,
            in_use: type.in_use?,
            usage_count: type.usage_count,
            created_at: type.created_at.iso8601
          }
        end
      end
    end
  end
end
