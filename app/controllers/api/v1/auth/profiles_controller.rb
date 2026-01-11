# frozen_string_literal: true

module Api
  module V1
    module Auth
      class ProfilesController < ApplicationController
        before_action :authenticate_user!

        # PATCH /api/v1/auth/profile
        def update
          if current_user.update(profile_params)
            render json: { data: user_response(current_user) }, status: :ok
          else
            render json: { error: current_user.errors.full_messages.join(", ") }, status: :unprocessable_content
          end
        end

        private

        def authenticate_user!
          return if current_user

          render json: {
            error: "Unauthorized",
            message: "You need to sign in or sign up before continuing."
          }, status: :unauthorized
        end

        def current_user
          @current_user ||= warden.authenticate(scope: :identity_user)
        end

        def profile_params
          params.require(:user).permit(:first_name, :last_name, :time_zone, :locale)
        end

        def user_response(user)
          employee = ::Hr::Employee.for_user(user)
          vacation_info = employee ? ::Hr::VacationCalculator.new(employee).summary : nil

          {
            id: user.id.to_s,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            department: user.department,
            title: user.title,
            roles: user.role_names,
            permissions: user.permission_names,
            permission_level: user.permission_level,
            organization_id: user.organization_id&.to_s,
            time_zone: user.time_zone,
            locale: user.locale,
            is_supervisor: employee&.supervisor? || false,
            is_hr: employee&.hr_staff? || employee&.hr_manager? || false,
            employee: employee ? {
              id: employee.uuid,
              employee_number: employee.employee_number,
              job_title: employee.job_title,
              department: employee.department,
              hire_date: employee.hire_date&.iso8601
            } : nil,
            vacation: vacation_info
          }
        end
      end
    end
  end
end
