# frozen_string_literal: true

module Api
  module V1
    module Hr
      # HR Dashboard with statistics
      class DashboardController < BaseController
        before_action :ensure_hr_access

        # GET /api/v1/hr/dashboard
        def show
          stats = ::Hr::HrService.new(
            organization: current_organization,
            actor: current_employee
          ).statistics

          render json: { data: stats }
        rescue ::Hr::HrService::AuthorizationError => e
          render json: { error: e.message }, status: :forbidden
        end

        private

        def ensure_hr_access
          return if current_employee.hr_staff? || current_employee.hr_manager?

          render json: { error: "HR access required" }, status: :forbidden
        end

        def current_employee
          @current_employee ||= ::Hr::Employee.find_or_create_for_user!(current_user)
        end
      end
    end
  end
end
