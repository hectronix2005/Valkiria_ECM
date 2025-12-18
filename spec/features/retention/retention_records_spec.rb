# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Retention/Records Management E2E", type: :feature do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:legal_user) { create(:user, organization: organization) }
  let(:service) { Retention::RetentionService.new(user: user, organization: organization) }

  describe "Data Preservation - Documents are NEVER physically deleted" do
    let(:document) { create(:content_document, organization: organization) }
    let!(:schedule) { create(:retention_schedule, document: document, organization: organization) }

    it "deletion_allowed? always returns false" do
      expect(schedule.deletion_allowed?).to be false
    end

    it "archived documents are still accessible" do
      schedule.archive!(actor: user)

      # Document should still exist and be queryable
      expect(Content::Document.find(document.id)).to eq(document)
      expect(document.reload.retention_status).to eq("archived")
    end

    it "expired documents are still accessible" do
      schedule.expire!(actor: user)

      # Document should still exist
      expect(Content::Document.find(document.id)).to eq(document)
      expect(document.reload.retention_status).to eq("expired")
    end

    it "documents remain after retention processing" do
      # Create a document past expiration
      old_doc = create(:content_document, organization: organization, created_at: 2.years.ago)
      create(:retention_schedule,
             document: old_doc,
             organization: organization,
             status: Retention::RetentionSchedule::STATUS_PENDING_ACTION,
             expiration_date: 1.day.ago)

      # Run processor
      RetentionProcessorJob.perform_now(organization.id.to_s)

      # Document MUST still exist
      expect(Content::Document.find(old_doc.id)).to eq(old_doc)
    end
  end

  describe "Legal Hold Blocks All Changes" do
    let(:document) { create(:content_document, title: "Original Title", organization: organization) }
    let!(:schedule) { create(:retention_schedule, document: document, organization: organization) }

    before do
      # Place document under legal hold
      service.place_legal_hold(
        document,
        name: "Litigation Hold - Case #2024-001",
        hold_type: Retention::LegalHold::TYPE_LITIGATION,
        custodian_name: "Legal Department",
        reference_number: "LIT-2024-001"
      )
    end

    it "prevents document title modification" do
      document.title = "Modified Title"
      expect(document.save).to be false
      expect(document.errors[:base]).to include("Document is under legal hold and cannot be modified")
    end

    it "prevents document status changes" do
      document.status = Content::Document::STATUS_ARCHIVED
      expect(document.save).to be false
    end

    it "prevents document metadata changes" do
      document.metadata = { "key" => "value" }
      expect(document.save).to be false
    end

    it "prevents creating new versions" do
      expect do
        document.create_version!(file_name: "new_version.pdf", content_type: "application/pdf")
      end.to raise_error(Content::Document::LegalHoldError)
    end

    it "prevents archiving through schedule" do
      result = schedule.archive!(actor: user)
      expect(result).to be false
      expect(schedule.status).not_to eq(Retention::RetentionSchedule::STATUS_ARCHIVED)
    end

    it "prevents expiring through schedule" do
      result = schedule.expire!(actor: user)
      expect(result).to be false
      expect(schedule.status).not_to eq(Retention::RetentionSchedule::STATUS_EXPIRED)
    end

    it "prevents retention extension" do
      result = schedule.extend_retention!(additional_days: 90, actor: user)
      expect(result).to be false
    end

    it "blocks retention processor from acting on held documents" do
      # NOTE: The before block places a legal hold, which changes status to 'held'
      # So we just verify it stays held after processor runs
      schedule.update!(expiration_date: 1.day.ago)

      RetentionProcessorJob.perform_now(organization.id.to_s)

      # Status should remain 'held' (not marked pending)
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_HELD)
    end

    it "allows modification after hold is released" do
      hold = schedule.legal_holds.active.first
      hold.release!(actor: legal_user, reason: "Matter resolved")

      document.reload
      document.title = "Modified After Release"
      expect(document.save).to be true
    end
  end

  describe "Retention Policy Application" do
    let!(:contract_policy) do
      create(:retention_policy,
             name: "Contract Policy",
             document_type: "contract",
             retention_period_days: 7 * 365,
             retention_trigger: Retention::RetentionPolicy::TRIGGER_CREATION,
             warning_days: 90,
             expiration_action: Retention::RetentionPolicy::ACTION_ARCHIVE)
    end

    it "applies correct policy based on document type" do
      contract = create(:content_document, document_type: "contract", organization: organization)

      schedule = service.apply_policy(contract)

      expect(schedule.policy).to eq(contract_policy)
      # Allow 3 days tolerance due to leap year calculation (7*365 vs actual 7 years)
      expect(schedule.expiration_date).to be_within(3.days).of(contract.created_at + 7.years)
    end

    it "calculates warning date correctly" do
      contract = create(:content_document, document_type: "contract", organization: organization)

      schedule = service.apply_policy(contract)

      expected_warning = schedule.expiration_date - 90.days
      expect(schedule.warning_date).to be_within(1.day).of(expected_warning)
    end
  end

  describe "Retention Processing Workflow" do
    let!(:policy) do
      create(:retention_policy,
             document_type: "test_doc",
             retention_period_days: 30,
             warning_days: 7)
    end

    it "follows correct workflow: active -> warning -> pending -> archived" do
      # Create document that's 25 days old (within warning period)
      doc = create(:content_document,
                   document_type: "test_doc",
                   organization: organization,
                   created_at: 25.days.ago)

      schedule = create(:retention_schedule,
                        document: doc,
                        policy: policy,
                        organization: organization,
                        status: Retention::RetentionSchedule::STATUS_ACTIVE,
                        warning_date: 2.days.ago,
                        expiration_date: 5.days.from_now)

      # Step 1: Process warnings
      RetentionProcessorJob.perform_now(organization.id.to_s)
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_WARNING)

      # Step 2: Move to past expiration
      schedule.update!(expiration_date: 1.day.ago)
      RetentionProcessorJob.perform_now(organization.id.to_s)
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_PENDING_ACTION)

      # Step 3: Archive (manual action by records manager)
      schedule.archive!(actor: user)
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_ARCHIVED)

      # Document still exists!
      expect(Content::Document.find(doc.id)).to be_present
    end
  end

  describe "Multiple Legal Holds" do
    let(:document) { create(:content_document, organization: organization) }
    let!(:schedule) { create(:retention_schedule, document: document, organization: organization) }

    it "keeps document held until ALL holds are released" do
      # Place two holds
      hold1 = service.place_legal_hold(
        document,
        name: "Litigation Hold",
        hold_type: Retention::LegalHold::TYPE_LITIGATION,
        custodian_name: "Legal"
      )

      hold2 = service.place_legal_hold(
        document,
        name: "Regulatory Hold",
        hold_type: Retention::LegalHold::TYPE_REGULATORY,
        custodian_name: "Compliance"
      )

      # Release first hold
      hold1.release!(actor: user, reason: "Litigation resolved")

      # Document should still be under hold
      expect(document.under_legal_hold?).to be true
      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_HELD)

      # Release second hold
      hold2.release!(actor: user, reason: "Regulatory matter closed")

      # Now document should be released
      expect(document.reload.under_legal_hold?).to be false
      expect(schedule.reload.status).not_to eq(Retention::RetentionSchedule::STATUS_HELD)
    end
  end

  describe "Audit Trail for Retention Actions" do
    let(:document) { create(:content_document, organization: organization) }
    let!(:schedule) { create(:retention_schedule, document: document, organization: organization) }

    it "logs archival action" do
      expect do
        schedule.archive!(actor: user)
      end.to change { Audit::AuditEvent.where(action: "document_archived").count }.by(1)

      event = Audit::AuditEvent.where(action: "document_archived").last
      expect(event.target_id).to eq(document.id)
      expect(event.actor_id).to eq(user.id)
    end

    it "logs expiration action" do
      expect do
        schedule.expire!(actor: user)
      end.to change { Audit::AuditEvent.where(action: "document_expired").count }.by(1)
    end

    it "logs legal hold placement" do
      expect do
        service.place_legal_hold(
          document,
          name: "Test Hold",
          hold_type: Retention::LegalHold::TYPE_LITIGATION,
          custodian_name: "Legal"
        )
      end.to change { Audit::AuditEvent.where(action: "legal_hold_placed").count }.by(1)
    end

    it "logs legal hold release" do
      hold = service.place_legal_hold(
        document,
        name: "Test Hold",
        hold_type: Retention::LegalHold::TYPE_LITIGATION,
        custodian_name: "Legal"
      )

      expect do
        hold.release!(actor: user, reason: "Matter closed")
      end.to change { Audit::AuditEvent.where(action: "legal_hold_released").count }.by(1)
    end

    it "logs retention extension" do
      expect do
        schedule.extend_retention!(additional_days: 365, actor: user, reason: "Business requirement")
      end.to change { Audit::AuditEvent.where(action: "retention_extended").count }.by(1)
    end
  end

  describe "Statistics and Reporting" do
    before do
      5.times { create(:retention_schedule, :active, organization: organization) }
      3.times { create(:retention_schedule, :warning, organization: organization) }
      2.times { create(:retention_schedule, :pending_action, organization: organization) }
      4.times { create(:retention_schedule, :archived, organization: organization) }
      create(:retention_schedule, :held, organization: organization)
    end

    it "provides accurate statistics" do
      stats = service.statistics

      expect(stats[:total_scheduled]).to eq(15)
      expect(stats[:active]).to eq(5)
      expect(stats[:warning]).to eq(3)
      expect(stats[:pending_action]).to eq(2)
      expect(stats[:archived]).to eq(4)
      expect(stats[:held]).to eq(1)
    end
  end
end
