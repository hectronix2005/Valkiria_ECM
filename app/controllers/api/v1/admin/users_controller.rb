# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UsersController < BaseController
        before_action :require_admin
        before_action :set_user, only: [:show, :update, :destroy, :toggle_active, :assign_roles]

        # GET /api/v1/admin/users
        def index
          users = policy_scope(::Identity::User).enabled

          # Filter by search
          if params[:search].present?
            search = params[:search].downcase
            users = users.or(
              { first_name: /#{search}/i },
              { last_name: /#{search}/i },
              { email: /#{search}/i }
            )
          end

          # Filter by role
          if params[:role].present?
            role = ::Identity::Role.find_by(name: params[:role])
            users = users.where(:role_ids.in => [role&.id].compact) if role
          end

          # Filter by permission level
          if params[:level].present?
            level = params[:level].to_i
            role_names = ::Identity::Role::ROLE_LEVELS.select { |_, v| v == level }.keys
            roles = ::Identity::Role.where(:name.in => role_names)
            users = users.where(:role_ids.in => roles.pluck(:id)) if roles.any?
          end

          # Filter by status
          if params[:status].present?
            users = params[:status] == 'active' ? users.enabled : users.disabled
          end

          # Sorting
          sort_by = params[:sort_by] || 'created_at'
          sort_dir = params[:sort_direction] == 'asc' ? 1 : -1
          users = users.order(sort_by => sort_dir)

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 20).to_i
          total = users.count
          users = users.skip((page - 1) * per_page).limit(per_page)

          render json: {
            data: users.map { |u| user_response(u) },
            meta: {
              total: total,
              page: page,
              per_page: per_page,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/admin/users/:id
        def show
          render json: { data: user_response(@user, full: true) }
        end

        # POST /api/v1/admin/users
        def create
          @user = ::Identity::User.new(user_params)
          @user.organization = current_organization
          @user.password = params[:user][:password] || SecureRandom.hex(8)
          @user.must_change_password = true

          if @user.save
            # Assign roles
            assign_roles_to_user(@user, params[:user][:role_names])

            render json: {
              data: user_response(@user),
              message: "Usuario creado correctamente"
            }, status: :created
          else
            render json: { error: @user.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/admin/users/:id
        def update
          if @user.update(user_params)
            # Update roles if provided
            if params[:user][:role_names].present?
              assign_roles_to_user(@user, params[:user][:role_names])
            end

            render json: {
              data: user_response(@user),
              message: "Usuario actualizado correctamente"
            }
          else
            render json: { error: @user.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/admin/users/:id
        def destroy
          if @user == current_user
            return render json: { error: "No puedes eliminar tu propio usuario" }, status: :unprocessable_entity
          end

          @user.soft_delete!
          render json: { message: "Usuario eliminado correctamente" }
        end

        # POST /api/v1/admin/users/:id/toggle_active
        def toggle_active
          if @user == current_user
            return render json: { error: "No puedes desactivar tu propio usuario" }, status: :unprocessable_entity
          end

          if @user.active?
            @user.deactivate!
            message = "Usuario desactivado"
          else
            @user.activate!
            message = "Usuario activado"
          end

          render json: { data: user_response(@user), message: message }
        end

        # POST /api/v1/admin/users/:id/assign_roles
        def assign_roles
          role_names = params[:role_names] || []
          assign_roles_to_user(@user, role_names)

          render json: {
            data: user_response(@user),
            message: "Roles actualizados correctamente"
          }
        end

        # GET /api/v1/admin/users/roles
        def roles
          roles = ::Identity::Role.all.by_level.map do |role|
            {
              name: role.name,
              display_name: role.display_name,
              description: role.description,
              level: role.level_value,
              system_role: role.system_role
            }
          end

          render json: { data: roles }
        end

        # GET /api/v1/admin/users/stats
        def stats
          users = ::Identity::User.where(organization_id: current_organization.id)

          stats = {
            total: users.count,
            active: users.enabled.count,
            inactive: users.disabled.count,
            by_role: {},
            by_level: {}
          }

          # Count by role
          ::Identity::Role.all.each do |role|
            count = users.where(:role_ids.in => [role.id]).count
            stats[:by_role][role.name] = count if count > 0
          end

          # Count by level
          (1..5).each do |level|
            role_name = ::Identity::Role::LEVELS[level]
            role = ::Identity::Role.find_by(name: role_name)
            stats[:by_level][level] = users.where(:role_ids.in => [role&.id].compact).count if role
          end

          render json: { data: stats }
        end

        private

        def set_user
          @user = ::Identity::User.find(params[:id])
        end

        def user_params
          params.require(:user).permit(
            :email, :first_name, :last_name, :employee_id,
            :department, :title, :phone, :time_zone, :locale, :active
          )
        end

        def require_admin
          unless current_user.admin?
            render json: { error: "No autorizado. Se requiere rol de administrador." }, status: :forbidden
          end
        end

        def assign_roles_to_user(user, role_names)
          return if role_names.nil?

          # Clear existing roles
          user.roles = []

          # Assign new roles
          role_names.each do |role_name|
            role = ::Identity::Role.find_by(name: role_name)
            user.roles << role if role
          end

          user.save!
        end

        def user_response(user, full: false)
          # Get employee data if exists
          employee = ::Hr::Employee.find_by(user_id: user.id)

          # Use employee's department/title if user's is empty
          department = user.department.presence || employee&.department
          title = user.title.presence || employee&.job_title

          response = {
            id: user.id.to_s,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            department: department,
            title: title,
            active: user.active,
            roles: user.role_names,
            permission_level: user.permission_level,
            level_name: user.level_name,
            created_at: user.created_at&.iso8601,
            last_sign_in_at: user.last_sign_in_at&.iso8601,
            has_employee: employee.present?,
            employee_id: employee&.id&.to_s
          }

          if full
            response.merge!(
              employee_id: user.employee_id,
              phone: user.phone,
              time_zone: user.time_zone,
              locale: user.locale,
              sign_in_count: user.sign_in_count,
              must_change_password: user.must_change_password,
              organization_id: user.organization_id&.to_s
            )
          end

          response
        end
      end
    end
  end
end
