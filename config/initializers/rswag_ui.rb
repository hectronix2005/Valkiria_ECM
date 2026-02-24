Rswag::Ui.configure do |c|
  c.swagger_endpoint '/api-docs/v1/swagger.yaml', 'API V1 Docs'

  # Protect API docs with basic auth in production
  if Rails.env.production? && ENV["SWAGGER_USER"].present? && ENV["SWAGGER_PASS"].present?
    c.basic_auth_enabled = true
    c.basic_auth_credentials ENV["SWAGGER_USER"], ENV["SWAGGER_PASS"]
  end
end
