# frozen_string_literal: true

module Api
  module V1
    module Admin
      class SettingsController < BaseController
        def show
          authorize :settings, :show?

          render json: {
            data: {
              app_name: Rails.application.class.module_parent_name,
              environment: Rails.env,
              version: "1.0.0",
              features: {
                audit_logging: true,
                soft_delete: true,
                multi_tenancy: true
              }
            }
          }, status: :ok
        end

        def update
          authorize :settings, :update?

          # For now, just return success - actual settings management will be implemented later
          render json: {
            message: "Settings updated successfully"
          }, status: :ok
        end
      end
    end
  end
end
