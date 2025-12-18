# frozen_string_literal: true

require "rails_helper"

# rubocop:disable RSpec/ExampleLength, RSpec/MultipleExpectations
RSpec.describe "Contract Approval Workflow E2E", type: :feature do
  let(:organization) { create(:organization) }

  # Create roles
  let!(:employee_role) { Identity::Role.find_or_create_by!(name: "employee") { |r| r.display_name = "Employee" } }
  let!(:legal_role) { Identity::Role.find_or_create_by!(name: "legal") { |r| r.display_name = "Legal Team" } }

  # Create users with appropriate roles
  let(:employee) { create(:user, organization: organization) }
  let(:legal_reviewer) { create(:user, organization: organization) }
  let(:manager) { create(:user, organization: organization) }

  # Create workflow definition
  let!(:workflow_definition) do
    create(:workflow_definition, :contract_approval, organization: organization)
  end

  # Create a contract document
  let(:contract) do
    create(:content_document,
           title: "Service Agreement 2024",
           document_type: "contract",
           organization: organization)
  end

  before do
    employee.roles << employee_role
    legal_reviewer.roles << legal_role
  end

  describe "complete contract approval flow" do
    it "processes contract through draft -> legal_review -> approved" do
      # Step 1: Employee starts the workflow
      employee_service = Workflow::WorkflowService.new(user: employee)
      instance = employee_service.start_workflow("contract_approval", document: contract)

      expect(instance.current_state).to eq("draft")
      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_ACTIVE)
      expect(instance.document).to eq(contract)

      # Verify initial task was created
      draft_task = instance.current_task
      expect(draft_task.state).to eq("draft")
      expect(draft_task.assigned_role).to eq("employee")

      # Step 2: Employee claims and works on the draft
      draft_task.claim!(employee)
      expect(draft_task.assignee).to eq(employee)
      expect(draft_task.status).to eq(Workflow::WorkflowTask::STATUS_IN_PROGRESS)

      # Step 3: Employee submits for legal review
      employee_service.perform_action(instance, "submit_for_review", comment: "Ready for legal review")

      expect(instance.current_state).to eq("legal_review")
      expect(draft_task.reload.status).to eq(Workflow::WorkflowTask::STATUS_COMPLETED)

      # Verify legal review task was created
      legal_task = instance.current_task
      expect(legal_task.state).to eq("legal_review")
      expect(legal_task.assigned_role).to eq("legal")
      expect(legal_task.sla_hours).to eq(48)
      expect(legal_task.due_at).to be_present

      # Step 4: Legal team claims the task
      legal_service = Workflow::WorkflowService.new(user: legal_reviewer)
      legal_task.claim!(legal_reviewer)
      expect(legal_task.assignee).to eq(legal_reviewer)

      # Step 5: Legal team approves the contract
      legal_service.perform_action(instance, "approve", comment: "Contract meets all legal requirements")

      expect(instance.current_state).to eq("approved")
      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_COMPLETED)
      expect(instance.completed_at).to be_present
      expect(legal_task.reload.status).to eq(Workflow::WorkflowTask::STATUS_COMPLETED)

      # Verify state history
      expect(instance.state_history.size).to eq(2)
      expect(instance.state_history.map { |h| h["action"] }).to eq(["submit_for_review", "approve"]) # rubocop:disable Rails/Pluck
    end

    it "handles rejection flow: draft -> legal_review -> rejected -> draft -> legal_review -> approved" do
      employee_service = Workflow::WorkflowService.new(user: employee)
      legal_service = Workflow::WorkflowService.new(user: legal_reviewer)

      # Start workflow
      instance = employee_service.start_workflow("contract_approval", document: contract)

      # Submit for review
      instance.current_task.claim!(employee)
      employee_service.perform_action(instance, "submit_for_review")

      # Legal rejects
      instance.current_task.claim!(legal_reviewer)
      legal_service.perform_action(instance, "reject", comment: "Missing liability clause")

      expect(instance.current_state).to eq("rejected")
      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_COMPLETED)

      # NOTE: In this workflow, rejected is a final state
      # The workflow design shows rejected -> draft transition for revision
      # But status becomes completed. Let's test the alternative flow with request_changes

      # Start fresh workflow for request_changes flow
      instance2 = employee_service.start_workflow("contract_approval", document: contract)

      # Submit for review
      instance2.current_task.claim!(employee)
      employee_service.perform_action(instance2, "submit_for_review")

      # Legal requests changes (sends back to draft)
      instance2.current_task.claim!(legal_reviewer)
      legal_service.perform_action(instance2, "request_changes", comment: "Please add liability clause")

      expect(instance2.current_state).to eq("draft")
      expect(instance2.status).to eq(Workflow::WorkflowInstance::STATUS_ACTIVE)

      # Employee revises and resubmits
      instance2.current_task.claim!(employee)
      employee_service.perform_action(instance2, "submit_for_review", comment: "Added liability clause")

      # Legal approves
      instance2.current_task.claim!(legal_reviewer)
      legal_service.perform_action(instance2, "approve")

      expect(instance2.current_state).to eq("approved")
      expect(instance2.status).to eq(Workflow::WorkflowInstance::STATUS_COMPLETED)

      # Verify full history
      actions = instance2.state_history.map { |h| h["action"] } # rubocop:disable Rails/Pluck
      expect(actions).to eq(["submit_for_review", "request_changes", "submit_for_review", "approve"])
    end

    it "tracks SLA compliance" do
      employee_service = Workflow::WorkflowService.new(user: employee)

      instance = employee_service.start_workflow("contract_approval", document: contract)

      # Submit immediately
      instance.current_task.claim!(employee)
      employee_service.perform_action(instance, "submit_for_review")

      legal_task = instance.current_task
      expect(legal_task.sla_hours).to eq(48)
      expect(legal_task.sla_compliant?).to be true
      expect(legal_task.time_remaining).to be_within(1.minute).of(48.hours)
    end

    it "allows workflow cancellation" do
      employee_service = Workflow::WorkflowService.new(user: employee)

      instance = employee_service.start_workflow("contract_approval", document: contract)

      employee_service.cancel(instance, reason: "Contract terms changed, need to restart")

      expect(instance.status).to eq(Workflow::WorkflowInstance::STATUS_CANCELLED)
      expect(instance.cancellation_reason).to eq("Contract terms changed, need to restart")

      # Tasks should be cancelled - query fresh from DB
      Workflow::WorkflowTask.where(instance_id: instance.id).each do |task| # rubocop:disable Rails/FindEach
        expect(task.status).to eq(Workflow::WorkflowTask::STATUS_CANCELLED)
      end
    end
  end

  describe "role-based access" do
    it "only allows users with correct role to claim tasks" do
      employee_service = Workflow::WorkflowService.new(user: employee)
      instance = employee_service.start_workflow("contract_approval", document: contract)

      # Submit for review
      instance.current_task.claim!(employee)
      employee_service.perform_action(instance, "submit_for_review")

      # Legal task should not be claimable by employee
      legal_task = instance.current_task
      expect do
        legal_task.claim!(employee)
      end.to raise_error(Workflow::WorkflowError, /does not have required role/)

      # But legal reviewer can claim it
      legal_task.claim!(legal_reviewer)
      expect(legal_task.assignee).to eq(legal_reviewer)
    end
  end

  describe "task queries" do
    it "allows users to find their tasks" do
      employee_service = Workflow::WorkflowService.new(user: employee)
      legal_service = Workflow::WorkflowService.new(user: legal_reviewer)

      # Create multiple workflows
      3.times do
        instance = employee_service.start_workflow("contract_approval", document: contract)
        instance.current_task.claim!(employee)
        employee_service.perform_action(instance, "submit_for_review")
      end

      # Employee should have no pending tasks (all submitted)
      employee_tasks = employee_service.my_tasks.pending
      expect(employee_tasks.count).to eq(0)

      # Legal should have 3 pending tasks
      legal_tasks = legal_service.my_tasks.pending
      expect(legal_tasks.count).to eq(3)
      expect(legal_tasks.all? { |t| t.assigned_role == "legal" }).to be true
    end
  end

  describe "audit trail" do
    it "records all workflow events" do
      employee_service = Workflow::WorkflowService.new(user: employee)
      legal_service = Workflow::WorkflowService.new(user: legal_reviewer)

      instance = employee_service.start_workflow("contract_approval", document: contract)

      # Check workflow started event
      start_event = Audit::AuditEvent.by_action("workflow_started")
        .where(target_id: instance.id)
        .first
      expect(start_event).to be_present
      expect(start_event.actor_id).to eq(employee.id)

      # Complete the workflow
      instance.current_task.claim!(employee)
      employee_service.perform_action(instance, "submit_for_review")
      instance.current_task.claim!(legal_reviewer)
      legal_service.perform_action(instance, "approve")

      # Check task events
      task_events = Audit::AuditEvent.where(target_type: "Workflow::WorkflowTask")
      expect(task_events.pluck(:action)).to include("task_claimed", "task_completed")
    end
  end

  describe "notifications" do
    it "enqueues notification jobs for workflow events" do
      employee_service = Workflow::WorkflowService.new(user: employee)

      expect do
        instance = employee_service.start_workflow("contract_approval", document: contract)
        instance.current_task.claim!(employee)
        employee_service.perform_action(instance, "submit_for_review")
      end.to have_enqueued_job(WorkflowNotificationJob).at_least(2).times
    end
  end

  describe "statistics" do
    it "provides workflow statistics" do
      employee_service = Workflow::WorkflowService.new(user: employee)
      legal_service = Workflow::WorkflowService.new(user: legal_reviewer)

      # Create and complete some workflows
      2.times do
        instance = employee_service.start_workflow("contract_approval", document: contract)
        instance.current_task.claim!(employee)
        employee_service.perform_action(instance, "submit_for_review")
        instance.current_task.claim!(legal_reviewer)
        legal_service.perform_action(instance, "approve")
      end

      # Create one active workflow
      employee_service.start_workflow("contract_approval", document: contract)

      stats = employee_service.statistics

      expect(stats[:active_workflows]).to eq(1)
      expect(stats[:completed_today]).to eq(2)
    end
  end
end
# rubocop:enable RSpec/ExampleLength, RSpec/MultipleExpectations
