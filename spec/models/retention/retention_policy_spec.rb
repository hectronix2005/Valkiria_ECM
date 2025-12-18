# frozen_string_literal: true

require "rails_helper"

RSpec.describe Retention::RetentionPolicy, type: :model do
  describe "validations" do
    it "is valid with valid attributes" do
      policy = build(:retention_policy)
      expect(policy).to be_valid
    end

    it "requires a name" do
      policy = build(:retention_policy, name: nil)
      expect(policy).not_to be_valid
      expect(policy.errors[:name]).to include("can't be blank")
    end

    it "requires a document_type" do
      policy = build(:retention_policy, document_type: nil)
      expect(policy).not_to be_valid
      expect(policy.errors[:document_type]).to include("can't be blank")
    end

    it "requires retention_period_days to be positive" do
      policy = build(:retention_policy, retention_period_days: 0)
      expect(policy).not_to be_valid

      policy.retention_period_days = -1
      expect(policy).not_to be_valid

      policy.retention_period_days = 365
      expect(policy).to be_valid
    end

    it "validates retention_trigger is in allowed values" do
      policy = build(:retention_policy, retention_trigger: "invalid")
      expect(policy).not_to be_valid
    end

    it "validates expiration_action is in allowed values" do
      policy = build(:retention_policy, expiration_action: "invalid")
      expect(policy).not_to be_valid
    end
  end

  describe "scopes" do
    let!(:active_policy) { create(:retention_policy, active: true) }
    let!(:inactive_policy) { create(:retention_policy, active: false) }
    let!(:contract_policy) { create(:retention_policy, document_type: "contract", priority: 10) }
    let!(:invoice_policy) { create(:retention_policy, document_type: "invoice", priority: 5) }

    describe ".active" do
      it "returns only active policies" do
        expect(described_class.active).to include(active_policy, contract_policy, invoice_policy)
        expect(described_class.active).not_to include(inactive_policy)
      end
    end

    describe ".for_document_type" do
      it "returns policies for specific document type" do
        expect(described_class.for_document_type("contract")).to include(contract_policy)
        expect(described_class.for_document_type("contract")).not_to include(invoice_policy)
      end
    end

    describe ".by_priority" do
      it "orders by priority descending" do
        policies = described_class.by_priority
        expect(policies.first.priority).to be >= policies.last.priority
      end
    end
  end

  describe "#calculate_expiration_date" do
    let(:document) { create(:content_document, created_at: 1.year.ago, updated_at: 6.months.ago) }

    context "with creation trigger" do
      let(:policy) do
        create(:retention_policy,
               retention_trigger: described_class::TRIGGER_CREATION,
               retention_period_days: 365)
      end

      it "calculates from creation date" do
        expected = document.created_at + 365.days
        expect(policy.calculate_expiration_date(document)).to be_within(1.second).of(expected)
      end
    end

    context "with last_modified trigger" do
      let(:policy) do
        create(:retention_policy,
               retention_trigger: described_class::TRIGGER_LAST_MODIFIED,
               retention_period_days: 365)
      end

      it "calculates from last modified date" do
        expected = document.updated_at + 365.days
        expect(policy.calculate_expiration_date(document)).to be_within(1.second).of(expected)
      end
    end

    context "with workflow_complete trigger" do
      let(:policy) do
        create(:retention_policy,
               retention_trigger: described_class::TRIGGER_WORKFLOW_COMPLETE,
               retention_period_days: 365)
      end

      it "returns nil when no completed workflow exists" do
        expect(policy.calculate_expiration_date(document)).to be_nil
      end
    end
  end

  describe "#retention_period_text" do
    it "displays years for long periods" do
      policy = build(:retention_policy, retention_period_days: 7 * 365)
      expect(policy.retention_period_text).to eq("7 years")
    end

    it "displays months for medium periods" do
      policy = build(:retention_policy, retention_period_days: 90)
      expect(policy.retention_period_text).to eq("3 months")
    end

    it "displays days for short periods" do
      policy = build(:retention_policy, retention_period_days: 15)
      expect(policy.retention_period_text).to eq("15 days")
    end

    it "handles singular correctly" do
      policy = build(:retention_policy, retention_period_days: 365)
      expect(policy.retention_period_text).to eq("1 year")

      policy.retention_period_days = 1
      expect(policy.retention_period_text).to eq("1 day")
    end
  end

  describe ".find_policy_for" do
    let(:organization) { create(:organization) }
    let(:document) { create(:content_document, document_type: "contract", organization: organization) }
    let!(:global_policy) { create(:retention_policy, document_type: "contract", priority: 5) }
    let!(:org_policy) do
      create(:retention_policy, document_type: "contract", organization: organization, priority: 10)
    end

    it "prefers organization-specific policy" do
      policy = described_class.find_policy_for(document, organization: organization)
      expect(policy).to eq(org_policy)
    end

    it "falls back to global policy if no org policy" do
      org_policy.destroy
      policy = described_class.find_policy_for(document, organization: organization)
      expect(policy).to eq(global_policy)
    end

    it "returns nil if no matching policy" do
      document.update!(document_type: "unknown_type")
      policy = described_class.find_policy_for(document, organization: organization)
      expect(policy).to be_nil
    end
  end

  describe ".seed_defaults!" do
    it "creates default retention policies" do
      expect { described_class.seed_defaults! }.to change(described_class, :count).by(4)
    end

    it "is idempotent" do
      described_class.seed_defaults!
      expect { described_class.seed_defaults! }.not_to change(described_class, :count)
    end

    it "creates expected policies" do
      described_class.seed_defaults!

      expect(described_class.find_by(name: "Contract Retention")).to be_present
      expect(described_class.find_by(name: "Invoice Retention")).to be_present
      expect(described_class.find_by(name: "HR Document Retention")).to be_present
      expect(described_class.find_by(name: "General Document Retention")).to be_present
    end
  end
end
