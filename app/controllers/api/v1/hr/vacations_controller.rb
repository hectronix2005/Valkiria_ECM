# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Vacation requests management for employees
      class VacationsController < BaseController
        before_action :set_vacation, only: [:show, :update, :submit, :cancel]

        # GET /api/v1/hr/vacations
        def index
          @vacations = policy_scope(::Hr::VacationRequest)
            .order(created_at: :desc)

          @vacations = apply_filters(@vacations)
          @vacations = paginate(@vacations)

          render json: {
            data: @vacations.map { |v| vacation_json(v) },
            meta: pagination_meta(@vacations)
          }
        end

        # GET /api/v1/hr/vacations/:id
        def show
          authorize @vacation

          render json: { data: vacation_json(@vacation, detailed: true) }
        end

        # POST /api/v1/hr/vacations
        def create
          @vacation = ::Hr::VacationRequest.new(vacation_params)
          @vacation.employee = current_employee
          @vacation.organization = current_organization

          authorize @vacation

          if @vacation.save
            render json: { data: vacation_json(@vacation) }, status: :created
          else
            render json: { errors: @vacation.errors.full_messages }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/hr/vacations/:id
        def update
          authorize @vacation

          unless @vacation.draft?
            return render json: { error: "Can only update draft requests" }, status: :unprocessable_content
          end

          if @vacation.update(vacation_params)
            render json: { data: vacation_json(@vacation) }
          else
            render json: { errors: @vacation.errors.full_messages }, status: :unprocessable_content
          end
        end

        # POST /api/v1/hr/vacations/:id/submit
        def submit
          authorize @vacation, :submit?

          @vacation.submit!(actor: current_employee)

          render json: {
            data: vacation_json(@vacation),
            message: "Vacation request submitted for approval"
          }
        rescue ::Hr::VacationRequest::InvalidStateError,
               ::Hr::VacationRequest::ValidationError => e
          render json: { error: e.message }, status: :unprocessable_content
        end

        # POST /api/v1/hr/vacations/:id/cancel
        def cancel
          authorize @vacation, :cancel?

          @vacation.cancel!(actor: current_employee, reason: params[:reason])

          render json: {
            data: vacation_json(@vacation),
            message: "Vacation request cancelled"
          }
        rescue ::Hr::VacationRequest::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_content
        rescue ::Hr::VacationRequest::AuthorizationError => e
          render json: { error: e.message }, status: :forbidden
        end

        private

        def set_vacation
          @vacation = ::Hr::VacationRequest.find_by!(uuid: params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "Vacation request not found" }, status: :not_found
        end

        def vacation_params
          params.require(:vacation).permit(
            :vacation_type,
            :start_date,
            :end_date,
            :days_requested,
            :reason,
            :notes
          )
        end

        def apply_filters(scope) # rubocop:disable Metrics/AbcSize
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(vacation_type: params[:type]) if params[:type].present?
          scope = scope.where(:start_date.gte => params[:from]) if params[:from].present?
          scope = scope.where(:end_date.lte => params[:to]) if params[:to].present?
          scope
        end

        def vacation_json(vacation, detailed: false) # rubocop:disable Metrics/MethodLength
          json = {
            id: vacation.uuid,
            request_number: vacation.request_number,
            vacation_type: vacation.vacation_type,
            start_date: vacation.start_date&.iso8601,
            end_date: vacation.end_date&.iso8601,
            days_requested: vacation.days_requested,
            status: vacation.status,
            submitted_at: vacation.submitted_at&.iso8601,
            created_at: vacation.created_at.iso8601
          }

          if detailed
            json.merge!(
              reason: vacation.reason,
              notes: vacation.notes,
              decided_at: vacation.decided_at&.iso8601,
              decision_reason: vacation.decision_reason,
              approved_by_name: vacation.approved_by_name,
              approver: vacation.approver ? employee_summary(vacation.approver) : nil,
              history: vacation.history
            )
          end

          json
        end

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
      end
    end
  end
end
