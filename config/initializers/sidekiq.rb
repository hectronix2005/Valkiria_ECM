# frozen_string_literal: true

Sidekiq.configure_server do |config|
  config.redis = {
    url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1"),
    network_timeout: 5
  }

  config.logger.level = Rails.env.production? ? Logger::INFO : Logger::DEBUG
end

Sidekiq.configure_client do |config|
  config.redis = {
    url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1"),
    network_timeout: 5
  }
end

# Default job options
Sidekiq.default_job_options = {
  "retry" => 3,
  "backtrace" => true
}
