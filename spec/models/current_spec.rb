# frozen_string_literal: true

require "rails_helper"

RSpec.describe Current do
  after { described_class.reset }

  describe "attributes" do
    it "has user attribute" do
      expect(described_class).to respond_to(:user)
      expect(described_class).to respond_to(:user=)
    end

    it "has organization attribute" do
      expect(described_class).to respond_to(:organization)
      expect(described_class).to respond_to(:organization=)
    end

    it "has request_id attribute" do
      expect(described_class).to respond_to(:request_id)
      expect(described_class).to respond_to(:request_id=)
    end

    it "has ip_address attribute" do
      expect(described_class).to respond_to(:ip_address)
      expect(described_class).to respond_to(:ip_address=)
    end

    it "has user_agent attribute" do
      expect(described_class).to respond_to(:user_agent)
      expect(described_class).to respond_to(:user_agent=)
    end
  end

  describe "#user=" do
    it "sets time zone from user's time zone" do
      user = double("User", time_zone: "America/New_York")
      described_class.user = user
      expect(Time.zone.name).to eq("America/New_York")
    end

    it "defaults to UTC when user has no time zone" do
      user = double("User", time_zone: nil)
      described_class.user = user
      expect(Time.zone.name).to eq("UTC")
    end

    it "defaults to UTC when user is nil" do
      described_class.user = nil
      expect(Time.zone.name).to eq("UTC")
    end
  end

  describe ".reset" do
    it "clears all attributes" do
      described_class.user = double("User", time_zone: nil)
      described_class.request_id = "test-id"
      described_class.ip_address = "127.0.0.1"

      described_class.reset

      expect(described_class.user).to be_nil
      expect(described_class.request_id).to be_nil
      expect(described_class.ip_address).to be_nil
    end

    it "resets time zone to UTC" do
      Time.zone = "America/Los_Angeles"
      described_class.reset
      expect(Time.zone.name).to eq("UTC")
    end
  end
end
