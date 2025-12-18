# frozen_string_literal: true

require "rails_helper"

RSpec.describe Workflow::WorkflowDefinition do
  let(:organization) { create(:organization) }

  describe "validations" do
    it "requires name" do
      definition = build(:workflow_definition, name: nil)
      expect(definition).not_to be_valid
      expect(definition.errors[:name]).to include("can't be blank")
    end

    it "requires initial_state" do
      definition = build(:workflow_definition, initial_state: nil)
      expect(definition).not_to be_valid
      expect(definition.errors[:initial_state]).to include("can't be blank")
    end

    it "requires states" do
      definition = build(:workflow_definition, states: [])
      expect(definition).not_to be_valid
      expect(definition.errors[:states]).to include("can't be blank")
    end

    it "validates initial_state is in states" do
      definition = build(:workflow_definition, initial_state: "invalid", states: ["draft", "review"])
      expect(definition).not_to be_valid
      expect(definition.errors[:initial_state]).to include("must be one of the defined states")
    end

    it "validates final_states are in states" do
      definition = build(:workflow_definition, final_states: ["approved", "invalid"], states: ["draft", "approved"])
      expect(definition).not_to be_valid
      expect(definition.errors[:final_states]).to include(/contains invalid states/)
    end

    it "validates transitions have valid states" do
      definition = build(:workflow_definition,
                         states: ["draft", "review"],
                         transitions: [{ "from" => "draft", "to" => "invalid" }])
      expect(definition).not_to be_valid
      expect(definition.errors[:transitions]).to include(/contains invalid states/)
    end

    it "validates transitions have from and to" do
      definition = build(:workflow_definition,
                         transitions: [{ "from" => "draft" }])
      expect(definition).not_to be_valid
      expect(definition.errors[:transitions]).to include("must have 'from' and 'to' states")
    end

    it "creates valid workflow definition" do
      definition = build(:workflow_definition, organization: organization)
      expect(definition).to be_valid
    end
  end

  describe "scopes" do
    let!(:active_workflow) { create(:workflow_definition, active: true, organization: organization) }
    let!(:inactive_workflow) { create(:workflow_definition, :inactive, organization: organization) }
    let!(:contract_workflow) do
      create(:workflow_definition, document_type: "contract", organization: organization)
    end

    it ".active returns only active workflows" do
      expect(described_class.active).to include(active_workflow, contract_workflow)
      expect(described_class.active).not_to include(inactive_workflow)
    end

    it ".for_document_type filters by type" do
      expect(described_class.for_document_type("contract")).to include(contract_workflow)
      expect(described_class.for_document_type("contract")).not_to include(active_workflow)
    end
  end

  describe "#transition_allowed?" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "returns true for valid transitions" do
      expect(definition.transition_allowed?("draft", "review")).to be true
      expect(definition.transition_allowed?("review", "approved")).to be true
    end

    it "returns false for invalid transitions" do
      expect(definition.transition_allowed?("draft", "approved")).to be false
      expect(definition.transition_allowed?("approved", "draft")).to be false
    end
  end

  describe "#available_transitions" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "returns available target states from current state" do
      expect(definition.available_transitions("draft")).to eq(["review"])
      expect(definition.available_transitions("review")).to contain_exactly("approved", "rejected", "draft")
    end

    it "returns empty array for final states" do
      expect(definition.available_transitions("approved")).to be_empty
    end
  end

  describe "#step_for" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "returns step configuration for state" do
      step = definition.step_for("review")
      expect(step["assigned_role"]).to eq("reviewer")
      expect(step["sla_hours"]).to eq(24)
    end

    it "returns empty hash for unknown state" do
      expect(definition.step_for("unknown")).to eq({})
    end
  end

  describe "#assigned_role_for" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "returns assigned role for state" do
      expect(definition.assigned_role_for("draft")).to eq("employee")
      expect(definition.assigned_role_for("review")).to eq("reviewer")
    end

    it "returns nil for states without assigned role" do
      expect(definition.assigned_role_for("approved")).to be_nil
    end
  end

  describe "#sla_hours_for" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "returns SLA hours for state" do
      expect(definition.sla_hours_for("review")).to eq(24)
    end

    it "returns default SLA for states without specific SLA" do
      expect(definition.sla_hours_for("draft")).to eq(24) # default_sla_hours
    end
  end

  describe "#final_state?" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "returns true for final states" do
      expect(definition.final_state?("approved")).to be true
      expect(definition.final_state?("rejected")).to be true
    end

    it "returns false for non-final states" do
      expect(definition.final_state?("draft")).to be false
      expect(definition.final_state?("review")).to be false
    end
  end

  describe "#create_instance!" do
    let(:definition) { create(:workflow_definition, organization: organization) }
    let(:user) { create(:user, organization: organization) }
    let(:document) { create(:content_document, organization: organization) }

    it "creates a new workflow instance" do
      instance = definition.create_instance!(document: document, initiated_by: user)

      expect(instance).to be_persisted
      expect(instance.definition).to eq(definition)
      expect(instance.document).to eq(document)
      expect(instance.initiated_by).to eq(user)
      expect(instance.current_state).to eq(definition.initial_state)
      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_ACTIVE)
    end

    it "uses document organization if definition has none" do
      definition.update!(organization: nil)
      instance = definition.create_instance!(document: document, initiated_by: user)

      expect(instance.organization).to eq(document.organization)
    end
  end

  describe "#create_new_version!" do
    let(:definition) { create(:workflow_definition, organization: organization) }

    it "creates a new version with incremented version number" do
      new_version = definition.create_new_version!

      expect(new_version.version).to eq(2)
      expect(new_version.name).to eq(definition.name)
      expect(new_version.active).to be true
    end

    it "deactivates the old version" do
      definition.create_new_version!
      definition.reload

      expect(definition.active).to be false
    end
  end

  describe ".find_latest" do
    before do
      create(:workflow_definition, name: "test_workflow", version: 1, active: false, organization: organization)
      create(:workflow_definition, name: "test_workflow", version: 2, active: true, organization: organization)
      create(:workflow_definition, name: "test_workflow", version: 3, active: true, organization: organization)
    end

    it "finds the latest active version" do
      latest = described_class.find_latest("test_workflow")

      expect(latest.version).to eq(3)
    end

    it "returns nil if no active versions exist" do
      described_class.where(name: "test_workflow").update_all(active: false)

      expect(described_class.find_latest("test_workflow")).to be_nil
    end
  end

  describe ".seed_contract_approval!" do
    it "creates contract approval workflow" do
      workflow = described_class.seed_contract_approval!

      expect(workflow.name).to eq("contract_approval")
      expect(workflow.initial_state).to eq("draft")
      expect(workflow.states).to eq(["draft", "legal_review", "approved", "rejected"])
      expect(workflow.final_states).to eq(["approved", "rejected"])
    end

    it "is idempotent" do
      described_class.seed_contract_approval!
      expect { described_class.seed_contract_approval! }.not_to change(described_class, :count)
    end
  end
end
