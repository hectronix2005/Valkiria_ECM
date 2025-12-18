# frozen_string_literal: true

require "rails_helper"

RSpec.describe Search::Query do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }

  describe "#initialize" do
    it "accepts text as :text parameter" do
      query = described_class.new(text: "quarterly report", user: user, organization_id: organization.id)
      expect(query.text).to eq("quarterly report")
    end

    it "accepts text as :q parameter" do
      query = described_class.new(q: "quarterly report", user: user, organization_id: organization.id)
      expect(query.text).to eq("quarterly report")
    end

    it "defaults to empty string for text" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.text).to eq("")
    end

    it "sets default pagination values" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.page).to eq(1)
      expect(query.per_page).to eq(20)
    end

    it "limits per_page to maximum 100" do
      query = described_class.new(per_page: 500, user: user, organization_id: organization.id)
      expect(query.per_page).to eq(100)
    end

    it "normalizes filters" do
      query = described_class.new(
        filters: { tags: "finance", status: "published" },
        user: user,
        organization_id: organization.id
      )
      expect(query.filters[:tags]).to eq(["finance"])
      expect(query.filters[:status]).to eq("published")
    end
  end

  describe "#text?" do
    it "returns true when text is present and long enough" do
      query = described_class.new(text: "report", user: user, organization_id: organization.id)
      expect(query.text?).to be true
    end

    it "returns false when text is empty" do
      query = described_class.new(text: "", user: user, organization_id: organization.id)
      expect(query.text?).to be false
    end

    it "returns false when text is too short" do
      query = described_class.new(text: "a", user: user, organization_id: organization.id)
      expect(query.text?).to be false
    end
  end

  describe "#has_filters?" do
    it "returns true when filters are present" do
      query = described_class.new(
        filters: { status: "published" },
        user: user,
        organization_id: organization.id
      )
      expect(query.has_filters?).to be true
    end

    it "returns false when no filters" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.has_filters?).to be false
    end
  end

  describe "#filter" do
    it "returns filter value by key" do
      query = described_class.new(
        filters: { status: "published", tags: ["finance"] },
        user: user,
        organization_id: organization.id
      )
      expect(query.filter(:status)).to eq("published")
      expect(query.filter(:tags)).to eq(["finance"])
    end

    it "returns nil for missing filter" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.filter(:status)).to be_nil
    end
  end

  describe "#add_filter" do
    it "adds a supported filter" do
      query = described_class.new(user: user, organization_id: organization.id)
      query.add_filter(:status, "published")
      expect(query.filter(:status)).to eq("published")
    end

    it "ignores unsupported filters" do
      query = described_class.new(user: user, organization_id: organization.id)
      query.add_filter(:unsupported, "value")
      expect(query.filter(:unsupported)).to be_nil
    end

    it "returns self for chaining" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.add_filter(:status, "published")).to eq(query)
    end
  end

  describe "#offset" do
    it "calculates correct offset for page 1" do
      query = described_class.new(page: 1, per_page: 20, user: user, organization_id: organization.id)
      expect(query.offset).to eq(0)
    end

    it "calculates correct offset for page 3" do
      query = described_class.new(page: 3, per_page: 20, user: user, organization_id: organization.id)
      expect(query.offset).to eq(40)
    end
  end

  describe "#valid?" do
    it "returns true for valid query" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.valid?).to be true
    end

    it "returns false without organization_id" do
      query = described_class.new(user: user)
      expect(query.valid?).to be false
      expect(query.errors).to include("Organization ID is required")
    end

    it "returns false without user" do
      query = described_class.new(organization_id: organization.id)
      expect(query.valid?).to be false
      expect(query.errors).to include("User is required")
    end

    it "returns false for single character search" do
      query = described_class.new(text: "a", user: user, organization_id: organization.id)
      expect(query.valid?).to be false
      expect(query.errors).to include("Search text too short (minimum 2 characters)")
    end
  end

  describe "sort options" do
    it "defaults to relevance sort" do
      query = described_class.new(user: user, organization_id: organization.id)
      expect(query.sort).to eq(described_class::SORT_OPTIONS[:relevance])
    end

    it "accepts symbol sort option" do
      query = described_class.new(sort: :newest, user: user, organization_id: organization.id)
      expect(query.sort).to eq(described_class::SORT_OPTIONS[:newest])
    end

    it "accepts hash sort option" do
      query = described_class.new(sort: { title: :asc }, user: user, organization_id: organization.id)
      expect(query.sort).to eq({ title: :asc })
    end
  end

  describe "date filter normalization" do
    it "parses date strings" do
      query = described_class.new(
        filters: { created_after: "2024-01-01" },
        user: user,
        organization_id: organization.id
      )
      expect(query.filter(:created_after)).to be_a(Time)
    end

    it "accepts Time objects directly" do
      time = Time.current
      query = described_class.new(
        filters: { created_after: time },
        user: user,
        organization_id: organization.id
      )
      expect(query.filter(:created_after)).to eq(time)
    end
  end

  describe "#to_h" do
    it "serializes query to hash" do
      query = described_class.new(
        text: "report",
        filters: { status: "published" },
        page: 2,
        user: user,
        organization_id: organization.id
      )

      hash = query.to_h
      expect(hash[:text]).to eq("report")
      expect(hash[:filters]).to eq({ status: "published" })
      expect(hash[:page]).to eq(2)
      expect(hash[:organization_id]).to eq(organization.id.to_s)
    end
  end
end
