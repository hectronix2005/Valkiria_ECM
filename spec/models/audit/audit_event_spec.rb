# frozen_string_literal: true

require "rails_helper"

RSpec.describe Audit::AuditEvent, type: :model do
  describe "fields" do
    it { is_expected.to have_field(:uuid).of_type(String) }
    it { is_expected.to have_field(:event_type).of_type(String) }
    it { is_expected.to have_field(:action).of_type(String) }
    it { is_expected.to have_field(:actor_id).of_type(BSON::ObjectId) }
    it { is_expected.to have_field(:actor_type).of_type(String) }
    it { is_expected.to have_field(:actor_email).of_type(String) }
    it { is_expected.to have_field(:target_id).of_type(BSON::ObjectId) }
    it { is_expected.to have_field(:target_type).of_type(String) }
    it { is_expected.to have_field(:organization_id).of_type(BSON::ObjectId) }
    it { is_expected.to have_field(:change_data).of_type(Hash) }
    it { is_expected.to have_field(:metadata).of_type(Hash) }
    it { is_expected.to have_field(:tags).of_type(Array) }
    it { is_expected.to have_field(:request_id).of_type(String) }
    it { is_expected.to have_field(:ip_address).of_type(String) }
  end

  describe "validations" do
    subject { described_class.new(event_type: "test", action: "test") }

    it "requires uuid (generated automatically)" do
      event = described_class.new(event_type: "test", action: "test")
      event.valid?
      expect(event.uuid).to be_present
    end

    it { is_expected.to validate_presence_of(:event_type) }
    it { is_expected.to validate_presence_of(:action) }

    it "validates uniqueness of uuid" do
      existing = described_class.create!(event_type: "test", action: "test")
      duplicate = described_class.new(event_type: "test", action: "test", uuid: existing.uuid)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:uuid]).to be_present
    end
  end

  describe "indexes" do
    it { is_expected.to have_index_for(uuid: 1).with_options(unique: true) }
    it { is_expected.to have_index_for(event_type: 1) }
    it { is_expected.to have_index_for(action: 1) }
    it { is_expected.to have_index_for(actor_id: 1) }
    it { is_expected.to have_index_for(target_id: 1) }
    it { is_expected.to have_index_for(created_at: -1) }
  end

  describe "callbacks" do
    describe "#generate_uuid" do
      it "generates uuid before validation on create" do
        event = described_class.new(event_type: "test", action: "create")
        event.valid?
        expect(event.uuid).to be_present
      end
    end

    describe "#capture_request_context" do
      before do
        Current.request_id = "test-request-id"
        Current.ip_address = "127.0.0.1"
        Current.user_agent = "Test Agent"
      end

      after do
        Current.reset
      end

      it "captures request context on create" do
        event = described_class.create!(event_type: "test", action: "create")
        expect(event.request_id).to eq("test-request-id")
        expect(event.ip_address).to eq("127.0.0.1")
        expect(event.user_agent).to eq("Test Agent")
      end
    end
  end

  describe "immutability" do
    let(:event) { described_class.create!(event_type: "test", action: "create") }

    describe "#save" do
      it "raises error when trying to save existing record" do
        expect { event.save }
          .to raise_error(Audit::AuditEvent::ImmutableRecordError)
      end
    end

    describe "#update" do
      it "raises error when trying to update" do
        expect { event.update(action: "updated") }
          .to raise_error(Audit::AuditEvent::ImmutableRecordError)
      end
    end

    describe "#update!" do
      it "raises error when trying to update!" do
        expect { event.update!(action: "updated") }
          .to raise_error(Audit::AuditEvent::ImmutableRecordError)
      end
    end

    describe "#delete" do
      it "raises error when trying to delete" do
        expect { event.delete }
          .to raise_error(Audit::AuditEvent::ImmutableRecordError)
      end
    end

    describe "#destroy" do
      it "raises error when trying to destroy" do
        expect { event.destroy }
          .to raise_error(Audit::AuditEvent::ImmutableRecordError)
      end
    end
  end

  describe ".log" do
    let(:actor) do
      double("User",
             id: BSON::ObjectId.new,
             class: double(name: "Identity::User"),
             email: "test@example.com",
             full_name: "Test User",
             organization_id: BSON::ObjectId.new)
    end

    let(:target) do
      double("Document",
             id: BSON::ObjectId.new,
             class: double(name: "Content::Document"),
             uuid: SecureRandom.uuid,
             organization_id: nil)
    end

    it "creates an audit event with all attributes" do
      event = described_class.log(
        event_type: "content",
        action: "create",
        target: target,
        actor: actor,
        change_data: { title: ["", "New Title"] },
        metadata: { source: "web" },
        tags: ["important"]
      )

      expect(event).to be_persisted
      expect(event.event_type).to eq("content")
      expect(event.action).to eq("create")
      expect(event.actor_id).to eq(actor.id)
      expect(event.actor_email).to eq("test@example.com")
      expect(event.target_id).to eq(target.id)
      expect(event.target_type).to eq("Content::Document")
      expect(event.change_data).to eq({ "title" => ["", "New Title"] })
      expect(event.tags).to eq(["important"])
    end
  end

  describe "scopes" do
    let!(:event1) { described_class.create!(event_type: "content", action: "create", tags: ["important"]) }
    let!(:event2) { described_class.create!(event_type: "identity", action: "update", tags: ["routine"]) }

    describe ".by_event_type" do
      it "filters by event type" do
        expect(described_class.by_event_type("content")).to include(event1)
        expect(described_class.by_event_type("content")).not_to include(event2)
      end
    end

    describe ".by_action" do
      it "filters by action" do
        expect(described_class.by_action("create")).to include(event1)
        expect(described_class.by_action("create")).not_to include(event2)
      end
    end

    describe ".tagged" do
      it "filters by tag" do
        expect(described_class.tagged("important")).to include(event1)
        expect(described_class.tagged("important")).not_to include(event2)
      end
    end

    describe ".recent" do
      it "orders by created_at desc" do
        events = described_class.recent.to_a
        expect(events.first.created_at).to be >= events.last.created_at
      end
    end
  end
end
