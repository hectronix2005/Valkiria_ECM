# frozen_string_literal: true

module Audit
  class LogEventService < BaseService
    def initialize(event_type:, action:, target: nil, actor: nil, change_data: {}, metadata: {}, tags: [])
      super()
      @event_type = event_type
      @action = action
      @target = target
      @actor = actor || Current.user
      @change_data = change_data
      @metadata = metadata
      @tags = Array(tags)
    end

    def call
      event = AuditEvent.log(
        event_type: @event_type,
        action: @action,
        target: @target,
        actor: @actor,
        change_data: @change_data,
        metadata: @metadata,
        tags: @tags
      )

      success(event)
    rescue StandardError => e
      log_error("Failed to create audit event: #{e.message}")
      failure("Failed to create audit event: #{e.message}")
    end
  end
end
