# frozen_string_literal: true

class ApplicationJob < ActiveJob::Base
  # Retry configuration
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Discard jobs when document not found (Mongoid equivalent)
  discard_on Mongoid::Errors::DocumentNotFound

  # Queue priority
  queue_with_priority 10

  # Logging
  around_perform do |job, block|
    Rails.logger.tagged("Job:#{job.class.name}", "JID:#{job.job_id}") do
      start_time = Time.current
      Rails.logger.info("Started job with args: #{job.arguments.inspect}")

      block.call

      duration = Time.current - start_time
      Rails.logger.info("Completed job in #{duration.round(2)}s")
    end
  rescue StandardError => e
    Rails.logger.error("Job failed: #{e.message}")
    Rails.logger.error(e.backtrace&.first(10)&.join("\n"))
    raise
  end

  protected

  def log_info(message)
    Rails.logger.info("[#{self.class.name}] #{message}")
  end

  def log_error(message)
    Rails.logger.error("[#{self.class.name}] #{message}")
  end
end
