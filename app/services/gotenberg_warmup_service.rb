# frozen_string_literal: true

class GotenbergWarmupService
  GOTENBERG_URL = ENV["GOTENBERG_URL"]

  # Ping Gotenberg health endpoint
  # Returns { available: bool, response_time_ms: float, error: string|nil }
  def self.ping
    return { available: false, response_time_ms: nil, error: "GOTENBERG_URL not configured" } if GOTENBERG_URL.blank?

    require "net/http"
    require "uri"

    url = GOTENBERG_URL.chomp("/")
    uri = URI.parse("#{url}/health")

    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = 30
    http.read_timeout = 10

    response = http.get(uri.request_uri)
    elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round(1)

    if response.code.to_i < 300
      Rails.logger.info "[GotenbergWarmup] Ping OK (#{elapsed_ms}ms)"
      { available: true, response_time_ms: elapsed_ms, error: nil }
    else
      Rails.logger.warn "[GotenbergWarmup] Ping failed: HTTP #{response.code} (#{elapsed_ms}ms)"
      { available: false, response_time_ms: elapsed_ms, error: "HTTP #{response.code}" }
    end
  rescue StandardError => e
    elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round(1) rescue nil
    Rails.logger.warn "[GotenbergWarmup] Ping error: #{e.class}: #{e.message}"
    { available: false, response_time_ms: elapsed_ms, error: "#{e.class}: #{e.message}" }
  end

  # Warm up Gotenberg: ping, if unavailable wait and retry once (wakes cold-start services)
  def self.warm!
    result = ping
    return result if result[:available]

    Rails.logger.info "[GotenbergWarmup] First ping failed, waiting 5s for cold start..."
    sleep(5)

    result = ping
    if result[:available]
      Rails.logger.info "[GotenbergWarmup] Service warmed up successfully after retry"
    else
      Rails.logger.warn "[GotenbergWarmup] Service still unavailable after retry: #{result[:error]}"
    end
    result
  end
end
