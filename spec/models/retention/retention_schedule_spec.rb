# frozen_string_literal: true

require "rails_helper"

RSpec.describe Retention::RetentionSchedule, type: :model do
  let(:organization) { create(:organization) }
  let(:document) { create(:content_document, organization: organization) }
  let(:policy) { create(:retention_policy) }
  let(:user) { create(:user, organization: organization) }

  describe "validations" do
    it "is valid with valid attributes" do
      schedule = build(:retention_schedule, document: document, policy: policy, organization: organization)
      expect(schedule).to be_valid
    end

    it "validates status inclusion" do
      schedule = build(:retention_schedule, status: "invalid")
      expect(schedule).not_to be_valid
    end

    it "ensures document uniqueness" do
      create(:retention_schedule, document: document, organization: organization)
      duplicate = build(:retention_schedule, document: document, organization: organization)
      expect(duplicate).not_to be_valid
    end
  end

  describe "scopes" do
    let!(:active_schedule) { create(:retention_schedule, :active, organization: organization) }
    let!(:warning_schedule) { create(:retention_schedule, :warning, organization: organization) }
    let!(:pending_schedule) { create(:retention_schedule, :pending_action, organization: organization) }
    let!(:held_schedule) { create(:retention_schedule, :held, organization: organization) }

    describe ".active" do
      it "returns only active schedules" do
        expect(described_class.active).to include(active_schedule)
        expect(described_class.active).not_to include(warning_schedule, pending_schedule, held_schedule)
      end
    end

    describe ".held" do
      it "returns schedules under legal hold" do
        expect(described_class.held).to include(held_schedule)
        expect(described_class.held).not_to include(active_schedule)
      end
    end

    describe ".expiring_soon" do
      let!(:expiring_schedule) { create(:retention_schedule, :expiring_soon, organization: organization) }

      it "returns schedules expiring within specified days" do
        expect(described_class.expiring_soon(14)).to include(expiring_schedule)
      end
    end

    describe ".past_expiration" do
      let!(:past_schedule) { create(:retention_schedule, :past_expiration, organization: organization) }

      it "returns schedules past expiration date" do
        expect(described_class.past_expiration).to include(past_schedule)
      end
    end

    describe ".needs_warning" do
      let!(:needs_warning_schedule) { create(:retention_schedule, :needs_warning, organization: organization) }

      it "returns active schedules past warning date" do
        expect(described_class.needs_warning).to include(needs_warning_schedule)
      end
    end
  end

  describe "#under_legal_hold?" do
    let(:schedule) { create(:retention_schedule, organization: organization) }

    it "returns false when no legal holds" do
      expect(schedule.under_legal_hold?).to be false
    end

    it "returns true when active legal hold exists" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(schedule.under_legal_hold?).to be true
    end

    it "returns false when only released holds exist" do
      create(:legal_hold, :released, schedule: schedule, organization: organization, placed_by: user)
      expect(schedule.under_legal_hold?).to be false
    end
  end

  describe "#modification_allowed?" do
    let(:schedule) { create(:retention_schedule, organization: organization) }

    it "returns true for active schedules without hold" do
      expect(schedule.modification_allowed?).to be true
    end

    it "returns false when under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(schedule.modification_allowed?).to be false
    end

    it "returns false for archived schedules" do
      schedule.update!(status: described_class::STATUS_ARCHIVED)
      expect(schedule.modification_allowed?).to be false
    end

    it "returns false for expired schedules" do
      schedule.update!(status: described_class::STATUS_EXPIRED)
      expect(schedule.modification_allowed?).to be false
    end
  end

  describe "#deletion_allowed?" do
    it "always returns false - documents are never deleted" do
      schedule = create(:retention_schedule, organization: organization)
      expect(schedule.deletion_allowed?).to be false
    end
  end

  describe "#mark_warning!" do
    let(:schedule) { create(:retention_schedule, :active, organization: organization) }

    it "changes status to warning" do
      schedule.mark_warning!
      expect(schedule.status).to eq(described_class::STATUS_WARNING)
    end

    it "sets warning_sent_at" do
      schedule.mark_warning!
      expect(schedule.warning_sent_at).to be_present
    end

    it "increments warning_count" do
      expect { schedule.mark_warning! }.to change(schedule, :warning_count).by(1)
    end

    it "records in history" do
      schedule.mark_warning!
      expect(schedule.history.last["action"]).to eq("warning_sent")
    end

    it "does not change if under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      schedule.reload # Schedule status is now 'held' due to legal hold creation callback
      schedule.mark_warning!
      expect(schedule.status).to eq(described_class::STATUS_HELD) # Stays held
    end
  end

  describe "#archive!" do
    let(:schedule) { create(:retention_schedule, :pending_action, organization: organization) }

    it "changes status to archived" do
      expect(schedule.archive!(actor: user)).to be true
      expect(schedule.status).to eq(described_class::STATUS_ARCHIVED)
    end

    it "sets action_date and action_taken" do
      schedule.archive!(actor: user)
      expect(schedule.action_date).to be_present
      expect(schedule.action_taken).to eq(Retention::RetentionPolicy::ACTION_ARCHIVE)
    end

    it "updates document retention_status" do
      schedule.archive!(actor: user)
      expect(schedule.document.reload.retention_status).to eq("archived")
    end

    it "returns false when under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(schedule.archive!(actor: user)).to be false
    end
  end

  describe "#expire!" do
    let(:schedule) { create(:retention_schedule, :pending_action, organization: organization) }

    it "changes status to expired" do
      expect(schedule.expire!(actor: user)).to be true
      expect(schedule.status).to eq(described_class::STATUS_EXPIRED)
    end

    it "updates document retention_status" do
      schedule.expire!(actor: user)
      expect(schedule.document.reload.retention_status).to eq("expired")
    end

    it "returns false when under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(schedule.expire!(actor: user)).to be false
    end
  end

  describe "#place_on_hold!" do
    let(:schedule) { create(:retention_schedule, :active, organization: organization) }

    it "changes status to held" do
      schedule.place_on_hold!(reason: "Litigation")
      expect(schedule.status).to eq(described_class::STATUS_HELD)
    end

    it "records in history" do
      schedule.place_on_hold!(reason: "Litigation")
      expect(schedule.history.last["action"]).to eq("placed_on_hold")
      expect(schedule.history.last["details"]).to eq("Litigation")
    end
  end

  describe "#release_from_hold!" do
    let(:schedule) { create(:retention_schedule, :held, expiration_date: 1.year.from_now, organization: organization) }

    it "changes status back to active when no holds remain" do
      schedule.release_from_hold!
      expect(schedule.status).to eq(described_class::STATUS_ACTIVE)
    end

    it "changes to pending if past expiration" do
      schedule.update!(expiration_date: 1.day.ago)
      schedule.release_from_hold!
      expect(schedule.status).to eq(described_class::STATUS_PENDING_ACTION)
    end

    it "does not release if other holds exist" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      schedule.release_from_hold!
      expect(schedule.status).to eq(described_class::STATUS_HELD)
    end
  end

  describe "#extend_retention!" do
    let(:schedule) { create(:retention_schedule, expiration_date: 1.month.from_now, organization: organization) }

    it "extends expiration date" do
      original_date = schedule.expiration_date
      schedule.extend_retention!(additional_days: 90, actor: user, reason: "Business need")

      expect(schedule.expiration_date).to be_within(1.second).of(original_date + 90.days)
    end

    it "records in history" do
      schedule.extend_retention!(additional_days: 90, actor: user, reason: "Business need")
      expect(schedule.history.last["action"]).to eq("retention_extended")
      expect(schedule.history.last["details"]).to include("90 days")
    end

    it "returns false when under legal hold" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(schedule.extend_retention!(additional_days: 90, actor: user)).to be false
    end
  end

  describe "#days_until_expiration" do
    it "calculates days correctly" do
      schedule = create(:retention_schedule, expiration_date: 30.days.from_now, organization: organization)
      expect(schedule.days_until_expiration).to be_within(1).of(30)
    end

    it "returns nil when no expiration date" do
      schedule = create(:retention_schedule, expiration_date: nil, organization: organization)
      expect(schedule.days_until_expiration).to be_nil
    end
  end

  describe "#days_overdue" do
    it "returns 0 when not past expiration" do
      schedule = create(:retention_schedule, expiration_date: 30.days.from_now, organization: organization)
      expect(schedule.days_overdue).to eq(0)
    end

    it "calculates days overdue correctly" do
      schedule = create(:retention_schedule, expiration_date: 10.days.ago, organization: organization)
      expect(schedule.days_overdue).to be_within(1).of(10)
    end
  end
end
