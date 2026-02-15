# frozen_string_literal: true

# Schedule Gotenberg warmup job to keep Render free tier awake.
# Only runs in production/staging where GOTENBERG_URL is configured.
Rails.application.config.after_initialize do
  if ENV["GOTENBERG_URL"].present? && Rails.env.production?
    Rails.logger.info "[GotenbergWarmup] Scheduling initial warmup in 30s..."
    GotenbergWarmupJob.set(wait: 30.seconds).perform_later
  end
end
