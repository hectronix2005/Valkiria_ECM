# frozen_string_literal: true

module Api
  module V1
    module Admin
      class DepartmentsController < BaseController
        before_action :require_admin_or_hr

        # GET /api/v1/admin/departments
        def index
          # Get unique departments from employees
          employee_departments = ::Hr::Employee.where(organization_id: current_organization.id)
                                               .distinct(:department)
                                               .compact

          # Get configured departments from organization settings
          configured_departments = current_organization.settings&.dig("departments") || []

          # Merge both lists (configured + any that exist in employees)
          all_departments = (configured_departments + employee_departments).uniq.sort

          # Build department stats
          departments_with_stats = all_departments.map do |dept|
            employee_count = ::Hr::Employee.where(organization_id: current_organization.id, department: dept).count
            {
              id: dept.parameterize,
              name: dept,
              code: dept.parameterize.upcase.gsub("-", "_"),
              employee_count: employee_count,
              active: configured_departments.include?(dept) || employee_count > 0,
              is_configured: configured_departments.include?(dept)
            }
          end

          render json: {
            data: departments_with_stats,
            meta: {
              total: departments_with_stats.count,
              total_employees: ::Hr::Employee.where(organization_id: current_organization.id).count
            }
          }
        end

        # POST /api/v1/admin/departments
        def create
          name = params[:department][:name]&.strip

          if name.blank?
            return render json: { error: "El nombre del departamento es requerido" }, status: :unprocessable_entity
          end

          # Get current departments
          departments = current_organization.settings&.dig("departments") || []

          if departments.include?(name)
            return render json: { error: "El departamento ya existe" }, status: :unprocessable_entity
          end

          # Add new department
          departments << name
          current_organization.settings ||= {}
          current_organization.settings["departments"] = departments.sort
          current_organization.save!

          render json: {
            data: {
              id: name.parameterize,
              name: name,
              code: name.parameterize.upcase.gsub("-", "_"),
              employee_count: 0,
              active: true,
              is_configured: true
            },
            message: "Departamento creado correctamente"
          }, status: :created
        end

        # PATCH /api/v1/admin/departments/:id
        def update
          old_name = params[:id].gsub("-", " ").titleize
          new_name = params[:department][:name]&.strip

          if new_name.blank?
            return render json: { error: "El nombre del departamento es requerido" }, status: :unprocessable_entity
          end

          departments = current_organization.settings&.dig("departments") || []

          # Find the original department (case-insensitive)
          original = departments.find { |d| d.parameterize == params[:id] }

          unless original
            return render json: { error: "Departamento no encontrado" }, status: :not_found
          end

          # Update in settings
          departments = departments.map { |d| d == original ? new_name : d }
          current_organization.settings["departments"] = departments.sort
          current_organization.save!

          # Update employees with this department
          ::Hr::Employee.where(organization_id: current_organization.id, department: original)
                        .update_all(department: new_name)

          employee_count = ::Hr::Employee.where(organization_id: current_organization.id, department: new_name).count

          render json: {
            data: {
              id: new_name.parameterize,
              name: new_name,
              code: new_name.parameterize.upcase.gsub("-", "_"),
              employee_count: employee_count,
              active: true,
              is_configured: true
            },
            message: "Departamento actualizado correctamente"
          }
        end

        # DELETE /api/v1/admin/departments/:id
        def destroy
          departments = current_organization.settings&.dig("departments") || []

          # Find the department
          department = departments.find { |d| d.parameterize == params[:id] }

          unless department
            return render json: { error: "Departamento no encontrado" }, status: :not_found
          end

          # Check if has employees
          employee_count = ::Hr::Employee.where(organization_id: current_organization.id, department: department).count

          if employee_count > 0
            return render json: {
              error: "No se puede eliminar un departamento con empleados asignados",
              employee_count: employee_count
            }, status: :unprocessable_entity
          end

          # Remove from settings
          departments.delete(department)
          current_organization.settings["departments"] = departments
          current_organization.save!

          render json: { message: "Departamento eliminado correctamente" }
        end

        # POST /api/v1/admin/departments/:id/toggle_active
        def toggle_active
          # For now, just return success - departments are always active if configured
          render json: { message: "Estado actualizado" }
        end

        private

        def require_admin_or_hr
          unless current_user.admin? || current_user.has_role?("hr") || current_user.has_role?("hr_manager")
            render json: { error: "No autorizado" }, status: :forbidden
          end
        end
      end
    end
  end
end
