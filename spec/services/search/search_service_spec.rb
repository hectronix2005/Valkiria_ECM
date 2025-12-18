# frozen_string_literal: true

require "rails_helper"

RSpec.describe Search::SearchService do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:admin) { create(:user, :admin, organization: organization) }

  let!(:published_doc) do
    create(:content_document,
           title: "Published Report",
           status: "published",
           tags: ["finance", "report"],
           organization: organization)
  end

  let!(:draft_doc) do
    create(:content_document,
           title: "Draft Document",
           status: "draft",
           tags: ["draft", "internal"],
           organization: organization)
  end

  describe ".search" do
    it "performs search via class method" do
      results = described_class.search(
        text: "report",
        user: user,
        organization_id: organization.id
      )

      expect(results).to be_a(Search::Results)
      expect(results.documents).to include(published_doc)
    end

    it "accepts :q as alias for text" do
      results = described_class.search(
        q: "report",
        user: user,
        organization_id: organization.id
      )

      expect(results.documents).to include(published_doc)
    end

    it "uses user organization_id if not specified" do
      results = described_class.search(
        text: "report",
        user: user
      )

      expect(results.documents).to include(published_doc)
    end
  end

  describe "#initialize" do
    it "creates service with user and organization" do
      service = described_class.new(user: user, organization_id: organization.id)

      expect(service.user).to eq(user)
      expect(service.organization_id).to eq(organization.id)
    end

    it "uses default adapter" do
      service = described_class.new(user: user, organization_id: organization.id)

      expect(service.adapter).to be_a(Search::Adapters::MongoAdapter)
    end

    it "accepts custom adapter" do
      custom_adapter = Search::Adapters::MongoAdapter.new
      service = described_class.new(user: user, adapter: custom_adapter)

      expect(service.adapter).to eq(custom_adapter)
    end
  end

  describe "#search" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    it "returns search results" do
      results = service.search("report")

      expect(results).to be_a(Search::Results)
      expect(results.documents).not_to be_empty
    end

    it "accepts filter options" do
      results = service.search("", filters: { status: "draft" })

      expect(results.documents).to include(draft_doc)
      expect(results.documents).not_to include(published_doc)
    end

    it "accepts sort options" do
      results = service.search("", sort: :newest)

      expect(results.documents).not_to be_empty
    end

    it "accepts pagination options" do
      results = service.search("", page: 1, per_page: 1)

      expect(results.documents.size).to eq(1)
      expect(results.per_page).to eq(1)
    end

    it "logs search to audit trail" do
      expect do
        service.search("report")
      end.to change { Audit::AuditEvent.where(action: "search_performed").count }.by(1)
    end

    it "includes search metadata in audit event" do
      service.search("report", filters: { status: "published" })
      event = Audit::AuditEvent.where(action: "search_performed").last

      expect(event.metadata["search_text"]).to eq("report")
      expect(event.metadata["filters"]).to include("status")
      expect(event.actor_id).to eq(user.id)
    end
  end

  describe "#search_by_title" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    it "searches by title filter" do
      results = service.search_by_title("Published")

      expect(results.documents).to include(published_doc)
      expect(results.documents).not_to include(draft_doc)
    end
  end

  describe "#search_by_tags" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    it "searches by single tag" do
      results = service.search_by_tags("finance")

      expect(results.documents).to include(published_doc)
      expect(results.documents).not_to include(draft_doc)
    end

    it "searches by multiple tags" do
      results = service.search_by_tags(["finance", "draft"])

      expect(results.documents).to include(published_doc, draft_doc)
    end
  end

  describe "#search_by_metadata" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    let!(:doc_with_metadata) do
      create(:content_document,
             title: "Document with Metadata",
             metadata: { category: "legal", priority: "high" },
             organization: organization)
    end

    it "searches by metadata field" do
      results = service.search_by_metadata(category: "legal")

      expect(results.documents).to include(doc_with_metadata)
      expect(results.documents).not_to include(published_doc)
    end
  end

  describe "#search_in_folder" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }
    let(:folder) { create(:content_folder, organization: organization) }
    let!(:folder_doc) do
      create(:content_document,
             title: "Folder Document",
             folder: folder,
             organization: organization)
    end

    it "searches within a specific folder" do
      results = service.search_in_folder(folder)

      expect(results.documents).to include(folder_doc)
      expect(results.documents).not_to include(published_doc)
    end

    it "accepts folder_id directly" do
      results = service.search_in_folder(folder.id)

      expect(results.documents).to include(folder_doc)
    end

    it "combines folder filter with text search" do
      results = service.search_in_folder(folder, "Folder")

      expect(results.documents).to include(folder_doc)
    end
  end

  describe "#search_in_folders" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }
    let(:folder1) { create(:content_folder, organization: organization) }
    let(:folder2) { create(:content_folder, organization: organization) }
    let!(:folder1_doc) { create(:content_document, folder: folder1, organization: organization) }
    let!(:folder2_doc) { create(:content_document, folder: folder2, organization: organization) }

    it "searches within multiple folders" do
      results = service.search_in_folders([folder1, folder2])

      expect(results.documents).to include(folder1_doc, folder2_doc)
      expect(results.documents).not_to include(published_doc)
    end
  end

  describe "#by_status" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    it "filters by status" do
      results = service.by_status("published")

      expect(results.documents).to include(published_doc)
      expect(results.documents).not_to include(draft_doc)
    end
  end

  describe "#recent" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    before do
      5.times { create(:content_document, organization: organization) }
    end

    it "returns recent documents" do
      results = service.recent(3)

      expect(results.documents.size).to eq(3)
    end

    it "defaults to 10 documents" do
      results = service.recent

      expect(results.per_page).to eq(10)
    end
  end

  describe "#by_creator" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }
    let(:creator) { create(:user, organization: organization) }
    let!(:creator_doc) do
      create(:content_document,
             created_by: creator,
             organization: organization)
    end

    it "filters by creator user" do
      results = service.by_creator(creator)

      expect(results.documents).to include(creator_doc)
    end

    it "accepts creator_id directly" do
      results = service.by_creator(creator.id)

      expect(results.documents).to include(creator_doc)
    end
  end

  describe "#advanced_search" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    it "combines multiple search criteria" do
      results = service.advanced_search(
        text: "report",
        status: "published",
        tags: ["finance"]
      )

      expect(results.documents).to include(published_doc)
      expect(results.documents).not_to include(draft_doc)
    end

    it "supports date range filters" do
      results = service.advanced_search(
        created_after: 1.day.ago,
        status: "published"
      )

      expect(results.documents).to include(published_doc)
    end
  end

  describe "#healthy?" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }

    it "returns adapter health status" do
      expect(service.healthy?).to be true
    end
  end

  describe "permission filtering" do
    let(:other_org) { create(:organization) }
    let(:other_user) { create(:user, organization: other_org) }
    let!(:other_org_doc) do
      create(:content_document,
             title: "Other Org Report",
             organization: other_org)
    end

    it "restricts results to user's organization" do
      service = described_class.new(user: user, organization_id: organization.id)
      results = service.search("report")

      result_ids = results.documents.map(&:id)
      expect(result_ids).not_to include(other_org_doc.id)
    end

    it "allows searching other organization for admin with explicit org_id" do
      # Create admin role if it doesn't exist
      Identity::Role.find_or_create_by!(name: Identity::Role::ADMIN) do |role|
        role.display_name = "Administrator"
        role.level = 100
      end

      # Admin explicitly searching another org (e.g., super admin scenario)
      admin_user = create(:user, :admin, organization: organization)
      service = described_class.new(user: admin_user, organization_id: other_org.id)
      results = service.search("report")

      result_ids = results.documents.map(&:id)
      expect(result_ids).to include(other_org_doc.id)
      expect(result_ids).not_to include(published_doc.id)
    end
  end

  describe "workspace (folder) permission filtering" do
    let(:service) { described_class.new(user: user, organization_id: organization.id) }
    let(:restricted_folder) { create(:content_folder, organization: organization) }
    let(:allowed_folder) { create(:content_folder, organization: organization) }
    let!(:restricted_doc) do
      create(:content_document,
             title: "Restricted Workspace Document",
             folder: restricted_folder,
             organization: organization)
    end
    let!(:allowed_doc) do
      create(:content_document,
             title: "Allowed Workspace Document",
             folder: allowed_folder,
             organization: organization)
    end

    it "filters by folder_ids for workspace restriction" do
      results = service.search("Workspace", filters: { folder_ids: [allowed_folder.id] })

      result_ids = results.documents.map(&:id)
      expect(result_ids).to include(allowed_doc.id)
      expect(result_ids).not_to include(restricted_doc.id)
    end

    it "allows access to all folders for admin" do
      # Create admin role if it doesn't exist
      Identity::Role.find_or_create_by!(name: Identity::Role::ADMIN) do |role|
        role.display_name = "Administrator"
        role.level = 100
      end

      admin_user = create(:user, :admin, organization: organization)
      admin_service = described_class.new(user: admin_user, organization_id: organization.id)
      results = admin_service.search("Workspace")

      result_ids = results.documents.map(&:id)
      expect(result_ids).to include(restricted_doc.id, allowed_doc.id)
    end
  end
end
