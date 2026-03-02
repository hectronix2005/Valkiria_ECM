# frozen_string_literal: true

# Rate limiting and request throttling
class Rack::Attack
  # Throttle login attempts by IP — 10 attempts per 60 seconds
  throttle("login/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.path == "/api/v1/auth/login" && req.post?
  end

  # Throttle login attempts by email — 5 attempts per 60 seconds
  throttle("login/email", limit: 5, period: 60.seconds) do |req|
    if req.path == "/api/v1/auth/login" && req.post?
      body = begin
        JSON.parse(req.body.read.tap { req.body.rewind })
      rescue JSON::ParserError
        {}
      end
      (body["email"] || body.dig("user", "email"))&.downcase&.strip
    end
  end

  # Throttle password reset requests — 3 per 60 seconds per IP
  throttle("password_reset/ip", limit: 3, period: 60.seconds) do |req|
    req.ip if req.path == "/api/v1/auth/password" && req.post?
  end

  # Throttle API requests per IP — 300 requests per minute
  throttle("api/ip", limit: 300, period: 60.seconds) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  # Throttle frontend error reports — 20 per minute per IP
  throttle("frontend_errors/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.path == "/api/v1/frontend_errors" && req.post?
  end

  # Custom response for throttled requests
  self.throttled_responder = lambda do |matched, _period, limit, count, env|
    now = Time.current
    match_data = env["rack.attack.match_data"] || {}

    headers = {
      "Content-Type" => "application/json",
      "Retry-After" => (match_data[:period] || 60).to_s
    }

    body = [{
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later."
    }.to_json]

    [429, headers, body]
  end
end

# Use Rails cache as the store (defaults to memory store in dev, Redis in production)
Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new if Rails.env.development? || Rails.env.test?
