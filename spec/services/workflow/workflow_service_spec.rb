# frozen_string_literal: true

require "rails_helper"

RSpec.describe Workflow::WorkflowService do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:definition) { create(:workflow_definition, organization: organization) }
  let(:service) { described_class.new(user: user, organization: organization) }

  describe "#initialize" do
    it "sets user and organization" do
      expect(service.user).to eq(user)
      expect(service.organization).to eq(organization)
    end

    it "defaults to user's organization if not provided" do
      service = described_class.new(user: user)
      expect(service.organization).to eq(user.organization)
    end
  end

  describe "#start_workflow" do
    let(:document) { create(:content_document, organization: organization) }

    before do
      create(:workflow_definition, name: "test_flow", organization: organization)
    end

    it "starts a new workflow instance" do
      instance = service.start_workflow("test_flow", document: document)

      expect(instance).to be_persisted
      expect(instance.current_state).to eq("draft")
      expect(instance.document).to eq(document)
      expect(instance.initiated_by).to eq(user)
    end

    it "accepts context data" do
      instance = service.start_workflow("test_flow", context_data: { priority: "high" })

      expect(instance.context_data["priority"]).to eq("high")
    end

    it "raises error for unknown workflow" do
      expect do
        service.start_workflow("nonexistent")
      end.to raise_error(Workflow::WorkflowError, /not found/)
    end
  end

  describe "#transition" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "transitions to new state" do
      service.transition(instance, "review", comment: "Ready")

      expect(instance.current_state).to eq("review")
    end

    it "records comment in history" do
      service.transition(instance, "review", comment: "Ready for review")

      expect(instance.state_history.last["comment"]).to eq("Ready for review")
    end
  end

  describe "#perform_action" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "performs action by name" do
      service.perform_action(instance, "submit")

      expect(instance.current_state).to eq("review")
    end

    it "raises error for invalid action" do
      expect do
        service.perform_action(instance, "invalid_action")
      end.to raise_error(Workflow::WorkflowError, /not available/)
    end
  end

  describe "#available_actions" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "returns available actions from current state" do
      actions = service.available_actions(instance)

      expect(actions.size).to eq(1)
      expect(actions.first[:action]).to eq("submit")
      expect(actions.first[:to_state]).to eq("review")
    end

    it "returns empty array for completed workflow" do
      instance.update!(status: Workflow::WorkflowInstance::STATUS_COMPLETED)

      expect(service.available_actions(instance)).to be_empty
    end
  end

  describe "#cancel" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end

    it "cancels the workflow" do
      service.cancel(instance, reason: "No longer needed")

      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_CANCELLED)
      expect(instance.cancellation_reason).to eq("No longer needed")
    end
  end

  describe "#claim_task and #release_task" do
    let(:instance) do
      create(:workflow_instance,
             definition: definition,
             organization: organization,
             initiated_by: user)
    end
    let(:task) { instance.current_task }
    let(:employee_role) { Identity::Role.find_or_create_by!(name: "employee") { |r| r.display_name = "Employee" } }

    before do
      user.roles << employee_role
    end

    it "claims task for user" do
      service.claim_task(task)

      expect(task.assignee).to eq(user)
      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_IN_PROGRESS)
    end

    it "releases claimed task" do
      service.claim_task(task)
      service.release_task(task)

      expect(task.assignee).to be_nil
      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_PENDING)
    end
  end

  describe "#my_tasks" do
    let(:employee_role) { Identity::Role.find_or_create_by!(name: "employee") { |r| r.display_name = "Employee" } }
    let(:reviewer_role) { Identity::Role.find_or_create_by!(name: "reviewer") { |r| r.display_name = "Reviewer" } }

    before do
      user.roles << employee_role

      # Create tasks for different roles
      instance = create(:workflow_instance,
                        definition: definition,
                        organization: organization,
                        initiated_by: user)
      create(:workflow_task, state: "review", assigned_role: "reviewer",
                             instance: instance, organization: organization)
    end

    it "returns tasks for user's roles" do
      tasks = service.my_tasks

      expect(tasks.pluck(:assigned_role)).to include("employee")
      expect(tasks.pluck(:assigned_role)).not_to include("reviewer")
    end

    it "includes tasks assigned to user" do
      task = create(:workflow_task, :in_progress,
                    assignee: user,
                    assigned_role: "other",
                    instance: Workflow::WorkflowInstance.first,
                    organization: organization)

      tasks = service.my_tasks
      expect(tasks).to include(task)
    end
  end

  describe "#active_workflows" do
    before do
      create(:workflow_instance, definition: definition, organization: organization, initiated_by: user)
      create(:workflow_instance, :completed, definition: definition, organization: organization, initiated_by: user)
    end

    it "returns only active workflows" do
      workflows = service.active_workflows

      expect(workflows.count).to eq(1)
      expect(workflows.first.status).to eq(Workflow::WorkflowInstance::STATUS_ACTIVE)
    end
  end

  describe "#statistics" do
    before do
      create(:workflow_instance, definition: definition, organization: organization, initiated_by: user)
      create(:workflow_instance, :completed,
             definition: definition,
             organization: organization,
             initiated_by: user,
             completed_at: Time.current)
    end

    it "returns workflow statistics" do
      stats = service.statistics

      expect(stats[:active_workflows]).to eq(1)
      expect(stats[:completed_today]).to eq(1)
      expect(stats[:pending_tasks]).to be >= 0
    end
  end
end
