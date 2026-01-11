# frozen_string_literal: true

module Api
  module V1
    module Auth
      class SessionsController < ApplicationController
        before_action :authenticate_user!, only: [:show, :destroy]

        def show
          render json: {
            data: user_response(current_user)
          }, status: :ok
        end

        def create
          user = Identity::User.where(email: login_params[:email]&.downcase).first

          if user.nil?
            render_error("Invalid email or password", status: :unauthorized)
          elsif !user.valid_password?(login_params[:password])
            handle_failed_login(user)
          elsif !user.active?
            render_error("Account is deactivated", status: :unauthorized)
          else
            handle_successful_login(user)
          end
        end

        def destroy
          if current_user
            # JWT revocation is handled by Warden middleware via JwtDenylist.revoke_jwt
            render json: { message: "Logged out successfully" }, status: :ok
          else
            render_error("Not logged in", status: :unauthorized)
          end
        end

        private

        def login_params
          # Support both { user: { email, password } } and { email, password } formats
          if params[:user].present?
            params.require(:user).permit(:email, :password)
          else
            params.permit(:email, :password)
          end
        end

        def handle_successful_login(user)
          user.update_tracked_fields!(request)
          token = generate_jwt_token(user)

          render json: {
            data: user_response(user),
            token: token
          }, status: :ok
        end

        def handle_failed_login(user)
          user&.increment_failed_attempts if user.respond_to?(:increment_failed_attempts)
          render_error("Invalid email or password", status: :unauthorized)
        end

        def generate_jwt_token(user)
          Warden::JWTAuth::UserEncoder.new.call(user, :identity_user, nil).first
        end

        def revoke_jwt_token
          token = request.headers["Authorization"]&.split&.last
          return unless token

          begin
            payload = Warden::JWTAuth::TokenDecoder.new.call(token)
            Identity::JwtDenylist.revoke_jwt(payload, current_user)
          rescue JWT::DecodeError
            # Token already invalid
          end
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
            must_change_password: user.must_change_password || false,
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

        def current_user
          @current_user ||= warden.authenticate(scope: :identity_user)
        end

        def authenticate_user!
          return if current_user

          render json: {
            error: "Unauthorized",
            message: "You need to sign in or sign up before continuing."
          }, status: :unauthorized
        end
      end
    end
  end
end
