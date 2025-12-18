# frozen_string_literal: true

class BaseService
  attr_reader :result, :errors

  def self.call(...)
    new(...).call
  end

  def initialize
    @result = nil
    @errors = []
  end

  def call
    raise NotImplementedError, "#{self.class}#call must be implemented"
  end

  def success?
    errors.empty?
  end

  def failure?
    !success?
  end

  protected

  def success(result = nil)
    @result = result
    self
  end

  def failure(error_or_errors)
    case error_or_errors
    when Array
      @errors.concat(error_or_errors)
    when ActiveModel::Errors
      @errors.concat(error_or_errors.full_messages)
    else
      @errors << error_or_errors.to_s
    end
    self
  end

  def add_error(message)
    @errors << message
  end

  def current_user
    Current.user
  end

  def current_organization
    Current.organization
  end

  def log_info(message, **metadata)
    Rails.logger.info("[#{self.class.name}] #{message}", **metadata)
  end

  def log_error(message, **metadata)
    Rails.logger.error("[#{self.class.name}] #{message}", **metadata)
  end

  def log_warn(message, **metadata)
    Rails.logger.warn("[#{self.class.name}] #{message}", **metadata)
  end
end
