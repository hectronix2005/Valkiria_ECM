# frozen_string_literal: true

class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :set_request_context
  after_action :set_security_headers
  after_action :log_error_response

  rescue_from StandardError, with: :handle_internal_error
  rescue_from Pundit::NotAuthorizedError, with: :handle_unauthorized
  rescue_from Mongoid::Errors::DocumentNotFound, with: :handle_not_found
  rescue_from ActionController::ParameterMissing, with: :handle_bad_request

  protected

  def set_request_context
    Current.request_id = request.request_id
    Current.ip_address = request.remote_ip
    Current.user_agent = request.user_agent
  end

  def render_json(data, status: :ok, meta: {})
    response = { data: data }
    response[:meta] = meta if meta.present?
    render json: response, status: status
  end

  def render_error(message, status: :unprocessable_entity, errors: [])
    render json: {
      error: message,
      errors: Array(errors)
    }, status: status
  end

  def render_errors(errors, status: :unprocessable_entity)
    render json: {
      errors: Array(errors)
    }, status: status
  end

  private

  def set_security_headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
  end

  # Automatically log ALL non-2xx responses — catches every controller error
  # without needing to modify each controller individually
  def log_error_response
    return if response.successful? # 2xx — nothing to log
    return if response.status == 304 # Not Modified
    return if @_error_already_logged # Avoid double-logging rescue_from exceptions

    ErrorLoggingService.log_response(
      status: response.status,
      body: response.body,
      request: request,
      user: try(:current_user),
      controller_name: self.class.name,
      action_name: action_name
    )
  rescue StandardError => e
    Rails.logger.error("[ApplicationController] log_error_response failed: #{e.message}")
  end

  def handle_unauthorized(exception)
    @_error_already_logged = true
    log_error(exception, severity: "warning")
    render_error(
      "You are not authorized to perform this action",
      status: :forbidden,
      errors: [exception.message]
    )
  end

  def handle_not_found(exception)
    @_error_already_logged = true
    log_error(exception, severity: "warning")
    render_error(
      "Resource not found",
      status: :not_found,
      errors: [exception.message]
    )
  end

  def handle_bad_request(exception)
    @_error_already_logged = true
    log_error(exception, severity: "warning")
    render_error(
      "Bad request",
      status: :bad_request,
      errors: [exception.message]
    )
  end

  def handle_internal_error(exception)
    @_error_already_logged = true
    log_error(exception, severity: "error")
    Rails.logger.error("#{exception.class}: #{exception.message}\n#{exception.backtrace&.first(10)&.join("\n")}")
    error_details = Rails.env.local? ? [exception.message] : ["An unexpected error occurred"]
    render_error(
      "Internal server error",
      status: :internal_server_error,
      errors: error_details
    )
  end

  def log_error(exception, severity: "error")
    ErrorLoggingService.capture_with_context(
      exception,
      request: request,
      user: try(:current_user),
      extra: {
        source: "controller",
        severity: severity,
        controller_name: self.class.name,
        action_name: action_name
      }
    )
  end
end
