# frozen_string_literal: true

class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :set_request_context

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

  def handle_unauthorized(exception)
    render_error(
      "You are not authorized to perform this action",
      status: :forbidden,
      errors: [exception.message]
    )
  end

  def handle_not_found(exception)
    render_error(
      "Resource not found",
      status: :not_found,
      errors: [exception.message]
    )
  end

  def handle_bad_request(exception)
    render_error(
      "Bad request",
      status: :bad_request,
      errors: [exception.message]
    )
  end
end
