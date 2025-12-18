# frozen_string_literal: true

require "rails_helper"

RSpec.describe Content::Document do
  describe "validations" do
    subject { build(:content_document) }

    it { is_expected.to be_valid }

    it "validates presence of title" do
      document = build(:content_document, title: nil)
      expect(document).not_to be_valid
      expect(document.errors[:title]).to include("can't be blank")
    end

    it "validates title length" do
      document = build(:content_document, title: "a" * 256)
      expect(document).not_to be_valid
      expect(document.errors[:title]).to include("is too long (maximum is 255 characters)")
    end

    it "validates status inclusion" do
      document = build(:content_document, status: "invalid_status")
      expect(document).not_to be_valid
      expect(document.errors[:status]).to include("is not included in the list")
    end

    it "accepts valid statuses" do
      ["draft", "pending_review", "published", "archived"].each do |status|
        document = build(:content_document, status: status)
        expect(document).to be_valid
      end
    end
  end

  describe "indexes" do
    it { is_expected.to have_index_for(uuid: 1).with_options(unique: true) }
    it { is_expected.to have_index_for(title: 1) }
    it { is_expected.to have_index_for(status: 1) }
    it { is_expected.to have_index_for(folder_id: 1) }
    it { is_expected.to have_index_for(organization_id: 1) }
    it { is_expected.to have_index_for(document_type: 1) }
    it { is_expected.to have_index_for(tags: 1) }
    it { is_expected.to have_index_for(created_at: -1) }
  end

  describe "associations" do
    let(:document) { create(:content_document) }

    it "belongs to folder" do
      folder = create(:content_folder)
      document.folder = folder
      document.save!
      expect(document.reload.folder).to eq(folder)
    end

    it "has many versions" do
      version = document.create_version!(
        file_name: "test.pdf",
        content_type: "application/pdf",
        content: "Test content"
      )
      expect(document.versions).to include(version)
    end
  end

  describe "status workflow" do
    let(:document) { create(:content_document, :draft) }

    it "starts in draft status" do
      expect(document.status).to eq(Content::Document::STATUS_DRAFT)
    end

    it "transitions from draft to pending_review" do
      document.update!(status: Content::Document::STATUS_PENDING_REVIEW)
      expect(document.reload.status).to eq(Content::Document::STATUS_PENDING_REVIEW)
    end

    it "transitions from pending_review to published" do
      document.update!(status: Content::Document::STATUS_PENDING_REVIEW)
      document.update!(status: Content::Document::STATUS_PUBLISHED)
      expect(document.reload.status).to eq(Content::Document::STATUS_PUBLISHED)
    end

    it "transitions to archived from any status" do
      document.update!(status: Content::Document::STATUS_ARCHIVED)
      expect(document.reload.status).to eq(Content::Document::STATUS_ARCHIVED)
    end
  end

  describe "#create_version!" do
    let(:document) { create(:content_document) }

    it "creates a new version with correct attributes" do
      version = document.create_version!(
        file_name: "report.pdf",
        content_type: "application/pdf",
        content: "Test content",
        change_summary: "Initial version"
      )

      expect(version).to be_persisted
      expect(version.file_name).to eq("report.pdf")
      expect(version.content_type).to eq("application/pdf")
      expect(version.document).to eq(document)
    end

    it "sets the version as current_version" do
      version = document.create_version!(
        file_name: "report.pdf",
        content_type: "application/pdf",
        content: "Test content"
      )

      expect(document.reload.current_version).to eq(version)
    end

    it "increments version_count" do
      expect do
        document.create_version!(
          file_name: "report.pdf",
          content_type: "application/pdf",
          content: "Test content"
        )
      end.to change { document.reload.version_count }.by(1)
    end

    it "raises error when document is locked by another user" do
      other_user = create(:user)
      document.lock!(other_user)

      expect do
        document.create_version!(
          file_name: "report.pdf",
          content_type: "application/pdf",
          content: "Test content"
        )
      end.to raise_error(Content::Document::DocumentLockedError)
    end
  end

  describe "locking" do
    let(:document) { create(:content_document) }
    let(:user) { create(:user) }

    describe "#lock!" do
      it "locks the document for the user" do
        result = document.lock!(user)

        expect(result).to be true
        expect(document.reload.locked_by_id).to eq(user.id)
        expect(document.locked_at).to be_present
      end

      it "returns false if already locked by another user" do
        other_user = create(:user)
        document.lock!(other_user)

        result = document.lock!(user)
        expect(result).to be false
        expect(document.reload.locked_by_id).to eq(other_user.id)
      end

      it "allows re-locking by the same user" do
        document.lock!(user)
        result = document.lock!(user)

        expect(result).to be true
      end
    end

    describe "#unlock!" do
      before { document.lock!(user) }

      it "unlocks the document" do
        result = document.unlock!(user)

        expect(result).to be true
        expect(document.reload.locked_by_id).to be_nil
        expect(document.locked_at).to be_nil
      end

      it "returns false if locked by another user" do
        other_user = create(:user)

        result = document.unlock!(other_user)
        expect(result).to be false
        expect(document.reload.locked_by_id).to eq(user.id)
      end
    end

    describe "#locked?" do
      it "returns true when locked" do
        document.lock!(user)
        expect(document.locked?).to be true
      end

      it "returns false when not locked" do
        expect(document.locked?).to be false
      end
    end

    describe "#locked_by?" do
      it "returns true when locked by the given user" do
        document.lock!(user)
        expect(document.locked_by?(user)).to be true
      end

      it "returns false when locked by another user" do
        other_user = create(:user)
        document.lock!(other_user)
        expect(document.locked_by?(user)).to be false
      end

      it "returns false when not locked" do
        expect(document.locked_by?(user)).to be false
      end
    end
  end

  describe "concurrency control" do
    let(:document) { create(:content_document) }

    describe "#update_with_lock!" do
      it "updates document with version check" do
        original_lock_version = document.lock_version

        document.update_with_lock!(title: "Updated Title")

        expect(document.reload.title).to eq("Updated Title")
        expect(document.lock_version).to eq(original_lock_version + 1)
      end

      it "raises ConcurrencyError when lock_version mismatch" do
        # Simulate another process updating the document
        described_class.where(_id: document.id).update_all(lock_version: document.lock_version + 1)

        expect do
          document.update_with_lock!(title: "Updated Title")
        end.to raise_error(Content::Document::ConcurrencyError)
      end
    end

    describe "simulated concurrent updates" do
      it "prevents race condition with two simultaneous updates" do
        # Create fresh document
        doc = create(:content_document, title: "Original")

        # Simulate two clients loading the document at the same time
        client1_doc = described_class.find(doc.id)
        client2_doc = described_class.find(doc.id)

        # Both have the same lock_version
        expect(client1_doc.lock_version).to eq(client2_doc.lock_version)

        # Client 1 updates first - should succeed
        client1_doc.update_with_lock!(title: "Client 1 Update")
        expect(client1_doc.reload.title).to eq("Client 1 Update")

        # Client 2 tries to update with stale lock_version - should fail
        expect do
          client2_doc.update_with_lock!(title: "Client 2 Update")
        end.to raise_error(Content::Document::ConcurrencyError)

        # Document should have Client 1's update
        expect(doc.reload.title).to eq("Client 1 Update")
      end

      it "prevents race condition during version creation" do
        doc = create(:content_document)

        # Simulate two clients loading the document
        client1_doc = described_class.find(doc.id)
        client2_doc = described_class.find(doc.id)

        # Client 1 creates a version first
        client1_doc.create_version!(
          file_name: "v1.pdf",
          content_type: "application/pdf",
          content: "Version 1 content"
        )

        # Client 2 tries to create a version with stale state
        # This should fail due to lock_version mismatch
        expect do
          client2_doc.create_version!(
            file_name: "v2.pdf",
            content_type: "application/pdf",
            content: "Version 2 content"
          )
        end.to raise_error(Content::Document::ConcurrencyError)

        # Only one version should exist
        expect(doc.reload.version_count).to eq(1)
      end

      it "allows sequential updates after refresh" do
        doc = create(:content_document, title: "Original")

        # Client 1 updates
        client1_doc = described_class.find(doc.id)
        client1_doc.update_with_lock!(title: "Update 1")

        # Client 2 refreshes and then updates
        client2_doc = described_class.find(doc.id) # Fresh load
        client2_doc.update_with_lock!(title: "Update 2")

        expect(doc.reload.title).to eq("Update 2")
        expect(doc.lock_version).to eq(2)
      end
    end
  end

  describe "scopes" do
    let!(:draft_doc) { create(:content_document, :draft) }
    let!(:published_doc) { create(:content_document, :published) }
    let!(:archived_doc) { create(:content_document, :archived) }

    it ".by_status filters by status" do
      expect(described_class.by_status("draft")).to include(draft_doc)
      expect(described_class.by_status("draft")).not_to include(published_doc)
    end

    it ".not_archived excludes archived documents" do
      not_archived = described_class.not_archived
      expect(not_archived).to include(draft_doc, published_doc)
      expect(not_archived).not_to include(archived_doc)
    end

    it ".published returns only published documents" do
      expect(described_class.published).to eq([published_doc])
    end
  end

  describe "soft delete" do
    let(:document) { create(:content_document) }

    it "soft deletes the document" do
      document.soft_delete!

      expect(document.reload.deleted_at).to be_present
      # default_scope hides deleted records
      expect(described_class.where(id: document.id).count).to eq(0)
      expect(described_class.unscoped.where(id: document.id).count).to eq(1)
    end

    it "can be restored" do
      document.soft_delete!
      described_class.unscoped.find(document.id).restore!

      expect(described_class.find(document.id).deleted_at).to be_nil
    end
  end

  describe "audit logging" do
    it "logs document creation" do
      expect do
        create(:content_document)
      end.to change(Audit::AuditEvent, :count).by_at_least(1)

      event = Audit::AuditEvent.where(action: "document_created").last
      expect(event).to be_present
      expect(event.event_type).to eq("content")
    end

    it "logs document updates" do
      document = create(:content_document)

      expect do
        document.update!(title: "New Title")
      end.to change(Audit::AuditEvent, :count).by_at_least(1)

      event = Audit::AuditEvent.where(action: "document_updated").last
      expect(event).to be_present
    end

    it "logs version creation" do
      document = create(:content_document)

      expect do
        document.create_version!(
          file_name: "test.pdf",
          content_type: "application/pdf",
          content: "Test"
        )
      end.to change(Audit::AuditEvent, :count).by_at_least(1)

      event = Audit::AuditEvent.where(action: "version_created").last
      expect(event).to be_present
    end

    it "logs document locking" do
      document = create(:content_document)
      user = create(:user)

      expect do
        document.lock!(user)
      end.to change(Audit::AuditEvent, :count).by_at_least(1)

      event = Audit::AuditEvent.where(action: "document_locked").last
      expect(event).to be_present
    end

    it "logs document unlocking" do
      document = create(:content_document)
      user = create(:user)
      document.lock!(user)

      expect do
        document.unlock!(user)
      end.to change(Audit::AuditEvent, :count).by_at_least(1)

      event = Audit::AuditEvent.where(action: "document_unlocked").last
      expect(event).to be_present
    end
  end

  describe "#latest_version" do
    it "returns the current version" do
      document = create(:content_document)
      v1 = document.create_version!(
        file_name: "v1.pdf",
        content_type: "application/pdf",
        content: "Version 1"
      )
      v2 = document.create_version!(
        file_name: "v2.pdf",
        content_type: "application/pdf",
        content: "Version 2"
      )

      expect(document.reload.latest_version).to eq(v2)
      expect(document.latest_version).not_to eq(v1)
    end
  end

  describe "#version_history" do
    it "returns all versions in order" do
      document = create(:content_document)
      v1 = document.create_version!(
        file_name: "v1.pdf",
        content_type: "application/pdf",
        content: "Version 1"
      )
      v2 = document.create_version!(
        file_name: "v2.pdf",
        content_type: "application/pdf",
        content: "Version 2"
      )
      v3 = document.create_version!(
        file_name: "v3.pdf",
        content_type: "application/pdf",
        content: "Version 3"
      )

      history = document.version_history
      expect(history).to eq([v1, v2, v3])
    end
  end
end
