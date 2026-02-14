# frozen_string_literal: true

module Api
  module V1
    module Admin
      class PermissionsController < BaseController
        before_action :require_strict_admin

        # GET /api/v1/admin/permissions
        def index
          roles = ::Identity::Role.all.by_level.map do |role|
            {
              id: role.id.to_s,
              name: role.name,
              display_name: role.display_name,
              description: role.description,
              level: role.level_value,
              system_role: role.system_role,
              permission_ids: role.permission_ids.map(&:to_s)
            }
          end

          permissions = ::Identity::Permission.all.order(resource: :asc, action: :asc).map do |perm|
            {
              id: perm.id.to_s,
              name: perm.name,
              resource: perm.resource,
              action: perm.action,
              description: perm.description
            }
          end

          render json: {
            data: {
              roles: roles,
              permissions: permissions
            }
          }
        end

        # PATCH /api/v1/admin/permissions/:id
        def update
          role = ::Identity::Role.find(params[:id])

          if role.admin?
            return render json: { error: "No se pueden modificar los permisos del rol admin." }, status: :unprocessable_entity
          end

          permission_ids = params[:permission_ids] || []
          permissions = ::Identity::Permission.where(:id.in => permission_ids)

          role.permissions = permissions
          role.save!

          render json: {
            data: {
              id: role.id.to_s,
              name: role.name,
              display_name: role.display_name,
              level: role.level_value,
              permission_ids: role.permission_ids.map(&:to_s)
            },
            message: "Permisos del rol '#{role.display_name}' actualizados correctamente."
          }
        end

        private

        def require_strict_admin
          unless current_user&.admin?
            render json: { error: "No autorizado. Se requiere rol de administrador." }, status: :forbidden
          end
        end
      end
    end
  end
end
