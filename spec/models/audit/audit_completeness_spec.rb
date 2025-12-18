# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Audit Completeness", type: :model do
  # Helper to count audit events for a specific action
  def audit_events_for(action)
    Audit::AuditEvent.where(action: action)
  end

  describe "Document actions audit coverage" do
    let(:user) { create(:user) }
    let(:folder) { create(:content_folder) }

    before do
      Current.user = user
    end

    after do
      Current.user = nil
    end

    describe "document_created" do
      it "emits audit event when document is created" do
        expect do
          create(:content_document, title: "Test Document")
        end.to change { audit_events_for("document_created").count }.by(1)
      end

      it "captures document attributes in audit event" do
        document = create(:content_document, title: "Audit Test", status: "draft")
        event = audit_events_for("document_created").last

        expect(event.target_type).to eq("Content::Document")
        expect(event.target_id).to eq(document.id)
        expect(event.change_data["title"]).to eq("Audit Test")
        expect(event.metadata["initial_status"]).to eq("draft")
      end
    end

    describe "document_updated" do
      let(:document) { create(:content_document, title: "Original") }

      it "emits audit event when document is updated" do
        expect do
          document.update!(title: "Updated Title")
        end.to change { audit_events_for("document_updated").count }.by(1)
      end

      it "captures change data in audit event" do
        document.update!(title: "New Title", description: "New Description")
        event = audit_events_for("document_updated").last

        expect(event.change_data).to include("title")
        expect(event.change_data["title"]).to eq(["Original", "New Title"])
      end

      it "does not emit event when no relevant changes" do
        # Force a save with no actual changes
        expect do
          document.touch
        end.not_to(change { audit_events_for("document_updated").count })
      end
    end

    describe "document_status_changed" do
      let(:document) { create(:content_document, :draft) }

      it "emits status_changed event when status changes" do
        expect do
          document.update!(status: Content::Document::STATUS_PUBLISHED)
        end.to change { audit_events_for("document_status_changed").count }.by(1)
      end

      it "captures status transition in metadata" do
        document.update!(status: Content::Document::STATUS_PUBLISHED)
        event = audit_events_for("document_status_changed").last

        expect(event.metadata["status_transition"]).to eq(["draft", "published"])
      end
    end

    describe "document_locked / document_unlocked" do
      let(:document) { create(:content_document) }

      it "emits audit event when document is locked" do
        expect do
          document.lock!(user)
        end.to change { audit_events_for("document_locked").count }.by(1)
      end

      it "emits audit event when document is unlocked" do
        document.lock!(user)

        expect do
          document.unlock!(user)
        end.to change { audit_events_for("document_unlocked").count }.by(1)
      end

      it "captures lock details in audit event" do
        document.lock!(user)
        event = audit_events_for("document_locked").last

        expect(event.actor_id).to eq(user.id)
        expect(event.metadata["lock_action"]).to eq("document_locked")
      end
    end

    describe "document_deleted (soft delete)" do
      let(:document) { create(:content_document) }

      it "emits audit event when document is soft deleted" do
        expect do
          document.soft_delete_with_audit!(user)
        end.to change { audit_events_for("document_deleted").count }.by(1)
      end

      it "captures soft delete metadata" do
        document.soft_delete_with_audit!(user)
        event = audit_events_for("document_deleted").last

        expect(event.metadata["soft_delete"]).to be true
        expect(event.change_data["deleted_at"]).to be_present
      end

      it "prevents hard delete" do
        expect do
          document.destroy
        end.to raise_error(Content::Document::HardDeleteNotAllowedError)
      end
    end

    describe "document_restored" do
      let(:document) { create(:content_document) }

      before do
        document.soft_delete_with_audit!(user)
      end

      it "emits audit event when document is restored" do
        unscoped_doc = Content::Document.unscoped.find(document.id)
        expect do
          unscoped_doc.restore_with_audit!(user)
        end.to change { audit_events_for("document_restored").count }.by(1)
      end

      it "captures restore metadata" do
        unscoped_doc = Content::Document.unscoped.find(document.id)
        unscoped_doc.restore_with_audit!(user)
        event = audit_events_for("document_restored").last

        expect(event.metadata["restored"]).to be true
      end
    end

    describe "document_moved" do
      let(:document) { create(:content_document, folder: folder) }
      let(:new_folder) { create(:content_folder, organization: folder.organization) }

      it "emits audit event when document is moved to new folder" do
        expect do
          document.move_to_folder!(new_folder)
        end.to change { audit_events_for("document_moved").count }.by(1)
      end

      it "captures folder change in audit event" do
        document.move_to_folder!(new_folder)
        event = audit_events_for("document_moved").last

        expect(event.metadata["old_folder_path"]).to eq(folder.path)
        expect(event.metadata["new_folder_path"]).to eq(new_folder.path)
      end
    end
  end

  describe "Version actions audit coverage" do
    let(:user) { create(:user) }
    let(:document) { create(:content_document) }

    before do
      Current.user = user
    end

    after do
      Current.user = nil
    end

    describe "version_created" do
      it "emits audit event when version is created" do
        expect do
          document.create_version!(
            file_name: "test.pdf",
            content_type: "application/pdf",
            content: "Test content"
          )
        end.to change { audit_events_for("version_created").count }.by(1)
      end

      it "captures version metadata" do
        version = document.create_version!(
          file_name: "report.pdf",
          content_type: "application/pdf",
          content: "Report content",
          change_summary: "Initial version"
        )
        event = audit_events_for("version_created").last

        expect(event.target_type).to eq("Content::DocumentVersion")
        expect(event.target_id).to eq(version.id)
        expect(event.metadata["file_name"]).to eq("report.pdf")
        expect(event.metadata["version_number"]).to eq(1)
        expect(event.metadata["change_summary"]).to eq("Initial version")
      end
    end

    describe "version_downloaded" do
      let(:version) do
        document.create_version!(
          file_name: "test.pdf",
          content_type: "application/pdf",
          content: "Test content"
        )
      end

      it "emits audit event when version is downloaded" do
        expect do
          version.log_download!(user)
        end.to change { audit_events_for("version_downloaded").count }.by(1)
      end

      it "captures download metadata" do
        Current.ip_address = "192.168.1.100"
        Current.user_agent = "TestBrowser/1.0"

        version.log_download!(user)
        event = audit_events_for("version_downloaded").last

        expect(event.actor_id).to eq(user.id)
        expect(event.metadata["download_timestamp"]).to be_present
        expect(event.metadata["user_ip"]).to eq("192.168.1.100")
      end

      it "tracks download count via audit trail" do
        3.times { version.log_download!(user) }
        expect(version.download_count).to eq(3)
      end
    end

    describe "version_viewed" do
      let(:version) do
        document.create_version!(
          file_name: "test.pdf",
          content_type: "application/pdf",
          content: "Test content"
        )
      end

      it "emits audit event when version is viewed" do
        expect do
          version.log_view!(user)
        end.to change { audit_events_for("version_viewed").count }.by(1)
      end

      it "tracks view count via audit trail" do
        5.times { version.log_view!(user) }
        expect(version.view_count).to eq(5)
      end
    end
  end

  describe "Folder actions audit coverage" do
    let(:user) { create(:user) }

    before do
      Current.user = user
    end

    after do
      Current.user = nil
    end

    describe "folder_created" do
      it "emits audit event when folder is created" do
        expect do
          create(:content_folder, name: "New Folder")
        end.to change { audit_events_for("folder_created").count }.by(1)
      end

      it "captures folder attributes" do
        create(:content_folder, name: "Projects")
        event = audit_events_for("folder_created").last

        expect(event.target_type).to eq("Content::Folder")
        expect(event.metadata["folder_name"]).to eq("Projects")
        expect(event.metadata["folder_path"]).to eq("/Projects")
      end
    end

    describe "folder_updated" do
      let(:folder) { create(:content_folder, name: "Original") }

      it "emits audit event when folder is updated" do
        expect do
          folder.update!(name: "Renamed")
        end.to change { audit_events_for("folder_updated").count }.by(1)
      end

      it "captures name change in metadata" do
        folder.update!(name: "Renamed")
        event = audit_events_for("folder_updated").last

        expect(event.metadata["name_changed"]).to be true
      end
    end

    describe "folder_moved" do
      let(:folder) { create(:content_folder, name: "Child") }
      let(:new_parent) { create(:content_folder, name: "NewParent") }

      it "emits audit event when folder is moved" do
        expect do
          folder.move_to(new_parent)
        end.to change { audit_events_for("folder_moved").count }.by(1)
      end

      it "captures path change in audit event" do
        folder.move_to(new_parent)
        event = audit_events_for("folder_moved").last

        expect(event.change_data["path"]).to eq(["/Child", "/NewParent/Child"])
      end
    end

    describe "folder_deleted (soft delete)" do
      let(:folder) { create(:content_folder) }

      it "emits audit event when folder is soft deleted" do
        expect do
          folder.soft_delete_with_audit!(user)
        end.to change { audit_events_for("folder_deleted").count }.by(1)
      end

      it "prevents hard delete" do
        expect do
          folder.destroy
        end.to raise_error(Content::Folder::HardDeleteNotAllowedError)
      end
    end
  end

  describe "Audit trail retrieval" do
    let(:user) { create(:user) }
    let(:document) { create(:content_document) }

    before do
      Current.user = user
    end

    after do
      Current.user = nil
    end

    it "retrieves complete audit trail for document" do
      # Perform various actions
      document.update!(title: "Updated")
      document.lock!(user)
      document.unlock!(user)
      version = document.create_version!(
        file_name: "v1.pdf",
        content_type: "application/pdf",
        content: "Content"
      )
      version.log_download!(user)

      trail = document.audit_trail

      # Should include document events
      expect(trail.map(&:action)).to include(
        "document_created",
        "document_updated",
        "document_locked",
        "document_unlocked"
      )
    end

    it "retrieves audit trail for version" do
      version = document.create_version!(
        file_name: "test.pdf",
        content_type: "application/pdf",
        content: "Test"
      )
      version.log_view!(user)
      version.log_download!(user)

      trail = version.audit_trail

      expect(trail.map(&:action)).to include(
        "version_created",
        "version_viewed",
        "version_downloaded"
      )
    end
  end

  describe "No action without audit guarantee" do
    let(:user) { create(:user) }

    before do
      Current.user = user
    end

    after do
      Current.user = nil
    end

    it "every document create emits exactly one document_created event" do
      initial = audit_events_for("document_created").count
      10.times { create(:content_document) }
      expect(audit_events_for("document_created").count).to eq(initial + 10)
    end

    it "every version create emits exactly one version_created event" do
      document = create(:content_document)
      initial = audit_events_for("version_created").count

      5.times do |i|
        document.create_version!(
          file_name: "v#{i}.pdf",
          content_type: "application/pdf",
          content: "Content #{i}"
        )
      end

      expect(audit_events_for("version_created").count).to eq(initial + 5)
    end

    it "every folder create emits exactly one folder_created event" do
      initial = audit_events_for("folder_created").count
      5.times { create(:content_folder) }
      expect(audit_events_for("folder_created").count).to eq(initial + 5)
    end
  end
end
