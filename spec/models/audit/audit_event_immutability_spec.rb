# frozen_string_literal: true

require "rails_helper"

# rubocop:disable RSpec/DescribeMethod
RSpec.describe Audit::AuditEvent, "immutability" do
  let(:audit_event) do
    described_class.create!(
      event_type: described_class::TYPES[:content],
      action: described_class::DOCUMENT_ACTIONS[:document_created],
      target_type: "Content::Document",
      target_id: BSON::ObjectId.new,
      actor_id: BSON::ObjectId.new,
      change_data: { title: "Test Document" },
      metadata: { test: true }
    )
  end

  describe "append-only guarantees" do
    context "instance-level immutability" do
      it "allows creation of new events" do
        expect do
          described_class.create!(
            event_type: "content",
            action: "test_action"
          )
        end.not_to raise_error
      end

      it "prevents save after creation" do
        # Bypass the setter check by using instance_variable_set
        audit_event.instance_variable_set(:@attributes, audit_event.attributes.merge("action" => "modified_action"))
        expect do
          audit_event.save
        end.to raise_error(described_class::ImmutableRecordError, /cannot be modified/)
      end

      it "prevents save! after creation" do
        expect do
          audit_event.save!
        end.to raise_error(described_class::ImmutableRecordError, /cannot be modified/)
      end

      it "prevents update" do
        expect do
          audit_event.update(action: "modified_action")
        end.to raise_error(described_class::ImmutableRecordError, /cannot be modified/)
      end

      it "prevents update!" do
        expect do
          audit_event.update!(action: "modified_action")
        end.to raise_error(described_class::ImmutableRecordError, /cannot be modified/)
      end

      it "prevents delete" do
        expect do
          audit_event.delete
        end.to raise_error(described_class::ImmutableRecordError, /cannot be deleted/)
      end

      it "prevents destroy" do
        expect do
          audit_event.destroy
        end.to raise_error(described_class::ImmutableRecordError, /cannot be deleted/)
      end

      it "prevents destroy!" do
        expect do
          audit_event.destroy!
        end.to raise_error(described_class::ImmutableRecordError, /cannot be deleted/)
      end

      it "prevents remove" do
        expect do
          audit_event.remove
        end.to raise_error(described_class::ImmutableRecordError, /cannot be deleted/)
      end

      it "marks record as readonly after creation" do
        expect(audit_event.readonly?).to be true
      end
    end

    context "class-level immutability" do
      before { audit_event } # Ensure at least one record exists

      it "prevents delete_all on class" do
        expect do
          described_class.delete_all
        end.to raise_error(described_class::ImmutableRecordError, /cannot be deleted in bulk/)
      end

      it "prevents destroy_all on class" do
        expect do
          described_class.destroy_all
        end.to raise_error(described_class::ImmutableRecordError, /cannot be deleted in bulk/)
      end

      it "prevents update_all on class" do
        expect do
          described_class.update_all(action: "hacked")
        end.to raise_error(described_class::ImmutableRecordError, /cannot be updated in bulk/)
      end

      # NOTE: Mongoid scoped queries use Criteria which doesn't inherit class methods
      # Individual instance protection still applies through save/update/delete overrides
      it "individual instances are protected even if retrieved via scope" do
        scoped_event = described_class.where(id: audit_event.id).first
        expect { scoped_event.update!(action: "hacked") }.to raise_error(described_class::ImmutableRecordError)
        expect { scoped_event.delete }.to raise_error(described_class::ImmutableRecordError)
        expect { scoped_event.destroy }.to raise_error(described_class::ImmutableRecordError)
      end
    end

    context "data integrity" do
      it "preserves original data after failed modification attempt" do
        original_action = audit_event.action
        original_event_type = audit_event.event_type
        event_id = audit_event.id

        begin
          audit_event.update!(action: "hacked", event_type: "hacked")
        rescue described_class::ImmutableRecordError
          # Expected
        end

        # Fetch fresh from database to verify data wasn't changed
        fresh_event = described_class.find(event_id)
        expect(fresh_event.action).to eq(original_action)
        expect(fresh_event.event_type).to eq(original_event_type)
      end

      it "verifies record count remains unchanged after delete attempts" do
        # Force creation of the audit_event first
        audit_event
        initial_count = described_class.count
        expect(initial_count).to be >= 1

        begin
          audit_event.delete
        rescue described_class::ImmutableRecordError
          # Expected
        end

        expect(described_class.count).to eq(initial_count)
      end

      it "retains all original field values" do
        original_attrs = audit_event.attributes.dup
        event_id = audit_event.id

        begin
          audit_event.update!(
            event_type: "hacked",
            action: "hacked",
            change_data: { hacked: true }
          )
        rescue described_class::ImmutableRecordError
          # Expected
        end

        # Fetch fresh from database
        fresh_event = described_class.find(event_id)
        # Compare specific fields that matter
        expect(fresh_event.event_type).to eq(original_attrs["event_type"])
        expect(fresh_event.action).to eq(original_attrs["action"])
        expect(fresh_event.change_data).to eq(original_attrs["change_data"])
      end
    end

    context "uuid immutability" do
      it "generates uuid automatically on creation" do
        event = described_class.create!(
          event_type: "content",
          action: "test"
        )
        expect(event.uuid).to be_present
        expect(event.uuid).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
      end

      it "preserves uuid after creation" do
        original_uuid = audit_event.uuid

        begin
          audit_event.update!(uuid: SecureRandom.uuid)
        rescue described_class::ImmutableRecordError
          # Expected
        end

        expect(audit_event.reload.uuid).to eq(original_uuid)
      end

      it "enforces uuid uniqueness" do
        existing_uuid = audit_event.uuid

        expect do
          described_class.create!(
            uuid: existing_uuid,
            event_type: "content",
            action: "test"
          )
        end.to raise_error(Mongoid::Errors::Validations)
      end
    end

    context "timestamp immutability" do
      it "sets created_at automatically" do
        expect(audit_event.created_at).to be_present
        expect(audit_event.created_at).to be_within(1.minute).of(Time.current)
      end

      it "does not have updated_at field" do
        # AuditEvent only includes Timestamps::Created, not full Timestamps
        expect(audit_event).not_to respond_to(:updated_at)
      end

      it "preserves created_at after modification attempts" do
        original_created_at = audit_event.created_at
        event_id = audit_event.id

        begin
          audit_event.update!(created_at: 1.year.ago)
        rescue described_class::ImmutableRecordError
          # Expected
        end

        # Fetch fresh from database
        fresh_event = described_class.find(event_id)
        # Use be_within to handle microsecond differences in MongoDB storage
        expect(fresh_event.created_at).to be_within(1.second).of(original_created_at)
      end
    end
  end

  describe "audit log consistency" do
    it "creates sequential audit events" do
      events = Array.new(5) do |i|
        described_class.create!(
          event_type: "content",
          action: "action_#{i}"
        )
      end

      # All should be persisted
      expect(events.all?(&:persisted?)).to be true

      # All should have unique uuids
      uuids = events.map(&:uuid)
      expect(uuids.uniq.size).to eq(5)

      # All should have increasing created_at (or equal within milliseconds)
      created_times = events.map(&:created_at)
      expect(created_times).to eq(created_times.sort)
    end

    it "maintains audit count accurately" do
      initial_count = described_class.count

      3.times do
        described_class.create!(event_type: "content", action: "test")
      end

      expect(described_class.count).to eq(initial_count + 3)
    end
  end
end
# rubocop:enable RSpec/DescribeMethod
