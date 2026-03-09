# frozen_string_literal: true

redis_config = {
  url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1"),
  network_timeout: 5
}

# Heroku Redis uses rediss:// URLs requiring SSL
if redis_config[:url]&.start_with?("rediss://")
  redis_config[:ssl_params] = if ENV["REDIS_SSL_VERIFY"] == "none"
                                 { verify_mode: OpenSSL::SSL::VERIFY_NONE }
                               else
                                 { verify_mode: OpenSSL::SSL::VERIFY_PEER }
                               end
end

Sidekiq.configure_server do |config|
  config.redis = redis_config
  config.logger.level = Rails.env.production? ? Logger::INFO : Logger::DEBUG

  # Load cron jobs from sidekiq_cron.yml
  config.on(:startup) do
    schedule_file = Rails.root.join("config", "sidekiq_cron.yml")
    if File.exist?(schedule_file)
      schedule = YAML.load_file(schedule_file)
      Sidekiq::Cron::Job.load_from_hash(schedule)
      Rails.logger.info("[SIDEKIQ] #{schedule.keys.size} cron jobs loaded")
    end
  end
end

Sidekiq.configure_client do |config|
  config.redis = redis_config
end

# Default job options
Sidekiq.default_job_options = {
  "retry" => 3,
  "backtrace" => true
}
