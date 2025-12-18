# frozen_string_literal: true

module Api
  module V1
    class HealthController < ApplicationController
      skip_before_action :set_request_context, only: [:show]

      def show
        result = HealthCheckService.call

        if result.success?
          render json: {
            status: result.result[:status],
            checks: result.result[:checks],
            timestamp: result.result[:timestamp],
            version: result.result[:version]
          }, status: result.result[:status] == "healthy" ? :ok : :service_unavailable
        else
          render json: {
            status: "error",
            message: result.errors.first
          }, status: :internal_server_error
        end
      end
    end
  end
end
