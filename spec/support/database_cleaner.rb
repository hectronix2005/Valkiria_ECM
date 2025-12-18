# frozen_string_literal: true

require "database_cleaner-mongoid"

RSpec.configure do |config|
  config.before(:suite) do
    DatabaseCleaner[:mongoid].strategy = :deletion
    DatabaseCleaner[:mongoid].clean_with(:deletion)
  end

  config.before do
    DatabaseCleaner[:mongoid].start
  end

  config.after do
    DatabaseCleaner[:mongoid].clean
  end
end
