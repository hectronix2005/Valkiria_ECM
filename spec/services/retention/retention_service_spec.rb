# frozen_string_literal: true

require "rails_helper"

RSpec.describe Retention::RetentionService, type: :service do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:service) { described_class.new(user: user, organization: organization) }

  describe "#apply_policy" do
    let(:document) { create(:content_document, document_type: "contract", organization: organization) }
    let!(:policy) { create(:retention_policy, document_type: "contract") }

    it "creates a retention schedule for the document" do
      schedule = service.apply_policy(document)

      expect(schedule).to be_persisted
      expect(schedule.document).to eq(document)
      expect(schedule.policy).to eq(policy)
      expect(schedule.organization).to eq(organization)
    end

    it "sets expiration and warning dates" do
      schedule = service.apply_policy(document)

      expect(schedule.expiration_date).to be_present
      expect(schedule.warning_date).to be_present
    end

    it "returns existing schedule if present" do
      existing = create(:retention_schedule, document: document, policy: policy, organization: organization)
      schedule = service.apply_policy(document)

      expect(schedule).to eq(existing)
    end

    it "does not modify schedule under legal hold" do
      existing = create(:retention_schedule, document: document, policy: policy, organization: organization)
      create(:legal_hold, schedule: existing, organization: organization, placed_by: user)
      new_policy = create(:retention_policy, document_type: "contract", retention_period_days: 1000)

      schedule = service.apply_policy(document, policy: new_policy)
      expect(schedule.policy).to eq(policy) # Still original policy
    end
  end

  describe "#place_legal_hold" do
    let(:document) { create(:content_document, organization: organization) }

    it "creates a legal hold on the document" do
      hold = service.place_legal_hold(
        document,
        name: "Litigation Hold",
        hold_type: Retention::LegalHold::TYPE_LITIGATION,
        custodian_name: "Legal Team"
      )

      expect(hold).to be_persisted
      expect(hold.name).to eq("Litigation Hold")
      expect(hold.placed_by).to eq(user)
    end

    it "places document under legal hold" do
      service.place_legal_hold(
        document,
        name: "Litigation Hold",
        hold_type: Retention::LegalHold::TYPE_LITIGATION,
        custodian_name: "Legal Team"
      )

      expect(document.under_legal_hold?).to be true
    end
  end

  describe "#release_legal_hold" do
    let(:document) { create(:content_document, organization: organization) }
    let(:schedule) { create(:retention_schedule, document: document, organization: organization) }
    let!(:hold) { create(:legal_hold, schedule: schedule, organization: organization, placed_by: user) }

    it "releases the hold" do
      service.release_legal_hold(hold, reason: "Matter resolved")

      expect(hold.reload.status).to eq(Retention::LegalHold::STATUS_RELEASED)
      expect(hold.release_reason).to eq("Matter resolved")
    end
  end

  describe "#archive_document" do
    let(:document) { create(:content_document, organization: organization) }
    let!(:schedule) { create(:retention_schedule, :pending_action, document: document, organization: organization) }

    it "archives the document" do
      expect(service.archive_document(document)).to be true
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_ARCHIVED)
      expect(document.reload.retention_status).to eq("archived")
    end

    it "raises error when no schedule exists" do
      doc = create(:content_document, organization: organization)

      expect do
        service.archive_document(doc)
      end.to raise_error(Retention::RetentionError, /No retention schedule found/)
    end

    it "raises error when under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)

      expect do
        service.archive_document(document)
      end.to raise_error(Retention::RetentionError, /legal hold/)
    end
  end

  describe "#expire_document" do
    let(:document) { create(:content_document, organization: organization) }
    let!(:schedule) { create(:retention_schedule, :pending_action, document: document, organization: organization) }

    it "expires the document" do
      expect(service.expire_document(document)).to be true
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_EXPIRED)
    end

    it "raises error when under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)

      expect do
        service.expire_document(document)
      end.to raise_error(Retention::RetentionError, /legal hold/)
    end
  end

  describe "#extend_retention" do
    let(:document) { create(:content_document, organization: organization) }
    let!(:schedule) { create(:retention_schedule, document: document, organization: organization) }

    it "extends retention period" do
      original_date = schedule.expiration_date
      service.extend_retention(document, additional_days: 90, reason: "Business need")

      expect(schedule.reload.expiration_date).to be > original_date
    end
  end

  describe "#modification_allowed?" do
    let(:document) { create(:content_document, organization: organization) }

    it "returns true when no schedule" do
      expect(service.modification_allowed?(document)).to be true
    end

    it "returns true for active schedule without hold" do
      create(:retention_schedule, document: document, organization: organization)
      expect(service.modification_allowed?(document)).to be true
    end

    it "returns false when under legal hold" do
      schedule = create(:retention_schedule, document: document, organization: organization)
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)

      expect(service.modification_allowed?(document)).to be false
    end
  end

  describe "#under_legal_hold?" do
    let(:document) { create(:content_document, organization: organization) }

    it "returns false when no schedule" do
      expect(service.under_legal_hold?(document)).to be false
    end

    it "returns true when under hold" do
      schedule = create(:retention_schedule, document: document, organization: organization)
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)

      expect(service.under_legal_hold?(document)).to be true
    end
  end

  describe "#documents_expiring_soon" do
    let!(:expiring) do
      doc = create(:content_document, organization: organization)
      create(:retention_schedule, :expiring_soon, document: doc, organization: organization)
    end
    let!(:not_expiring) do
      doc = create(:content_document, organization: organization)
      create(:retention_schedule, document: doc, organization: organization, expiration_date: 1.year.from_now)
    end

    it "returns schedules expiring within days" do
      results = service.documents_expiring_soon(days: 14)
      expect(results).to include(expiring)
      expect(results).not_to include(not_expiring)
    end
  end

  describe "#statistics" do
    before do
      create(:retention_schedule, :active, organization: organization)
      create(:retention_schedule, :warning, organization: organization)
      create(:retention_schedule, :pending_action, organization: organization)
      create(:retention_schedule, :archived, organization: organization)
      create(:retention_schedule, :held, organization: organization)
    end

    it "returns accurate counts" do
      stats = service.statistics

      expect(stats[:total_scheduled]).to eq(5)
      expect(stats[:active]).to eq(1)
      expect(stats[:warning]).to eq(1)
      expect(stats[:pending_action]).to eq(1)
      expect(stats[:archived]).to eq(1)
      expect(stats[:held]).to eq(1)
    end
  end
end
