# frozen_string_literal: true

require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_view/railtie"
require "action_cable/engine"

Bundler.require(*Rails.groups)

module ValkyriaEcm
  class Application < Rails::Application
    config.load_defaults 7.2

    config.autoload_lib(ignore: ["assets", "tasks"])

    # API-only mode
    config.api_only = true

    # Time zone
    config.time_zone = "UTC"

    # Active Job queue adapter
    config.active_job.queue_adapter = :sidekiq

    # Default queue name
    config.active_job.queue_name_prefix = "valkyria_ecm"
    config.active_job.queue_name_delimiter = "_"

    # Generators configuration
    config.generators do |g|
      g.orm :mongoid
      g.test_framework :rspec,
        fixtures: false,
        view_specs: false,
        helper_specs: false,
        routing_specs: false
      g.fixture_replacement :factory_bot, dir: "spec/factories"
    end

    # Autoload paths for services, policies, validators
    config.autoload_paths += [
      Rails.root.join("app/services"),
      Rails.root.join("app/policies"),
      Rails.root.join("app/validators"),
      Rails.root.join("lib/ecm")
    ]

    # CORS configuration (for API)
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins "*"
        resource "*",
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          expose: ["Authorization"]
      end
    end
  end
end
