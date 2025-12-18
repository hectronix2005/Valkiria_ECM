# frozen_string_literal: true

class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :organization
  attribute :request_id
  attribute :ip_address
  attribute :user_agent

  resets do
    Time.zone = "UTC"
  end

  def user=(value)
    super
    Time.zone = value&.time_zone || "UTC"
  end
end
