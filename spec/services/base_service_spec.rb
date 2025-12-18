# frozen_string_literal: true

require "rails_helper"

RSpec.describe BaseService do
  let(:test_service_class) do
    Class.new(described_class) do
      def initialize(value)
        super()
        @value = value
      end

      def call
        if @value.positive?
          success(@value * 2)
        else
          failure("Value must be positive")
        end
      end
    end
  end

  describe ".call" do
    it "creates instance and calls #call" do
      result = test_service_class.call(5)
      expect(result).to be_success
      expect(result.result).to eq(10)
    end
  end

  describe "#call" do
    it "raises NotImplementedError on base class" do
      expect { described_class.new.call }
        .to raise_error(NotImplementedError, "BaseService#call must be implemented")
    end
  end

  describe "#success?" do
    it "returns true when no errors" do
      result = test_service_class.call(5)
      expect(result.success?).to be true
    end

    it "returns false when errors present" do
      result = test_service_class.call(-1)
      expect(result.success?).to be false
    end
  end

  describe "#failure?" do
    it "returns false when no errors" do
      result = test_service_class.call(5)
      expect(result.failure?).to be false
    end

    it "returns true when errors present" do
      result = test_service_class.call(-1)
      expect(result.failure?).to be true
    end
  end

  describe "#result" do
    it "returns the success value" do
      service = test_service_class.call(5)
      expect(service.result).to eq(10)
    end

    it "returns nil on failure" do
      service = test_service_class.call(-1)
      expect(service.result).to be_nil
    end
  end

  describe "#errors" do
    it "returns empty array on success" do
      service = test_service_class.call(5)
      expect(service.errors).to be_empty
    end

    it "returns error messages on failure" do
      service = test_service_class.call(-1)
      expect(service.errors).to include("Value must be positive")
    end
  end

  describe "#failure with different error types" do
    let(:error_service_class) do
      Class.new(described_class) do
        attr_accessor :error_input

        def initialize(error_input)
          super()
          @error_input = error_input
        end

        def call
          failure(error_input)
        end
      end
    end

    it "handles array of errors" do
      result = error_service_class.call(["Error 1", "Error 2"])
      expect(result.errors).to eq(["Error 1", "Error 2"])
    end

    it "handles single string error" do
      result = error_service_class.call("Single error")
      expect(result.errors).to eq(["Single error"])
    end
  end

  describe "#current_user" do
    let(:simple_service) do
      Class.new(described_class) do
        def call
          success(current_user)
        end
      end
    end

    it "returns Current.user" do
      user = double("User")
      allow(Current).to receive(:user).and_return(user)

      result = simple_service.call
      expect(result.result).to eq(user)
    end
  end
end
