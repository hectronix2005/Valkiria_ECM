# frozen_string_literal: true

class HealthCheckService < BaseService
  def call
    checks = {
      mongodb: check_mongodb,
      redis: check_redis,
      app: app_running?
    }

    # External services (non-blocking: don't affect overall status)
    gotenberg_status = check_gotenberg
    checks[:gotenberg] = gotenberg_status unless gotenberg_status.nil?

    # Only core checks determine healthy/unhealthy
    core_healthy = checks[:mongodb] && checks[:redis] && checks[:app]
    status = core_healthy ? "healthy" : "unhealthy"

    success(
      status: status,
      checks: checks,
      timestamp: Time.current.iso8601,
      version: app_version
    )
  rescue StandardError => e
    log_error("Health check failed: #{e.message}")
    ErrorLoggingService.capture_service_error(e,
      service: "HealthCheckService",
      metadata: {}
    )
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

  def check_gotenberg
    return nil if ENV["GOTENBERG_URL"].blank?

    require "net/http"
    require "uri"

    uri = URI.parse("#{ENV['GOTENBERG_URL'].chomp('/')}/health")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = 5
    http.read_timeout = 5

    response = http.get(uri.request_uri)
    response.code.to_i < 300
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
