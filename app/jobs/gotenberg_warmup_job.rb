# frozen_string_literal: true

class GotenbergWarmupJob < ApplicationJob
  queue_as :low

  # Don't retry warmup pings - they'll run again on schedule
  discard_on StandardError

  INTERVAL = 10.minutes

  def perform
    result = GotenbergWarmupService.ping

    Rails.logger.info "[GotenbergWarmupJob] Gotenberg status: #{result[:available] ? 'available' : 'unavailable'} " \
                      "(#{result[:response_time_ms]}ms)"

    # Re-schedule self to keep Render free tier awake (sleeps after 15min inactivity)
    self.class.set(wait: INTERVAL).perform_later
  end
end
