# frozen_string_literal: true

require "rails_helper"

RSpec.describe Search::Results do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:documents) { create_list(:content_document, 5, organization: organization) }

  describe "#initialize" do
    it "creates results with documents" do
      results = described_class.new(
        documents: documents,
        total_count: 25,
        page: 1,
        per_page: 5
      )

      expect(results.documents).to eq(documents)
      expect(results.total_count).to eq(25)
      expect(results.page).to eq(1)
      expect(results.per_page).to eq(5)
    end

    it "accepts optional metadata" do
      results = described_class.new(
        documents: documents,
        total_count: 5,
        page: 1,
        per_page: 20,
        query_time_ms: 15.5,
        metadata: { adapter: "mongo" }
      )

      expect(results.query_time_ms).to eq(15.5)
      expect(results.metadata[:adapter]).to eq("mongo")
    end
  end

  describe "Enumerable" do
    let(:results) do
      described_class.new(
        documents: documents,
        total_count: 5,
        page: 1,
        per_page: 20
      )
    end

    it "is enumerable" do
      expect(results).to respond_to(:each)
      expect(results).to respond_to(:map)
    end

    it "iterates over documents" do
      titles = results.map(&:title)
      expect(titles.size).to eq(5)
    end
  end

  describe "#empty?" do
    it "returns true when no documents" do
      results = described_class.new(documents: [], total_count: 0, page: 1, per_page: 20)
      expect(results.empty?).to be true
    end

    it "returns false when documents exist" do
      results = described_class.new(documents: documents, total_count: 5, page: 1, per_page: 20)
      expect(results.empty?).to be false
    end
  end

  describe "pagination methods" do
    context "with multiple pages" do
      let(:results) do
        described_class.new(
          documents: documents,
          total_count: 55,
          page: 2,
          per_page: 20
        )
      end

      it "calculates total_pages" do
        expect(results.total_pages).to eq(3)
      end

      it "returns current_page" do
        expect(results.current_page).to eq(2)
      end

      it "returns next_page" do
        expect(results.next_page).to eq(3)
      end

      it "returns prev_page" do
        expect(results.prev_page).to eq(1)
      end

      it "returns has_more?" do
        expect(results.has_more?).to be true
      end

      it "returns first_page?" do
        expect(results.first_page?).to be false
      end

      it "returns last_page?" do
        expect(results.last_page?).to be false
      end
    end

    context "on first page" do
      let(:results) do
        described_class.new(
          documents: documents,
          total_count: 25,
          page: 1,
          per_page: 20
        )
      end

      it "returns nil for prev_page" do
        expect(results.prev_page).to be_nil
      end

      it "returns true for first_page?" do
        expect(results.first_page?).to be true
      end
    end

    context "on last page" do
      let(:results) do
        described_class.new(
          documents: documents,
          total_count: 25,
          page: 2,
          per_page: 20
        )
      end

      it "returns nil for next_page" do
        expect(results.next_page).to be_nil
      end

      it "returns true for last_page?" do
        expect(results.last_page?).to be true
      end

      it "returns false for has_more?" do
        expect(results.has_more?).to be false
      end
    end
  end

  describe "#pagination" do
    it "returns pagination hash" do
      results = described_class.new(
        documents: documents,
        total_count: 55,
        page: 2,
        per_page: 20
      )

      pagination = results.pagination
      expect(pagination[:current_page]).to eq(2)
      expect(pagination[:per_page]).to eq(20)
      expect(pagination[:total_pages]).to eq(3)
      expect(pagination[:total_count]).to eq(55)
      expect(pagination[:has_next]).to be true
      expect(pagination[:has_prev]).to be true
    end
  end

  describe "#to_h" do
    it "serializes results to hash" do
      results = described_class.new(
        documents: documents,
        total_count: 5,
        page: 1,
        per_page: 20,
        query_time_ms: 10.5
      )

      hash = results.to_h
      expect(hash[:documents]).to be_an(Array)
      expect(hash[:documents].size).to eq(5)
      expect(hash[:pagination]).to be_a(Hash)
      expect(hash[:metadata][:query_time_ms]).to eq(10.5)
    end

    it "includes document details in serialization" do
      results = described_class.new(
        documents: [documents.first],
        total_count: 1,
        page: 1,
        per_page: 20
      )

      doc_hash = results.to_h[:documents].first
      expect(doc_hash[:id]).to eq(documents.first.id.to_s)
      expect(doc_hash[:uuid]).to eq(documents.first.uuid)
      expect(doc_hash[:title]).to eq(documents.first.title)
    end
  end

  describe ".empty" do
    it "creates empty results" do
      results = described_class.empty
      expect(results.documents).to be_empty
      expect(results.total_count).to eq(0)
      expect(results.page).to eq(1)
    end

    it "accepts custom pagination" do
      results = described_class.empty(page: 2, per_page: 10)
      expect(results.page).to eq(2)
      expect(results.per_page).to eq(10)
    end
  end
end
