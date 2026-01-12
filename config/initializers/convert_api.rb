# frozen_string_literal: true

# ConvertAPI configuration for DOCX to PDF conversion
# Get your API token from https://www.convertapi.com/a/authentication
if ENV["CONVERT_API_TOKEN"].present?
  ConvertApi.configure do |config|
    config.api_credentials = ENV["CONVERT_API_TOKEN"]
  end
end
