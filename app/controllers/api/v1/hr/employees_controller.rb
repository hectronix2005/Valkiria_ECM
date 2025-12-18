# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Employee information (read-only for most users)
      class EmployeesController < BaseController
        before_action :set_employee, only: [:show, :update, :subordinates, :vacation_balance]

        # GET /api/v1/hr/employees
        def index
          authorize ::Hr::Employee

          @employees = policy_scope(::Hr::Employee)
            .where(organization_id: current_organization.id)
            .active
            .order(last_name: :asc, first_name: :asc)

          @employees = apply_filters(@employees)
          @employees = paginate(@employees)

          render json: {
            data: @employees.map { |e| employee_json(e) },
            meta: pagination_meta(@employees)
          }
        end

        # GET /api/v1/hr/employees/:id
        def show
          authorize @employee

          render json: { data: employee_json(@employee, detailed: true) }
        end

        # PATCH /api/v1/hr/employees/:id
        def update
          authorize @employee

          if @employee.update(employee_params)
            render json: { data: employee_json(@employee, detailed: true) }
          else
            render json: { error: @employee.errors.full_messages.join(", ") }, status: :unprocessable_content
          end
        end

        # GET /api/v1/hr/employees/:id/subordinates
        def subordinates
          authorize @employee, :show?

          subs = @employee.subordinates.active.order(last_name: :asc)

          render json: {
            data: subs.map { |e| employee_json(e) },
            meta: { total: subs.count }
          }
        end

        # GET /api/v1/hr/employees/:id/vacation_balance
        def vacation_balance
          authorize @employee, :show_balance?

          render json: {
            data: {
              employee_id: @employee.uuid,
              balance_days: @employee.vacation_balance_days,
              used_ytd: @employee.vacation_used_ytd,
              accrued_ytd: @employee.vacation_accrued_ytd,
              pending_days: pending_vacation_days(@employee),
              available_days: @employee.vacation_balance_days - pending_vacation_days(@employee)
            }
          }
        end

        private

        def set_employee
          @employee = ::Hr::Employee.find_by!(uuid: params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "Employee not found" }, status: :not_found
        end

        def employee_params
          permitted = params.require(:employee).permit(
            :employee_number,
            :employment_status,
            :employment_type,
            :hire_date,
            :termination_date,
            :job_title,
            :department,
            :cost_center,
            :date_of_birth,
            :emergency_contact_name,
            :emergency_contact_phone,
            :supervisor_id
          )

          # Convert supervisor_id from UUID to internal ID
          if permitted[:supervisor_id].present?
            supervisor = ::Hr::Employee.find_by(uuid: permitted[:supervisor_id])
            permitted[:supervisor_id] = supervisor&.id
          end

          permitted
        end

        def apply_filters(scope)
          scope = scope.where(department: params[:department]) if params[:department].present?
          scope = scope.where(employment_status: params[:status]) if params[:status].present?
          scope = filter_by_supervisor(scope)
          filter_by_query(scope)
        end

        def filter_by_supervisor(scope)
          return scope if params[:supervisor_id].blank?

          supervisor = ::Hr::Employee.find_by(uuid: params[:supervisor_id])
          supervisor ? scope.where(supervisor_id: supervisor.id) : scope
        end

        def filter_by_query(scope)
          return scope if params[:q].blank?

          query = /#{Regexp.escape(params[:q])}/i
          scope.or({ first_name: query }, { last_name: query }, { employee_number: query })
        end

        def employee_json(employee, detailed: false) # rubocop:disable Metrics/MethodLength
          json = {
            id: employee.uuid,
            employee_number: employee.employee_number,
            first_name: employee.first_name,
            last_name: employee.last_name,
            full_name: employee.full_name,
            email: employee.user&.email,
            department: employee.department,
            job_title: employee.job_title,
            employment_status: employee.employment_status
          }

          if detailed
            json.merge!(
              employment_type: employee.employment_type,
              hire_date: employee.hire_date&.iso8601,
              termination_date: employee.termination_date&.iso8601,
              cost_center: employee.cost_center,
              date_of_birth: employee.date_of_birth&.iso8601,
              emergency_contact_name: employee.emergency_contact_name,
              emergency_contact_phone: employee.emergency_contact_phone,
              supervisor: employee.supervisor ? employee_summary(employee.supervisor) : nil,
              supervisor_id: employee.supervisor&.uuid,
              is_supervisor: employee.supervisor?,
              is_hr_staff: employee.hr_staff?,
              is_hr_manager: employee.hr_manager?,
              vacation_balance_days: can_view_balance?(employee) ? employee.vacation_balance_days : nil
            )
          end

          json
        end

        def employee_summary(employee)
          {
            id: employee.uuid,
            name: employee.full_name,
            job_title: employee.job_title
          }
        end

        def pending_vacation_days(employee)
          ::Hr::VacationRequest
            .where(employee_id: employee.id)
            .where(:status.in => ["draft", "pending"])
            .sum(:days_requested) || 0
        end

        def can_view_balance?(employee)
          current_employee.id == employee.id ||
            current_employee.hr_staff? ||
            current_employee.supervises?(employee)
        end

        def current_employee
          @current_employee ||= ::Hr::Employee.for_user(current_user) ||
            ::Hr::Employee.create!(
              user_id: current_user.id,
              organization_id: current_user.organization_id,
              first_name: current_user.first_name,
              last_name: current_user.last_name,
              email: current_user.email,
              employee_number: "EMP-#{current_user.id.to_s[-6..]}"
            )
        end
      end
    end
  end
end
