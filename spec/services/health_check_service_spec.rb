# frozen_string_literal: true

require "rails_helper"

RSpec.describe HealthCheckService, type: :service do
  describe "smoke test - service execution" do
    subject(:service) { described_class.call }

    it "executes successfully" do
      expect(service).to be_success
    end

    it "returns health status" do
      expect(service.result[:status]).to be_present
      expect(["healthy", "unhealthy"]).to include(service.result[:status])
    end

    it "includes check results" do
      expect(service.result[:checks]).to be_a(Hash)
      expect(service.result[:checks]).to have_key(:mongodb)
      expect(service.result[:checks]).to have_key(:app)
    end

    it "includes timestamp" do
      expect(service.result[:timestamp]).to be_present
    end

    it "includes version" do
      expect(service.result[:version]).to be_present
    end

    it "reports mongodb as connected" do
      expect(service.result[:checks][:mongodb]).to be true
    end

    it "reports app as running" do
      expect(service.result[:checks][:app]).to be true
    end
  end
end
