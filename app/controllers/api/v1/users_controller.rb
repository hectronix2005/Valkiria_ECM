# frozen_string_literal: true

module Api
  module V1
    class UsersController < BaseController
      before_action :set_user, only: [:show]

      def index
        authorize Identity::User
        users = policy_scope(Identity::User).enabled

        render json: {
          data: users.map { |user| user_response(user) }
        }, status: :ok
      end

      def show
        authorize @user

        render json: {
          data: user_response(@user)
        }, status: :ok
      end

      private

      def set_user
        @user = Identity::User.find(params[:id])
      end

      def user_response(user)
        {
          id: user.id.to_s,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          employee_id: user.employee_id,
          department: user.department,
          title: user.title,
          roles: user.role_names,
          active: user.active,
          organization_id: user.organization_id&.to_s,
          created_at: user.created_at.iso8601,
          updated_at: user.updated_at.iso8601
        }
      end
    end
  end
end
