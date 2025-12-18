# frozen_string_literal: true

class HealthCheck
  include Mongoid::Document
  include Mongoid::Timestamps

  store_in collection: "health_checks"

  field :status, type: String, default: "ok"
  field :checked_at, type: Time

  validates :status, presence: true, inclusion: { in: ["ok", "degraded", "error"] }

  before_create :set_checked_at

  def self.ping
    create!(status: "ok")
    true
  rescue StandardError
    false
  end

  def self.mongodb_connected?
    Mongoid.default_client.command(ping: 1).ok?
  rescue StandardError
    false
  end

  private

  def set_checked_at
    self.checked_at = Time.current
  end
end
