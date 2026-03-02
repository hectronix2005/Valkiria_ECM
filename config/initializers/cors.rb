# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

cors_origins = [
  "localhost:5173",
  "127.0.0.1:5173"
]

if ENV["CORS_ORIGINS"].present?
  cors_origins += ENV["CORS_ORIGINS"].split(",").map(&:strip)
end

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*cors_origins)

    resource "*",
      headers: %w[Authorization Content-Type Accept X-Employee-Mode X-Requested-With],
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ["Authorization"],
      credentials: true,
      max_age: 7200
  end
end
