# frozen_string_literal: true

require "spec_helper"

ENV["RAILS_ENV"] ||= "test"

require_relative "../config/environment"
abort("The Rails environment is running in production mode!") if Rails.env.production?

require "rspec/rails"
require "pundit/rspec"

# Load support files
Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }

RSpec.configure do |config|
  # Disable ActiveRecord (we use Mongoid)
  config.use_active_record = false

  # Use ActiveJob test adapter for job testing
  config.include ActiveJob::TestHelper
  config.before do
    ActiveJob::Base.queue_adapter = :test
  end

  # Include FactoryBot syntax methods
  config.include FactoryBot::Syntax::Methods

  # Infer spec type from file location
  config.infer_spec_type_from_file_location!

  # Filter Rails backtrace
  config.filter_rails_from_backtrace!

  # Run specs in random order
  config.order = :random
  Kernel.srand config.seed

  # Configure metadata
  config.define_derived_metadata(file_path: %r{/spec/requests/}) do |metadata|
    metadata[:type] = :request
  end

  config.define_derived_metadata(file_path: %r{/spec/jobs/}) do |metadata|
    metadata[:type] = :job
  end

  config.define_derived_metadata(file_path: %r{/spec/policies/}) do |metadata|
    metadata[:type] = :policy
  end

  config.define_derived_metadata(file_path: %r{/spec/services/}) do |metadata|
    metadata[:type] = :service
  end
end
