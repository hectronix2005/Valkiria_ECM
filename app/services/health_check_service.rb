# frozen_string_literal: true

class HealthCheckService < BaseService
  def call
    checks = {
      mongodb: check_mongodb,
      redis: check_redis,
      app: app_running?
    }

    status = checks.values.all? ? "healthy" : "unhealthy"

    success(
      status: status,
      checks: checks,
      timestamp: Time.current.iso8601,
      version: app_version
    )
  rescue StandardError => e
    log_error("Health check failed: #{e.message}")
    failure("Health check failed: #{e.message}")
  end

  private

  def check_mongodb
    HealthCheck.mongodb_connected?
  rescue StandardError
    false
  end

  def check_redis
    return false unless defined?(Redis)

    redis_url = ENV.fetch("REDIS_URL", "redis://localhost:6379/1")
    Redis.new(url: redis_url).ping == "PONG"
  rescue StandardError
    false
  end

  def app_running?
    Rails.application.present?
  end

  def app_version
    ENV.fetch("APP_VERSION", "development")
  end
end
