# frozen_string_literal: true

require "rails_helper"

RSpec.describe Workflow::WorkflowInstance do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:definition) { create(:workflow_definition, organization: organization) }

  describe "validations" do
    it "requires current_state" do
      instance = build(:workflow_instance, current_state: nil, definition: definition)
      expect(instance).not_to be_valid
      expect(instance.errors[:current_state]).to include("can't be blank")
    end

    it "requires valid status" do
      instance = build(:workflow_instance, status: "invalid", definition: definition)
      expect(instance).not_to be_valid
      expect(instance.errors[:status]).to be_present
    end

    it "validates current_state is valid for definition" do
      instance = build(:workflow_instance, current_state: "invalid_state", definition: definition)
      expect(instance).not_to be_valid
      expect(instance.errors[:current_state]).to include("is not a valid state for this workflow")
    end

    it "creates valid instance" do
      instance = build(:workflow_instance,
                       definition: definition,
                       organization: organization,
                       initiated_by: user)
      expect(instance).to be_valid
    end
  end

  describe "scopes" do
    let!(:active_instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end
    let!(:completed_instance) do
      create(:workflow_instance, :completed,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end
    let!(:cancelled_instance) do
      create(:workflow_instance, :cancelled,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it ".active returns only active instances" do
      expect(described_class.active).to include(active_instance)
      expect(described_class.active).not_to include(completed_instance, cancelled_instance)
    end

    it ".completed returns only completed instances" do
      expect(described_class.completed).to include(completed_instance)
      expect(described_class.completed).not_to include(active_instance)
    end

    it ".in_state filters by current state" do
      expect(described_class.in_state("draft")).to include(active_instance)
      expect(described_class.in_state("approved")).to include(completed_instance)
    end
  end

  describe "#active?" do
    it "returns true for active instances" do
      instance = build(:workflow_instance, status: Workflow::WorkflowInstance::STATUS_ACTIVE)
      expect(instance.active?).to be true
    end

    it "returns false for non-active instances" do
      instance = build(:workflow_instance, status: Workflow::WorkflowInstance::STATUS_COMPLETED)
      expect(instance.active?).to be false
    end
  end

  describe "#in_final_state?" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "returns false when not in final state" do
      expect(instance.in_final_state?).to be false
    end

    it "returns true when in final state" do
      instance.update!(current_state: "approved")
      expect(instance.in_final_state?).to be true
    end
  end

  describe "#available_transitions" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "returns available transitions from current state" do
      expect(instance.available_transitions).to eq(["review"])
    end
  end

  describe "#can_transition_to?" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "returns true for valid transitions" do
      expect(instance.can_transition_to?("review")).to be true
    end

    it "returns false for invalid transitions" do
      expect(instance.can_transition_to?("approved")).to be false
    end

    it "returns false when not active" do
      instance.update!(status: Workflow::WorkflowInstance::STATUS_CANCELLED)
      expect(instance.can_transition_to?("review")).to be false
    end
  end

  describe "#transition_to!" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end
    let(:actor) { create(:user, organization: organization) }

    it "transitions to new state" do
      instance.transition_to!("review", actor: actor)

      expect(instance.current_state).to eq("review")
      expect(instance.state_history.last["to"]).to eq("review")
    end

    it "records transition in history" do
      instance.transition_to!("review", actor: actor, comment: "Ready for review")

      history_entry = instance.state_history.last
      expect(history_entry["from"]).to eq("draft")
      expect(history_entry["to"]).to eq("review")
      expect(history_entry["actor_id"]).to eq(actor.id.to_s)
      expect(history_entry["comment"]).to eq("Ready for review")
    end

    it "creates task for new state" do
      instance.transition_to!("review", actor: actor)

      new_task = instance.tasks.where(state: "review").first
      expect(new_task).to be_present
      expect(new_task.assigned_role).to eq("reviewer")
    end

    it "completes workflow when reaching final state" do
      instance.update!(current_state: "review")
      instance.tasks.pending.destroy_all
      instance.tasks.create!(state: "review", organization: organization)

      instance.transition_to!("approved", actor: actor)

      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_COMPLETED)
      expect(instance.completed_at).to be_present
    end

    it "raises error for invalid transition" do
      expect do
        instance.transition_to!("approved", actor: actor)
      end.to raise_error(Workflow::WorkflowError, /Transition not allowed/)
    end

    it "raises error when not active" do
      instance.update!(status: Workflow::WorkflowInstance::STATUS_CANCELLED)

      expect do
        instance.transition_to!("review", actor: actor)
      end.to raise_error(Workflow::WorkflowError, /not active/)
    end

    it "enqueues notification job" do
      expect do
        instance.transition_to!("review", actor: actor)
      end.to have_enqueued_job(WorkflowNotificationJob).with("transition", instance.id.to_s, anything)
    end
  end

  describe "#cancel!" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "cancels the workflow" do
      instance.cancel!(actor: user, reason: "No longer needed")

      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_CANCELLED)
      expect(instance.cancelled_at).to be_present
      expect(instance.cancellation_reason).to eq("No longer needed")
    end

    it "records cancellation in history" do
      instance.cancel!(actor: user, reason: "Test")

      history_entry = instance.state_history.last
      expect(history_entry["action"]).to eq("cancel")
      expect(history_entry["actor_id"]).to eq(user.id.to_s)
    end

    it "cancels pending tasks" do
      task = instance.tasks.first
      instance.cancel!(actor: user)

      task.reload
      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_CANCELLED)
    end

    it "raises error when not active" do
      instance.update!(status: Workflow::WorkflowInstance::STATUS_COMPLETED)

      expect do
        instance.cancel!(actor: user)
      end.to raise_error(Workflow::WorkflowError, /not active/)
    end
  end

  describe "#suspend! and #resume!" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "suspends the workflow" do
      instance.suspend!(actor: user, reason: "Pending approval")

      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_SUSPENDED)
    end

    it "resumes the workflow" do
      instance.suspend!(actor: user)
      instance.resume!(actor: user)

      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_ACTIVE)
    end

    it "raises error when resuming non-suspended workflow" do
      expect do
        instance.resume!(actor: user)
      end.to raise_error(Workflow::WorkflowError, /not suspended/)
    end
  end

  describe "#current_task" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "returns the pending task for current state" do
      task = instance.current_task

      expect(task).to be_present
      expect(task.state).to eq(instance.current_state)
      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_PENDING)
    end
  end

  describe "#duration" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user,
             started_at: 2.hours.ago)
    end

    it "returns duration for active workflow" do
      expect(instance.duration).to be_within(1.minute).of(2.hours)
    end

    it "returns duration for completed workflow" do
      instance.update!(
        status: Workflow::WorkflowInstance::STATUS_COMPLETED,
        completed_at: 1.hour.ago
      )

      expect(instance.duration).to be_within(1.minute).of(1.hour)
    end
  end

  describe "callbacks" do
    it "creates initial task on create" do
      instance = create(:workflow_instance,
                        definition: definition,
                        organization: organization,
                        initiated_by: user)

      expect(instance.tasks.count).to eq(1)
      expect(instance.tasks.first.state).to eq(definition.initial_state)
    end

    it "records audit event on create" do
      expect do
        create(:workflow_instance,
               definition: definition,
               organization: organization,
               initiated_by: user)
      end.to change { Audit::AuditEvent.by_action("workflow_started").count }.by(1)
    end
  end
end
