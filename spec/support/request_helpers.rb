# frozen_string_literal: true

module RequestHelpers
  def json_response
    JSON.parse(response.body, symbolize_names: true)
  end

  def json_headers
    {
      "Content-Type" => "application/json",
      "Accept" => "application/json"
    }
  end

  def auth_headers(user)
    token = generate_jwt_token(user)
    json_headers.merge("Authorization" => "Bearer #{token}")
  end

  def login_user(user)
    post "/api/v1/auth/login",
         params: { user: { email: user.email, password: "password123" } }.to_json,
         headers: json_headers
    json_response[:token]
  end

  private

  def generate_jwt_token(user)
    Warden::JWTAuth::UserEncoder.new.call(user, :identity_user, nil).first
  rescue StandardError
    "test_token_#{user.id}"
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
