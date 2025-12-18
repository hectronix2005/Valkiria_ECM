# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Auth::Sessions" do
  describe "POST /api/v1/auth/login" do
    let!(:user) { create(:user, email: "test@example.com", password: "password123") }

    context "with valid credentials" do
      it "returns success with token" do
        post "/api/v1/auth/login",
             params: { user: { email: "test@example.com", password: "password123" } }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:ok)
        expect(json_response[:token]).to be_present
        expect(json_response[:data][:email]).to eq("test@example.com")
      end

      it "returns user data" do
        post "/api/v1/auth/login",
             params: { user: { email: user.email, password: "password123" } }.to_json,
             headers: json_headers

        expect(json_response[:data]).to include(
          id: user.id.to_s,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        )
      end

      it "returns roles and permissions" do
        admin_role = create(:role, :admin)
        user.roles << admin_role

        post "/api/v1/auth/login",
             params: { user: { email: user.email, password: "password123" } }.to_json,
             headers: json_headers

        expect(json_response[:data][:roles]).to include("admin")
      end
    end

    context "with invalid credentials" do
      it "returns unauthorized for wrong password" do
        post "/api/v1/auth/login",
             params: { user: { email: user.email, password: "wrongpassword" } }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:unauthorized)
        expect(json_response[:error]).to eq("Invalid email or password")
      end

      it "returns unauthorized for non-existent email" do
        post "/api/v1/auth/login",
             params: { user: { email: "nonexistent@example.com", password: "password123" } }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:unauthorized)
        expect(json_response[:error]).to eq("Invalid email or password")
      end
    end

    context "with inactive account" do
      let!(:inactive_user) { create(:user, :inactive, email: "inactive@example.com") }

      it "returns unauthorized" do
        post "/api/v1/auth/login",
             params: { user: { email: "inactive@example.com", password: "password123" } }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:unauthorized)
        expect(json_response[:error]).to eq("Account is deactivated")
      end
    end
  end

  describe "GET /api/v1/auth/me" do
    let!(:user) { create(:user) }

    context "when authenticated" do
      it "returns current user data" do
        get "/api/v1/auth/me", headers: auth_headers(user)

        expect(response).to have_http_status(:ok)
        expect(json_response[:data][:email]).to eq(user.email)
      end
    end

    context "when not authenticated" do
      it "returns unauthorized" do
        get "/api/v1/auth/me", headers: json_headers

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "DELETE /api/v1/auth/logout" do
    let!(:user) { create(:user) }

    context "when authenticated" do
      it "returns success" do
        delete "/api/v1/auth/logout", headers: auth_headers(user)

        expect(response).to have_http_status(:ok)
        expect(json_response[:message]).to eq("Logged out successfully")
      end

      it "revokes the JWT token" do
        headers = auth_headers(user)
        delete "/api/v1/auth/logout", headers: headers

        expect(Identity::JwtDenylist.count).to be >= 1
      end
    end

    context "when not authenticated" do
      it "returns unauthorized" do
        delete "/api/v1/auth/logout", headers: json_headers

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
