# frozen_string_literal: true

source "https://rubygems.org"

ruby "~> 3.4.0"

# Core Framework
gem "bootsnap", require: false
gem "puma", ">= 5.0"
gem "rails", "~> 7.2.3"

# MongoDB ODM
gem "mongoid", "~> 9.0"
gem "mongoid-grid_fs", "~> 2.5"  # GridFS for file storage

# Authentication & Authorization
gem "devise", "~> 4.9"
gem "devise-jwt", "~> 0.12"
gem "pundit", "~> 2.4"

# Background Jobs
gem "redis", ">= 4.0.1"
gem "sidekiq", "~> 7.3"

# API & Serialization
gem "jsonapi-serializer", "~> 2.2"
gem "rack-cors", "~> 2.0"

# API Documentation
gem "rswag-api", "~> 2.14"
gem "rswag-ui", "~> 2.14"

# Security
gem "bcrypt", "~> 3.1.7"

# Utilities
gem "oj", "~> 3.16" # Fast JSON parsing
gem "tzinfo-data", platforms: [:windows, :jruby]

# Document Processing & PDF Generation
gem "docx", "~> 0.8"           # Read/write Word documents
gem "prawn", "~> 2.4"          # PDF generation
gem "prawn-table", "~> 0.2"    # PDF tables
gem "combine_pdf", "~> 1.0"    # PDF manipulation
gem "mini_magick", "~> 4.12"   # Image processing for signatures
gem "convert_api", "~> 1.4"    # Cloud DOCX to PDF conversion

group :development, :test do
  gem "brakeman", require: false
  gem "debug", platforms: [:mri, :windows], require: "debug/prelude"

  # Testing
  gem "database_cleaner-mongoid", "~> 2.0"
  gem "factory_bot_rails", "~> 6.4"
  gem "faker", "~> 3.5"
  gem "mongoid-rspec", "~> 4.2"
  gem "rspec-rails", "~> 7.1"
  gem "shoulda-matchers", "~> 6.4"

  # Code Quality
  gem "rubocop", "~> 1.69", require: false
  gem "rubocop-performance", "~> 1.23", require: false
  gem "rubocop-rails", "~> 2.27", require: false
  gem "rubocop-rspec", "~> 3.3", require: false
end

group :test do
  gem "simplecov", "~> 0.22", require: false
  gem "timecop", "~> 0.9"
  gem "webmock", "~> 3.24"
end

group :development do
  gem "listen", "~> 3.9"
end
