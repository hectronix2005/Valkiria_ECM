# frozen_string_literal: true

require "rails_helper"

RSpec.describe Retention::LegalHold, type: :model do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:document) { create(:content_document, organization: organization) }
  let(:schedule) { create(:retention_schedule, document: document, organization: organization) }

  describe "validations" do
    it "is valid with valid attributes" do
      hold = build(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(hold).to be_valid
    end

    it "requires a name" do
      hold = build(:legal_hold, name: nil, schedule: schedule, organization: organization, placed_by: user)
      expect(hold).not_to be_valid
    end

    it "requires a hold_type" do
      hold = build(:legal_hold, hold_type: nil, schedule: schedule, organization: organization, placed_by: user)
      expect(hold).not_to be_valid
    end

    it "validates hold_type inclusion" do
      hold = build(:legal_hold, hold_type: "invalid", schedule: schedule, organization: organization, placed_by: user)
      expect(hold).not_to be_valid
    end

    it "requires effective_date" do
      hold = build(:legal_hold, effective_date: nil, schedule: schedule, organization: organization, placed_by: user)
      expect(hold).not_to be_valid
    end

    it "requires custodian_name" do
      hold = build(:legal_hold, custodian_name: nil, schedule: schedule, organization: organization, placed_by: user)
      expect(hold).not_to be_valid
    end
  end

  describe "scopes" do
    let!(:active_hold) { create(:legal_hold, schedule: schedule, organization: organization, placed_by: user) }
    let(:other_schedule) { create(:retention_schedule, organization: organization) }
    let!(:released_hold) do
      create(:legal_hold, :released, schedule: other_schedule, organization: organization, placed_by: user)
    end

    describe ".active" do
      it "returns only active holds" do
        expect(described_class.active).to include(active_hold)
        expect(described_class.active).not_to include(released_hold)
      end
    end

    describe ".released" do
      it "returns only released holds" do
        expect(described_class.released).to include(released_hold)
        expect(described_class.released).not_to include(active_hold)
      end
    end

    describe ".by_type" do
      let!(:litigation_hold) do
        create(:legal_hold, :litigation, schedule: other_schedule, organization: organization, placed_by: user)
      end

      it "filters by hold type" do
        expect(described_class.by_type(described_class::TYPE_LITIGATION)).to include(litigation_hold)
      end
    end
  end

  describe "callbacks" do
    describe "after_create" do
      it "places schedule on hold" do
        create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
        expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_HELD)
      end

      it "logs audit event" do
        expect do
          create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
        end.to change { Audit::AuditEvent.where(action: "legal_hold_placed").count }.by(1)
      end
    end
  end

  describe "#release!" do
    let!(:hold) { create(:legal_hold, schedule: schedule, organization: organization, placed_by: user) }

    it "releases the hold" do
      expect(hold.release!(actor: user, reason: "Matter resolved")).to be true
      expect(hold.status).to eq(described_class::STATUS_RELEASED)
    end

    it "sets release information" do
      hold.release!(actor: user, reason: "Matter resolved")

      expect(hold.release_date).to be_present
      expect(hold.release_reason).to eq("Matter resolved")
      expect(hold.released_by_id).to eq(user.id)
      expect(hold.released_by_name).to eq(user.full_name)
    end

    it "records in history" do
      hold.release!(actor: user, reason: "Matter resolved")
      expect(hold.history.last["action"]).to eq("released")
    end

    it "returns false if already released" do
      hold.release!(actor: user, reason: "First release")
      expect(hold.release!(actor: user, reason: "Second release")).to be false
    end

    it "releases schedule from hold when last hold released" do
      hold.release!(actor: user, reason: "Matter resolved")
      expect(schedule.reload.status).not_to eq(Retention::RetentionSchedule::STATUS_HELD)
    end

    it "keeps schedule on hold if other active holds exist" do
      create(:legal_hold, schedule: schedule, organization: organization, placed_by: user, name: "Second Hold")
      hold.release!(actor: user, reason: "Matter resolved")

      expect(schedule.reload.status).to eq(Retention::RetentionSchedule::STATUS_HELD)
    end
  end

  describe "#extend!" do
    let!(:hold) do
      create(:legal_hold,
             :with_expected_release,
             schedule: schedule,
             organization: organization,
             placed_by: user)
    end

    it "updates expected release date" do
      new_date = 1.year.from_now
      expect(hold.extend!(new_expected_date: new_date, actor: user)).to be true
      expect(hold.expected_release_date).to be_within(1.second).of(new_date)
    end

    it "records in history" do
      hold.extend!(new_expected_date: 1.year.from_now, actor: user, reason: "Extended litigation")
      expect(hold.history.last["action"]).to eq("extended")
    end

    it "returns false if hold is released" do
      hold.release!(actor: user, reason: "Done")
      expect(hold.extend!(new_expected_date: 1.year.from_now, actor: user)).to be false
    end
  end

  describe "#hold_duration_days" do
    it "calculates duration for active hold" do
      hold = create(:legal_hold, effective_date: 30.days.ago, schedule: schedule,
                                 organization: organization, placed_by: user)
      expect(hold.hold_duration_days).to be_within(1).of(30)
    end

    it "calculates duration for released hold" do
      hold = create(:legal_hold, effective_date: 60.days.ago, schedule: schedule,
                                 organization: organization, placed_by: user)
      hold.update!(status: described_class::STATUS_RELEASED, release_date: 30.days.ago)

      expect(hold.hold_duration_days).to be_within(1).of(30)
    end
  end

  describe ".place_hold!" do
    it "creates legal hold and schedule if needed" do
      doc = create(:content_document, organization: organization)

      hold = described_class.place_hold!(
        document: doc,
        name: "New Litigation",
        hold_type: described_class::TYPE_LITIGATION,
        placed_by: user,
        organization: organization,
        custodian_name: "Legal Dept"
      )

      expect(hold).to be_persisted
      expect(hold.schedule).to be_present
      expect(doc.reload.retention_schedule).to be_present
    end

    it "uses existing schedule if present" do
      existing_schedule = create(:retention_schedule, document: document, organization: organization)

      hold = described_class.place_hold!(
        document: document,
        name: "New Litigation",
        hold_type: described_class::TYPE_LITIGATION,
        placed_by: user,
        organization: organization,
        custodian_name: "Legal Dept"
      )

      expect(hold.schedule).to eq(existing_schedule)
    end
  end

  describe "#document" do
    it "returns the document through schedule" do
      hold = create(:legal_hold, schedule: schedule, organization: organization, placed_by: user)
      expect(hold.document).to eq(document)
    end
  end

  describe "#hold_type_display" do
    it "returns titleized hold type" do
      hold = build(:legal_hold, hold_type: described_class::TYPE_LITIGATION)
      expect(hold.hold_type_display).to eq("Litigation")

      hold.hold_type = described_class::TYPE_REGULATORY
      expect(hold.hold_type_display).to eq("Regulatory")
    end
  end
end
