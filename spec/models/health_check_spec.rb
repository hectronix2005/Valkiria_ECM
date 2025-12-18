# frozen_string_literal: true

require "rails_helper"

RSpec.describe HealthCheck, type: :model do
  describe "smoke test - MongoDB connection" do
    it "can create and persist a document" do
      health_check = described_class.create!(status: "ok")

      expect(health_check).to be_persisted
      expect(health_check.id).to be_present
      expect(health_check.status).to eq("ok")
      expect(health_check.checked_at).to be_present
    end

    it "can query documents" do
      described_class.create!(status: "ok")

      expect(described_class.count).to be >= 1
      expect(described_class.exists?(status: "ok")).to be true
    end

    it "validates status inclusion" do
      invalid = described_class.new(status: "invalid_status")

      expect(invalid).not_to be_valid
      expect(invalid.errors[:status]).to be_present
    end
  end

  describe ".ping" do
    it "returns true when MongoDB is accessible" do
      expect(described_class.ping).to be true
    end
  end

  describe ".mongodb_connected?" do
    it "returns true when connected" do
      expect(described_class.mongodb_connected?).to be true
    end
  end
end
