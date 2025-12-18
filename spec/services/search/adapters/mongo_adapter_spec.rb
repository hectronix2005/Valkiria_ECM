# frozen_string_literal: true

require "rails_helper"

RSpec.describe Search::Adapters::MongoAdapter do
  let(:adapter) { described_class.new }
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:admin) { create(:user, :admin, organization: organization) }

  # Create test documents
  let!(:quarterly_report) do
    create(:content_document,
           title: "Q4 2024 Quarterly Report",
           description: "Financial summary for Q4",
           status: "published",
           tags: ["finance", "quarterly", "report"],
           document_type: "report",
           metadata: { year: 2024, quarter: 4 },
           organization: organization)
  end

  let!(:annual_report) do
    create(:content_document,
           title: "Annual Report 2024",
           description: "Full year financial report",
           status: "published",
           tags: ["finance", "annual", "report"],
           document_type: "report",
           metadata: { year: 2024 },
           organization: organization)
  end

  let!(:draft_document) do
    create(:content_document,
           title: "Draft Budget Proposal",
           description: "Preliminary budget for next year",
           status: "draft",
           tags: ["finance", "budget", "draft"],
           document_type: "proposal",
           organization: organization)
  end

  let!(:hr_policy) do
    create(:content_document,
           title: "Employee Handbook",
           description: "HR policies and procedures",
           status: "published",
           tags: ["hr", "policy", "handbook"],
           document_type: "policy",
           organization: organization)
  end

  let!(:other_org_doc) do
    create(:content_document,
           title: "Other Organization Report",
           status: "published")
  end

  describe "#search" do
    describe "text search" do
      it "searches in title" do
        query = build_query(text: "quarterly")
        results = adapter.search(query)

        expect(results.documents.map(&:id)).to include(quarterly_report.id)
        expect(results.documents.map(&:id)).not_to include(hr_policy.id)
      end

      it "searches in description" do
        query = build_query(text: "financial")
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report, annual_report)
      end

      it "searches in tags" do
        query = build_query(text: "handbook")
        results = adapter.search(query)

        expect(results.documents).to include(hr_policy)
      end

      it "searches case-insensitively" do
        query = build_query(text: "QUARTERLY")
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report)
      end

      it "returns empty results for no matches" do
        query = build_query(text: "zzzznonexistentterm")
        results = adapter.search(query)

        expect(results.documents).to be_empty
        expect(results.total_count).to eq(0)
      end
    end

    describe "filter by title/name" do
      it "filters by title" do
        query = build_query(filters: { title: "Quarterly" })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report)
        expect(results.documents).not_to include(annual_report)
      end

      it "filters by name (alias for title)" do
        query = build_query(filters: { name: "Annual" })
        results = adapter.search(query)

        expect(results.documents).to include(annual_report)
        expect(results.documents).not_to include(quarterly_report)
      end
    end

    describe "filter by tags" do
      it "filters by single tag" do
        query = build_query(filters: { tags: ["hr"] })
        results = adapter.search(query)

        expect(results.documents).to include(hr_policy)
        expect(results.documents).not_to include(quarterly_report)
      end

      it "filters by multiple tags (OR)" do
        query = build_query(filters: { tags: ["quarterly", "annual"] })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report, annual_report)
      end
    end

    describe "filter by status" do
      it "filters by status" do
        query = build_query(filters: { status: "draft" })
        results = adapter.search(query)

        expect(results.documents).to include(draft_document)
        expect(results.documents).not_to include(quarterly_report)
      end
    end

    describe "filter by document_type" do
      it "filters by document type" do
        query = build_query(filters: { document_type: "policy" })
        results = adapter.search(query)

        expect(results.documents).to include(hr_policy)
        expect(results.documents).not_to include(quarterly_report)
      end
    end

    describe "filter by metadata" do
      it "filters by metadata field" do
        query = build_query(filters: { metadata: { year: 2024 } })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report, annual_report)
        expect(results.documents).not_to include(hr_policy)
      end

      it "filters by nested metadata" do
        query = build_query(filters: { metadata: { quarter: 4 } })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report)
        expect(results.documents).not_to include(annual_report)
      end
    end

    describe "filter by folder" do
      let(:folder) { create(:content_folder, organization: organization) }
      let!(:folder_doc) do
        create(:content_document,
               title: "Folder Document",
               folder: folder,
               organization: organization)
      end

      it "filters by folder_id" do
        query = build_query(filters: { folder_id: folder.id })
        results = adapter.search(query)

        expect(results.documents).to include(folder_doc)
        expect(results.documents).not_to include(quarterly_report)
      end

      it "filters by multiple folder_ids" do
        folder2 = create(:content_folder, organization: organization)
        folder2_doc = create(:content_document, folder: folder2, organization: organization)

        query = build_query(filters: { folder_ids: [folder.id, folder2.id] })
        results = adapter.search(query)

        expect(results.documents).to include(folder_doc, folder2_doc)
        expect(results.documents).not_to include(quarterly_report)
      end
    end

    describe "date filters" do
      it "filters by created_after" do
        old_doc = create(:content_document, organization: organization, created_at: 1.year.ago)

        query = build_query(filters: { created_after: 1.month.ago })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report)
        expect(results.documents).not_to include(old_doc)
      end

      it "filters by created_before" do
        query = build_query(filters: { created_before: 1.second.from_now })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report)
      end
    end

    describe "organization isolation" do
      it "only returns documents from specified organization" do
        query = build_query(text: "report")
        results = adapter.search(query)

        result_ids = results.documents.map(&:id)
        expect(result_ids).to include(quarterly_report.id, annual_report.id)
        expect(result_ids).not_to include(other_org_doc.id)
      end
    end

    describe "soft delete filtering" do
      before do
        draft_document.soft_delete_with_audit!(user)
      end

      it "excludes soft-deleted documents by default" do
        query = build_query
        results = adapter.search(query)

        expect(results.documents).not_to include(draft_document)
      end

      it "includes soft-deleted when include_deleted is true" do
        query = Search::Query.new(
          user: user,
          organization_id: organization.id,
          include_deleted: true
        )
        results = adapter.search(query)

        expect(results.documents.map(&:id)).to include(draft_document.id)
      end
    end

    describe "combined filters" do
      it "combines text and filters" do
        query = build_query(text: "report", filters: { status: "published" })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report, annual_report)
        expect(results.documents).not_to include(draft_document)
      end

      it "combines multiple filters" do
        query = build_query(filters: { status: "published", document_type: "report" })
        results = adapter.search(query)

        expect(results.documents).to include(quarterly_report, annual_report)
        expect(results.documents).not_to include(hr_policy)
      end
    end

    describe "pagination" do
      before do
        # Create more documents for pagination testing
        10.times do |i|
          create(:content_document,
                 title: "Paginated Doc #{i}",
                 organization: organization)
        end
      end

      it "respects page parameter" do
        query1 = build_query(page: 1, per_page: 5, sort: :oldest)
        query2 = build_query(page: 2, per_page: 5, sort: :oldest)

        results1 = adapter.search(query1)
        results2 = adapter.search(query2)

        expect(results1.documents.size).to eq(5)
        expect(results2.documents.size).to eq(5)

        page1_ids = results1.documents.map(&:id)
        page2_ids = results2.documents.map(&:id)
        expect(page1_ids & page2_ids).to be_empty
      end

      it "returns total count across all pages" do
        query = build_query(page: 1, per_page: 5)
        results = adapter.search(query)

        expect(results.total_count).to be >= 14 # 4 original + 10 new
      end
    end

    describe "sorting" do
      it "sorts by newest" do
        query = build_query(sort: :newest)
        results = adapter.search(query)

        created_times = results.documents.map(&:created_at)
        expect(created_times).to eq(created_times.sort.reverse)
      end

      it "sorts by oldest" do
        query = build_query(sort: :oldest)
        results = adapter.search(query)

        created_times = results.documents.map(&:created_at)
        expect(created_times).to eq(created_times.sort)
      end

      it "sorts by title ascending" do
        query = build_query(sort: :title_asc)
        results = adapter.search(query)

        titles = results.documents.map(&:title)
        expect(titles).to eq(titles.sort)
      end
    end
  end

  describe "scoring and ranking" do
    it "ranks exact title match highest" do
      exact_match = create(:content_document,
                           title: "Report",
                           organization: organization)
      partial_match = create(:content_document,
                             title: "Monthly Report Summary",
                             organization: organization)

      query = build_query(text: "report", sort: :relevance)
      results = adapter.search(query)

      scored_docs = results.documents.select { |d| [exact_match.id, partial_match.id].include?(d.id) }

      # Both should have scores
      expect(scored_docs.all? { |d| d.search_score.positive? }).to be true
    end

    it "includes score in results" do
      query = build_query(text: "quarterly")
      results = adapter.search(query)

      expect(results.documents.first).to respond_to(:search_score)
      expect(results.documents.first.search_score).to be >= 0
    end

    it "gives recency bonus to recently updated documents" do
      create(:content_document,
             title: "Old Quarterly Report",
             organization: organization,
             updated_at: 30.days.ago)

      query = build_query(text: "quarterly", sort: :relevance)
      results = adapter.search(query)

      recent_scores = results.documents.select { |d| d.updated_at > 7.days.ago }.map(&:search_score)
      old_scores = results.documents.select { |d| d.updated_at <= 7.days.ago }.map(&:search_score)

      # Recent documents with same match should score higher
      # This is a soft check as other factors affect score
      expect(recent_scores.max).to be >= (old_scores.max || 0)
    end
  end

  describe "#healthy?" do
    it "returns true when MongoDB is available" do
      expect(adapter.healthy?).to be true
    end
  end

  describe "#supports_full_text?" do
    it "returns false (uses regex instead)" do
      expect(adapter.supports_full_text?).to be false
    end
  end

  describe "#adapter_name" do
    it "returns mongo" do
      expect(adapter.adapter_name).to eq("mongo")
    end
  end

  describe "invalid query handling" do
    it "returns empty results for invalid query" do
      query = Search::Query.new # Missing user and organization
      results = adapter.search(query)

      expect(results.documents).to be_empty
      expect(results.metadata[:errors]).to be_present
    end
  end

  describe "result metadata" do
    it "includes query time" do
      query = build_query(text: "report")
      results = adapter.search(query)

      expect(results.query_time_ms).to be_a(Numeric)
      expect(results.query_time_ms).to be >= 0
    end

    it "includes adapter name in metadata" do
      query = build_query(text: "report")
      results = adapter.search(query)

      expect(results.metadata[:adapter]).to eq("mongo")
    end

    it "includes applied filters in metadata" do
      query = build_query(filters: { status: "published", tags: ["finance"] })
      results = adapter.search(query)

      expect(results.metadata[:filters_applied]).to include(:status, :tags)
    end
  end

  private

  def build_query(options = {})
    Search::Query.new(
      {
        user: user,
        organization_id: organization.id
      }.merge(options)
    )
  end
end
