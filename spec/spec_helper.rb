# frozen_string_literal: true

# SimpleCov must be started before any application code is loaded
require "simplecov"
SimpleCov.start "rails" do
  add_filter "/spec/"
  add_filter "/config/"
  add_filter "/vendor/"

  add_group "Models", "app/models"
  add_group "Controllers", "app/controllers"
  add_group "Services", "app/services"
  add_group "Policies", "app/policies"
  add_group "Jobs", "app/jobs"
  add_group "Validators", "app/validators"
  add_group "Lib", "lib"

  # Coverage requirements will increase as we add more features
  # Phase 0: Foundation - 50%
  # Phase 1+: Target 80%
  minimum_coverage 50
end

RSpec.configure do |config|
  # Expectations configuration
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
    expectations.syntax = :expect
  end

  # Mocks configuration
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
    mocks.verify_doubled_constant_names = true
  end

  # Shared context behavior
  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Focus filter
  config.filter_run_when_matching :focus

  # Persist example status for --only-failures
  config.example_status_persistence_file_path = "spec/examples.txt"

  # Disable monkey patching
  config.disable_monkey_patching!

  # Verbose output for single file runs
  config.default_formatter = "doc" if config.files_to_run.one?

  # Profile slow examples
  config.profile_examples = 10

  # Random order
  config.order = :random
  Kernel.srand config.seed

  # Fail fast in CI
  config.fail_fast = ENV.fetch("CI", nil) == "true"

  # Better error output
  config.full_backtrace = false
end
