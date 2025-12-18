# frozen_string_literal: true

class ServiceResult
  attr_reader :data, :errors, :metadata

  def initialize(success:, data: nil, errors: [], metadata: {})
    @success = success
    @data = data
    @errors = Array(errors)
    @metadata = metadata
  end

  def self.success(data = nil, metadata: {})
    new(success: true, data: data, metadata: metadata)
  end

  def self.failure(errors, metadata: {})
    new(success: false, errors: Array(errors), metadata: metadata)
  end

  def success?
    @success
  end

  def failure?
    !success?
  end

  def error_messages
    errors.join(", ")
  end

  def to_h
    {
      success: success?,
      data: data,
      errors: errors,
      metadata: metadata
    }
  end
end
