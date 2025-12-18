# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Health", type: :request do
  describe "smoke test - API endpoint" do
    describe "GET /api/v1/health" do
      it "returns successful response" do
        get "/api/v1/health"

        expect(response).to have_http_status(:ok)
      end

      it "returns JSON content type" do
        get "/api/v1/health"

        expect(response.content_type).to include("application/json")
      end

      it "returns health status" do
        get "/api/v1/health"

        json = JSON.parse(response.body, symbolize_names: true)
        expect(json[:status]).to eq("healthy").or eq("unhealthy")
      end

      it "returns checks hash" do
        get "/api/v1/health"

        json = JSON.parse(response.body, symbolize_names: true)
        expect(json[:checks]).to be_a(Hash)
        expect(json[:checks]).to have_key(:mongodb)
        expect(json[:checks]).to have_key(:app)
      end

      it "returns timestamp" do
        get "/api/v1/health"

        json = JSON.parse(response.body, symbolize_names: true)
        expect(json[:timestamp]).to be_present
      end

      it "returns version" do
        get "/api/v1/health"

        json = JSON.parse(response.body, symbolize_names: true)
        expect(json[:version]).to be_present
      end

      it "confirms MongoDB is connected" do
        get "/api/v1/health"

        json = JSON.parse(response.body, symbolize_names: true)
        expect(json[:checks][:mongodb]).to be true
      end
    end
  end
end
