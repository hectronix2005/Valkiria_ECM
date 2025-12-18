# frozen_string_literal: true

require "rails_helper"

RSpec.describe UuidIdentifiable do
  let(:uuid_class) do
    Class.new do
      include Mongoid::Document
      include UuidIdentifiable

      store_in collection: "uuid_test_docs"
      field :title, type: String

      def self.name
        "UuidTestDoc"
      end
    end
  end

  let(:document) { uuid_class.new(title: "Test") }

  describe "fields" do
    it "has uuid field" do
      expect(document).to respond_to(:uuid)
    end
  end

  describe "callbacks" do
    it "generates uuid on create" do
      expect(document.uuid).to be_nil
      document.save!
      expect(document.uuid).to be_present
    end

    it "does not override existing uuid" do
      custom_uuid = SecureRandom.uuid
      document.uuid = custom_uuid
      document.save!
      expect(document.uuid).to eq(custom_uuid)
    end
  end

  describe "validations" do
    it "validates uniqueness of uuid" do
      document.save!

      duplicate = uuid_class.new(title: "Duplicate", uuid: document.uuid)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:uuid]).to include("has already been taken")
    end
  end

  describe ".find_by_uuid" do
    it "finds document by uuid" do
      document.save!
      found = uuid_class.find_by_uuid(document.uuid)
      expect(found).to eq(document)
    end

    it "returns nil for non-existent uuid" do
      expect(uuid_class.find_by_uuid("non-existent")).to be_nil
    end
  end

  describe ".find_by_uuid!" do
    it "finds document by uuid" do
      document.save!
      found = uuid_class.find_by_uuid!(document.uuid)
      expect(found).to eq(document)
    end

    it "raises error for non-existent uuid" do
      expect { uuid_class.find_by_uuid!("non-existent") }
        .to raise_error(Mongoid::Errors::DocumentNotFound)
    end
  end
end
