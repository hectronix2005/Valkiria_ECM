# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Employee information (read-only for most users)
      class EmployeesController < BaseController
        before_action :set_employee, only: [:show, :update, :subordinates, :vacation_balance, :create_account, :generate_document]

        # GET /api/v1/hr/employees
        def index
          authorize ::Hr::Employee

          @employees = policy_scope(::Hr::Employee)
            .where(organization_id: current_organization.id)
            .active

          @employees = apply_filters(@employees)
          @employees = apply_sorting(@employees)
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

        # POST /api/v1/hr/employees
        def create
          authorize ::Hr::Employee

          @employee = ::Hr::Employee.new(employee_create_params)
          @employee.organization = current_organization

          if @employee.save
            render json: {
              data: employee_json(@employee, detailed: true),
              message: "Empleado creado exitosamente"
            }, status: :created
          else
            render json: {
              error: @employee.errors.full_messages.join(", ")
            }, status: :unprocessable_content
          end
        end

        # POST /api/v1/hr/employees/:id/create_account
        def create_account
          authorize @employee, :create_account?

          service = ::Hr::EmployeeAccountService.new(@employee)

          if service.has_account?
            return render json: {
              error: "El empleado ya tiene una cuenta de usuario"
            }, status: :unprocessable_content
          end

          user = service.create_account!

          if user
            render json: {
              data: employee_json(@employee.reload, detailed: true),
              user: {
                id: user.uuid,
                email: user.email,
                must_change_password: user.must_change_password
              },
              message: "Cuenta de usuario creada exitosamente. El usuario debe cambiar su contraseña en el primer inicio de sesión."
            }
          else
            render json: {
              error: service.errors.join(", ")
            }, status: :unprocessable_content
          end
        end

        # GET /api/v1/hr/employees/org_chart
        # Returns hierarchical organization chart data
        def org_chart
          authorize ::Hr::Employee, :index?

          employees = ::Hr::Employee
            .where(organization_id: current_organization.id)
            .active
            .order(last_name: :asc)

          # Build tree structure
          tree = build_org_tree(employees)

          render json: {
            data: tree,
            meta: {
              total_employees: employees.count,
              top_level_count: tree.count
            }
          }
        end

        # POST /api/v1/hr/employees/:id/generate_document
        def generate_document
          authorize @employee, :update?

          template = ::Templates::Template.find_by!(uuid: params[:template_id])

          unless template.active?
            return render json: { error: "El template no está activo" }, status: :unprocessable_content
          end

          context = {
            employee: @employee,
            organization: current_organization,
            user: current_user
          }

          begin
            # Use robust service for better variable replacement and formatting
            service = ::Templates::RobustDocumentGeneratorService.new(template, context)
            generated_doc = service.generate!

            render json: {
              data: {
                id: generated_doc.uuid,
                name: generated_doc.name,
                status: generated_doc.status,
                created_at: generated_doc.created_at.iso8601
              },
              message: "Documento generado exitosamente"
            }, status: :created
          rescue ::Templates::RobustDocumentGeneratorService::MissingVariablesError => e
            render json: {
              error: "No se puede generar el documento. Faltan datos requeridos.",
              missing_variables: e.message,
              action_required: "complete_employee_data"
            }, status: :unprocessable_entity
          rescue ::Templates::RobustDocumentGeneratorService::GenerationError => e
            render json: { error: e.message }, status: :unprocessable_entity
          rescue StandardError => e
            Rails.logger.error "Error generating document: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
            render json: { error: "Error al generar el documento: #{e.message}" }, status: :internal_server_error
          end
        end

        private

        def set_employee
          @employee = ::Hr::Employee.find_by!(uuid: params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "Employee not found" }, status: :not_found
        end

        def employee_params
          permitted = params.require(:employee).permit(
            :first_name,
            :last_name,
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
            :supervisor_id,
            # Contract fields
            :contract_type,
            :contract_template_id,
            :contract_start_date,
            :contract_end_date,
            :contract_duration_value,
            :contract_duration_unit,
            :trial_period_days,
            # Compensation fields
            :salary,
            :food_allowance,
            :transport_allowance,
            :payment_frequency,
            :work_city,
            # Personal identification
            :identification_type,
            :identification_number,
            :place_of_birth,
            :nationality,
            :address,
            :phone,
            :personal_email
          )

          # Convert supervisor_id from UUID to internal ID
          if permitted[:supervisor_id].present?
            supervisor = ::Hr::Employee.find_by(uuid: permitted[:supervisor_id])
            permitted[:supervisor_id] = supervisor&.id
          end

          permitted
        end

        # Params for creating a new employee (includes name fields)
        def employee_create_params
          permitted = params.require(:employee).permit(
            :first_name,
            :last_name,
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
            :supervisor_id,
            # Contract fields
            :contract_type,
            :contract_template_id,
            :contract_start_date,
            :contract_end_date,
            :contract_duration_value,
            :contract_duration_unit,
            :trial_period_days,
            # Compensation fields
            :salary,
            :food_allowance,
            :transport_allowance,
            :payment_frequency,
            :work_city,
            # Personal identification
            :identification_type,
            :identification_number,
            :place_of_birth,
            :nationality,
            :address,
            :phone,
            :personal_email
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

        def apply_sorting(scope)
          sort_column = params[:sort_by].presence || "last_name"
          sort_direction = params[:sort_direction]&.downcase == "desc" ? :desc : :asc

          # Map frontend column names to database fields
          column_map = {
            "full_name" => :last_name,
            "job_title" => :job_title,
            "department" => :department,
            "employment_status" => :employment_status,
            "hire_date" => :hire_date,
            "available_vacation_days" => :hire_date # Sort by hire_date as proxy for vacation days
          }

          db_column = column_map[sort_column] || :last_name

          # For full_name, add secondary sort by first_name
          if sort_column == "full_name"
            scope.order(last_name: sort_direction, first_name: sort_direction)
          else
            scope.order(db_column => sort_direction, last_name: :asc)
          end
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
            employment_status: employee.employment_status,
            hire_date: employee.hire_date&.iso8601,
            available_vacation_days: employee.available_vacation_days&.floor,
            supervisor_id: employee.supervisor&.uuid
          }

          if detailed
            json.merge!(
              employment_type: employee.employment_type,
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
              vacation_balance_days: can_view_balance?(employee) ? employee.vacation_balance_days : nil,
              # Contract fields
              contract_type: employee.contract_type,
              contract_template_id: employee.contract_template_id,
              contract_template_name: employee.contract_template&.name,
              contract_start_date: employee.contract_start_date&.iso8601,
              contract_end_date: employee.contract_end_date&.iso8601,
              contract_duration_value: employee.contract_duration_value,
              contract_duration_unit: employee.contract_duration_unit,
              trial_period_days: employee.trial_period_days,
              # Compensation fields
              salary: employee.salary&.to_f,
              food_allowance: employee.food_allowance&.to_f,
              transport_allowance: employee.transport_allowance&.to_f,
              payment_frequency: employee.payment_frequency,
              work_city: employee.work_city,
              # Personal identification
              identification_type: employee.identification_type,
              identification_number: employee.identification_number,
              place_of_birth: employee.place_of_birth,
              nationality: employee.nationality,
              address: employee.address,
              phone: employee.phone,
              personal_email: employee.personal_email,
              # Account status
              has_account: employee.user_id.present?,
              user_email: employee.user&.email
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

        def build_org_tree(employees)
          # Group by supervisor_id for efficient lookup
          by_supervisor = employees.group_by(&:supervisor_id)

          # Find top-level employees (no supervisor or supervisor outside org)
          employee_ids = employees.pluck(:id).to_set
          top_level = employees.select do |e|
            e.supervisor_id.nil? || !employee_ids.include?(e.supervisor_id)
          end

          # Build tree recursively
          top_level.map { |e| build_node(e, by_supervisor) }
        end

        def build_node(employee, by_supervisor)
          children = by_supervisor[employee.id] || []
          {
            id: employee.uuid,
            name: employee.full_name,
            job_title: employee.job_title,
            department: employee.department,
            email: employee.user&.email,
            photo_url: nil, # Future: add avatar support
            subordinates_count: count_all_subordinates(employee, by_supervisor),
            children: children.sort_by(&:last_name).map { |c| build_node(c, by_supervisor) }
          }
        end

        def count_all_subordinates(employee, by_supervisor)
          direct = by_supervisor[employee.id] || []
          direct.count + direct.sum { |c| count_all_subordinates(c, by_supervisor) }
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
