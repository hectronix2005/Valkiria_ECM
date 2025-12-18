# frozen_string_literal: true

require "rails_helper"

RSpec.describe ServiceResult do
  describe ".success" do
    it "creates a successful result" do
      result = described_class.success("data")
      expect(result.success?).to be true
      expect(result.data).to eq("data")
    end

    it "accepts optional metadata" do
      result = described_class.success("data", metadata: { count: 10 })
      expect(result.metadata).to eq({ count: 10 })
    end

    it "has empty errors" do
      result = described_class.success
      expect(result.errors).to be_empty
    end
  end

  describe ".failure" do
    it "creates a failed result" do
      result = described_class.failure("error message")
      expect(result.failure?).to be true
      expect(result.errors).to eq(["error message"])
    end

    it "accepts array of errors" do
      result = described_class.failure(["error 1", "error 2"])
      expect(result.errors).to eq(["error 1", "error 2"])
    end

    it "accepts optional metadata" do
      result = described_class.failure("error", metadata: { code: "E001" })
      expect(result.metadata).to eq({ code: "E001" })
    end

    it "has nil data" do
      result = described_class.failure("error")
      expect(result.data).to be_nil
    end
  end

  describe "#success?" do
    it "returns true for successful result" do
      result = described_class.success
      expect(result.success?).to be true
    end

    it "returns false for failed result" do
      result = described_class.failure("error")
      expect(result.success?).to be false
    end
  end

  describe "#failure?" do
    it "returns false for successful result" do
      result = described_class.success
      expect(result.failure?).to be false
    end

    it "returns true for failed result" do
      result = described_class.failure("error")
      expect(result.failure?).to be true
    end
  end

  describe "#error_messages" do
    it "joins errors with comma" do
      result = described_class.failure(["error 1", "error 2"])
      expect(result.error_messages).to eq("error 1, error 2")
    end

    it "returns empty string for no errors" do
      result = described_class.success
      expect(result.error_messages).to eq("")
    end
  end

  describe "#to_h" do
    it "returns hash representation" do
      result = described_class.success("data", metadata: { key: "value" })

      expect(result.to_h).to eq({
        success: true,
        data: "data",
        errors: [],
        metadata: { key: "value" }
      })
    end
  end
end
