# frozen_string_literal: true

redis_config = {
  url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1"),
  network_timeout: 5
}

# Heroku Redis uses self-signed certificates with rediss:// URLs
if redis_config[:url]&.start_with?("rediss://")
  redis_config[:ssl_params] = { verify_mode: OpenSSL::SSL::VERIFY_NONE }
end

Sidekiq.configure_server do |config|
  config.redis = redis_config
  config.logger.level = Rails.env.production? ? Logger::INFO : Logger::DEBUG
end

Sidekiq.configure_client do |config|
  config.redis = redis_config
end

# Default job options
Sidekiq.default_job_options = {
  "retry" => 3,
  "backtrace" => true
}
