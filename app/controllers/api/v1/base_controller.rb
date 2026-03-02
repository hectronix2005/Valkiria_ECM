# frozen_string_literal: true

module Api
  module V1
    class BaseController < ApplicationController
      include Pundit::Authorization

      before_action :authenticate_user!
      around_action :with_employee_mode_thread_local

      rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized

      protected

      def current_user
        @current_user ||= warden.authenticate(scope: :identity_user)
      end

      def current_organization
        @current_organization ||= current_user&.organization
      end

      # Employee mode - when active, user acts as regular employee regardless of actual roles
      def employee_mode?
        request.headers["X-Employee-Mode"] == "true"
      end

      # Check if user has admin role (respects employee mode)
      def admin?
        return false if employee_mode?

        current_user&.has_role?(:admin)
      end

      # Admin-level access: admin OR legal (respects employee mode)
      def admin_access?
        return false if employee_mode?

        current_user&.admin_access?
      end

      # Check if user has HR role (respects employee mode)
      def hr_or_admin?
        return false if employee_mode?

        current_user&.has_role?(:admin) ||
          current_user&.has_role?(:hr) ||
          current_user&.has_role?(:hr_manager)
      end

      # Check if user is supervisor (respects employee mode)
      def supervisor?
        return false if employee_mode?

        current_user&.try(:is_supervisor)
      end

      # Get current employee record (read-only lookup, no auto-creation).
      # Controllers that need auto-creation should override this or use
      # find_or_create_for_user! explicitly in create actions.
      def current_employee
        @current_employee ||= ::Hr::Employee.for_user(current_user)
      end

      def authenticate_user!
        return if current_user

        render json: {
          error: "Unauthorized",
          message: "You need to sign in or sign up before continuing."
        }, status: :unauthorized
      end

      def pundit_user
        current_user
      end

      # Simple pagination without external gem
      def paginate(scope)
        page = (params[:page] || 1).to_i
        per_page = [(params[:per_page] || 20).to_i, 100].min

        @pagination_page = page
        @pagination_per_page = per_page
        @pagination_total = scope.count

        scope.skip((page - 1) * per_page).limit(per_page)
      end

      def pagination_meta(_scope = nil)
        {
          current_page: @pagination_page,
          per_page: @pagination_per_page,
          total_count: @pagination_total,
          total_pages: (@pagination_total.to_f / @pagination_per_page).ceil
        }
      end

      def render_error(message, status: :bad_request, errors: [])
        render json: { error: message, errors: Array(errors) }, status: status
      end

      # Returns the full names of users in the current organization
      # whose roles match the given signatory type code.
      def eligible_users_for_signatory_type(signatory_type_code)
        return [] if signatory_type_code.blank? || current_organization.blank?

        role_names = case signatory_type_code
                     when "hr" then %w[hr hr_manager admin]
                     when "hr_manager" then %w[hr_manager admin]
                     when "supervisor" then %w[supervisor manager]
                     when "legal", "legal_representative" then %w[legal legal_representative]
                     when "admin" then %w[admin]
                     when "ceo", "general_manager" then %w[ceo general_manager]
                     when "accountant" then %w[accountant]
                     else [signatory_type_code]
                     end

        role_ids = ::Identity::Role.where(:name.in => role_names).pluck(:id)
        return [] if role_ids.empty?

        ::Identity::User
          .where(organization_id: current_organization.id)
          .where(:role_ids.in => role_ids)
          .pluck(:first_name, :last_name)
          .map { |fn, ln| [fn, ln].compact.join(" ").strip }
          .reject(&:blank?)
      end

      private

      def user_not_authorized(exception = nil)
        @_error_already_logged = true
        log_error(exception, severity: "warning") if exception
        render json: { error: "You are not authorized to perform this action" }, status: :forbidden
      end

      # Share employee_mode? with Pundit policies via thread-local.
      # Uses around_action + ensure so the thread-local is always cleaned up,
      # even when an unrescued exception occurs.
      def with_employee_mode_thread_local
        Thread.current[:employee_mode] = employee_mode?
        yield
      ensure
        Thread.current[:employee_mode] = nil
      end
    end
  end
end
