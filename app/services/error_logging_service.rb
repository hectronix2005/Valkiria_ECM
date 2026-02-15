# frozen_string_literal: true

class ErrorLoggingService
  # Log a Ruby exception (500s, unhandled errors)
  def self.capture(exception, context = {})
    System::ErrorLog.create(
      error_class: exception.class.name,
      message: exception.message.truncate(5000),
      backtrace: Array(exception.backtrace).first(50),
      source: context[:source] || "unknown",
      severity: context[:severity] || "error",
      event_type: "exception",
      http_status: context[:http_status],
      controller_name: context[:controller_name],
      action_name: context[:action_name],
      request_path: context[:request_path],
      request_method: context[:request_method],
      request_params: sanitize_params(context[:request_params] || {}),
      user_id: context[:user_id],
      user_email: context[:user_email],
      ip_address: context[:ip_address] || Current.ip_address,
      user_agent: context[:user_agent] || Current.user_agent,
      request_id: context[:request_id] || Current.request_id,
      metadata: context[:metadata] || {}
    )
  rescue StandardError => e
    Rails.logger.error("[ErrorLoggingService] Failed to log error: #{e.message}")
  end

  # Log a non-exception event (validation failure, business logic error, process failure)
  def self.log_event(message, context = {})
    System::ErrorLog.create(
      error_class: context[:error_class] || context[:event_type]&.titleize || "ProcessFailure",
      message: message.to_s.truncate(5000),
      backtrace: [],
      source: context[:source] || "controller",
      severity: context[:severity] || "warning",
      event_type: context[:event_type] || "process_failure",
      http_status: context[:http_status],
      response_body: context[:response_body]&.truncate(5000),
      controller_name: context[:controller_name],
      action_name: context[:action_name],
      request_path: context[:request_path],
      request_method: context[:request_method],
      request_params: sanitize_params(context[:request_params] || {}),
      user_id: context[:user_id],
      user_email: context[:user_email],
      ip_address: context[:ip_address] || Current.ip_address,
      user_agent: context[:user_agent] || Current.user_agent,
      request_id: context[:request_id] || Current.request_id,
      metadata: context[:metadata] || {}
    )
  rescue StandardError => e
    Rails.logger.error("[ErrorLoggingService] Failed to log event: #{e.message}")
  end

  # Helper: capture exception with request/user context
  def self.capture_with_context(exception, request: nil, user: nil, extra: {})
    context = extra.dup
    context[:source] ||= "controller"
    enrich_from_request(context, request)
    enrich_from_user(context, user)
    capture(exception, context)
  end

  # Helper: log event with request/user context
  def self.log_event_with_context(message, request: nil, user: nil, extra: {})
    context = extra.dup
    context[:source] ||= "controller"
    enrich_from_request(context, request)
    enrich_from_user(context, user)
    log_event(message, context)
  end

  # Auto-log from an HTTP error response (called by after_action)
  def self.log_response(status:, body:, request: nil, user: nil, controller_name: nil, action_name: nil)
    parsed = begin
      JSON.parse(body)
    rescue StandardError
      {}
    end

    error_message = parsed["error"] || parsed["errors"]&.first || "HTTP #{status}"
    errors_list = Array(parsed["errors"])

    event_type = classify_event_type(status, parsed)
    severity = classify_severity(status)

    log_event_with_context(
      error_message,
      request: request,
      user: user,
      extra: {
        event_type: event_type,
        severity: severity,
        http_status: status,
        response_body: body.truncate(2000),
        controller_name: controller_name,
        action_name: action_name,
        metadata: {
          errors: errors_list.first(10),
          missing_variables: parsed["missing_variables"],
          action_required: parsed["action_required"]
        }.compact
      }
    )
  end

  # Convenience: capture exception from a service
  def self.capture_service_error(exception, service:, severity: "error", metadata: {})
    capture(exception,
      source: "service",
      severity: severity,
      metadata: metadata.merge(service_class: service)
    )
  end

  # Convenience: log non-exception event from a service
  def self.log_service_event(message, service:, severity: "warning", event_type: "process_failure", metadata: {})
    log_event(message,
      source: "service",
      severity: severity,
      event_type: event_type,
      metadata: metadata.merge(service_class: service)
    )
  end

  # Convenience: capture exception from a background job
  def self.capture_job_error(exception, job_class:, job_id: nil, arguments: [], metadata: {})
    capture(exception,
      source: "job",
      severity: "error",
      metadata: metadata.merge(
        job_class: job_class,
        job_id: job_id,
        job_arguments: arguments.inspect.truncate(500)
      )
    )
  end

  # Convenience: capture frontend error reported by browser
  def self.capture_frontend_error(message:, error_class: "FrontendError", backtrace: [], url: nil, user_agent: nil, metadata: {})
    System::ErrorLog.create(
      error_class: error_class.to_s.truncate(500),
      message: message.to_s.truncate(5000),
      backtrace: Array(backtrace).first(50),
      source: "frontend",
      severity: "error",
      event_type: "frontend_error",
      request_path: url&.truncate(2000),
      user_agent: user_agent&.truncate(1000),
      ip_address: Current.ip_address,
      request_id: Current.request_id,
      metadata: metadata
    )
  rescue StandardError => e
    Rails.logger.error("[ErrorLoggingService] Failed to log frontend error: #{e.message}")
  end

  # --- Private helpers ---

  def self.enrich_from_request(context, request)
    return unless request

    context[:request_path] = request.path
    context[:request_method] = request.method
    context[:ip_address] = request.remote_ip
    context[:user_agent] = request.user_agent
    context[:request_id] = request.request_id
    context[:request_params] = request.filtered_parameters.except("controller", "action").to_h
  end
  private_class_method :enrich_from_request

  def self.enrich_from_user(context, user)
    return unless user

    context[:user_id] = user.id.to_s
    context[:user_email] = user.email
  end
  private_class_method :enrich_from_user

  def self.classify_event_type(status, parsed_body)
    case status
    when 401 then "auth_failure"
    when 403 then "auth_failure"
    when 404 then "not_found"
    when 422
      if parsed_body["missing_variables"].present?
        "process_failure"
      elsif parsed_body["errors"].present?
        "validation_error"
      else
        "process_failure"
      end
    when 409 then "process_failure"
    when 423 then "process_failure"
    when 500..599 then "exception"
    else "api_error"
    end
  end
  private_class_method :classify_event_type

  def self.classify_severity(status)
    case status
    when 400..404 then "info"
    when 405..499 then "warning"
    when 500..599 then "error"
    else "info"
    end
  end
  private_class_method :classify_severity

  def self.sanitize_params(params)
    sensitive_keys = %w[password password_confirmation token secret api_key current_password new_password]
    params.to_h.transform_values { |v| v.is_a?(Hash) ? sanitize_params(v) : v }
         .each_with_object({}) do |(k, v), h|
      h[k] = sensitive_keys.include?(k.to_s) ? "[FILTERED]" : v
    end
  rescue StandardError
    {}
  end
  private_class_method :sanitize_params
end
