# frozen_string_literal: true

module Api
  module V1
    class FrontendErrorsController < ApplicationController
      # No authentication required - errors can happen during login/logout
      skip_before_action :verify_authenticity_token, raise: false

      # Rate limit: 20 errors per IP per minute
      RATE_LIMIT = 20
      RATE_WINDOW = 60 # seconds

      def create
        if rate_limited?
          head :too_many_requests
          return
        end

        increment_rate_counter

        ErrorLoggingService.capture_frontend_error(
          message: error_params[:message].to_s.truncate(5000),
          error_class: error_params[:error_class].to_s.truncate(500).presence || "FrontendError",
          backtrace: Array(error_params[:backtrace]).map { |l| l.to_s.truncate(500) }.first(30),
          url: error_params[:url].to_s.truncate(2000),
          user_agent: request.user_agent,
          metadata: {
            component: error_params[:component].to_s.truncate(200),
            action: error_params[:action_context].to_s.truncate(200),
            browser: error_params[:browser].to_s.truncate(200),
            timestamp: error_params[:timestamp],
            user_email: error_params[:user_email].to_s.truncate(200)
          }.compact_blank
        )

        head :created
      end

      private

      def error_params
        params.permit(:message, :error_class, :url, :component, :action_context,
                       :browser, :timestamp, :user_email, backtrace: [])
      end

      def rate_limit_key
        "frontend_errors:#{request.remote_ip}"
      end

      def rate_limited?
        count = Rails.cache.read(rate_limit_key) || 0
        count >= RATE_LIMIT
      end

      def increment_rate_counter
        count = Rails.cache.read(rate_limit_key) || 0
        Rails.cache.write(rate_limit_key, count + 1, expires_in: RATE_WINDOW.seconds)
      end
    end
  end
end
