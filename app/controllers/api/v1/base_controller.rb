# frozen_string_literal: true

module Api
  module V1
    class BaseController < ApplicationController
      include Pundit::Authorization

      before_action :authenticate_user!

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

      # Get current employee record
      def current_employee
        @current_employee ||= current_user&.employee
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

      private

      def user_not_authorized
        render json: { error: "You are not authorized to perform this action" }, status: :forbidden
      end
    end
  end
end
