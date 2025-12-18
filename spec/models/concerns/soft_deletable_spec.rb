# frozen_string_literal: true

require "rails_helper"

RSpec.describe SoftDeletable do
  let(:soft_deletable_class) do
    Class.new do
      include Mongoid::Document
      include Mongoid::Timestamps
      include SoftDeletable

      store_in collection: "soft_deletable_test_docs"
      field :title, type: String

      def self.name
        "SoftDeletableTestDoc"
      end
    end
  end

  let(:document) { soft_deletable_class.create!(title: "Test") }

  describe "fields" do
    it "has deleted_at field" do
      expect(document).to respond_to(:deleted_at)
    end

    it "has deleted_by_id field" do
      expect(document).to respond_to(:deleted_by_id)
    end
  end

  describe "scopes" do
    let!(:active_doc) { soft_deletable_class.create!(title: "Active") }
    let!(:deleted_doc) do
      doc = soft_deletable_class.new(title: "Deleted")
      doc.deleted_at = Time.current
      doc.save!
      doc
    end

    describe ".active" do
      it "returns only non-deleted documents" do
        # Use unscoped to see all documents first
        expect(soft_deletable_class.unscoped.count).to be >= 2
        expect(soft_deletable_class.active.unscoped.where(deleted_at: nil)).to include(active_doc)
      end
    end

    describe ".deleted" do
      it "returns only deleted documents" do
        expect(soft_deletable_class.deleted).to include(deleted_doc)
        expect(soft_deletable_class.deleted).not_to include(active_doc)
      end
    end

    describe "default_scope" do
      it "excludes deleted documents by default" do
        expect(soft_deletable_class.all).to include(active_doc)
        expect(soft_deletable_class.all).not_to include(deleted_doc)
      end
    end
  end

  describe "#soft_delete" do
    it "sets deleted_at timestamp" do
      expect { document.soft_delete }.to change(document, :deleted_at).from(nil)
    end

    it "returns true on success" do
      expect(document.soft_delete).to be true
    end

    it "returns false if already deleted" do
      document.soft_delete
      expect(document.soft_delete).to be false
    end

    context "with user" do
      let(:mock_user) { double("User", id: BSON::ObjectId.new) }

      it "sets deleted_by_id to provided user" do
        document.soft_delete(mock_user)
        expect(document.deleted_by_id).to eq(mock_user.id)
      end
    end

    context "with Current.user" do
      let(:mock_user) { double("User", id: BSON::ObjectId.new) }

      before do
        allow(Current).to receive(:user).and_return(mock_user)
      end

      it "sets deleted_by_id from Current.user" do
        document.soft_delete
        expect(document.deleted_by_id).to eq(mock_user.id)
      end
    end
  end

  describe "#restore" do
    before { document.soft_delete }

    it "clears deleted_at" do
      expect { document.restore }.to change(document, :deleted_at).to(nil)
    end

    it "clears deleted_by_id" do
      document.deleted_by_id = BSON::ObjectId.new
      document.save!
      expect { document.restore }.to change(document, :deleted_by_id).to(nil)
    end

    it "returns true on success" do
      expect(document.restore).to be true
    end

    it "returns false if not deleted" do
      document.restore
      expect(document.restore).to be false
    end
  end

  describe "#deleted?" do
    it "returns false for active document" do
      expect(document.deleted?).to be false
    end

    it "returns true for deleted document" do
      document.soft_delete
      expect(document.deleted?).to be true
    end
  end
end
