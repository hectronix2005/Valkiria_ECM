# frozen_string_literal: true

require "rails_helper"

RSpec.describe Workflow::WorkflowTask do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:definition) { create(:workflow_definition, organization: organization) }
  let(:instance) do
    create(:workflow_instance,
           definition: definition,
           organization: organization,
           initiated_by: user)
  end

  describe "validations" do
    it "requires state" do
      task = build(:workflow_task, state: nil, instance: instance)
      expect(task).not_to be_valid
      expect(task.errors[:state]).to include("can't be blank")
    end

    it "requires valid status" do
      task = build(:workflow_task, status: "invalid", instance: instance)
      expect(task).not_to be_valid
      expect(task.errors[:status]).to be_present
    end

    it "creates valid task" do
      task = build(:workflow_task, instance: instance, organization: organization)
      expect(task).to be_valid
    end
  end

  describe "scopes" do
    let!(:pending_task) { create(:workflow_task, status: "pending", instance: instance, organization: organization) }
    let!(:in_progress_task) do
      create(:workflow_task, :in_progress, instance: instance, organization: organization)
    end
    let!(:completed_task) { create(:workflow_task, :completed, instance: instance, organization: organization) }
    let!(:overdue_task) { create(:workflow_task, :overdue, instance: instance, organization: organization) }

    it ".pending returns pending tasks" do
      expect(described_class.pending).to include(pending_task)
      expect(described_class.pending).not_to include(in_progress_task, completed_task)
    end

    it ".in_progress returns in progress tasks" do
      expect(described_class.in_progress).to include(in_progress_task)
    end

    it ".active returns pending and in_progress tasks" do
      expect(described_class.active).to include(pending_task, in_progress_task)
      expect(described_class.active).not_to include(completed_task)
    end

    it ".overdue returns tasks past due date" do
      expect(described_class.overdue).to include(overdue_task)
      expect(described_class.overdue).not_to include(pending_task)
    end

    it ".for_role filters by assigned role" do
      expect(described_class.for_role("employee")).to include(pending_task)
    end
  end

  describe "#overdue?" do
    it "returns true when past due date" do
      task = build(:workflow_task, due_at: 1.hour.ago)
      expect(task.overdue?).to be true
    end

    it "returns false when before due date" do
      task = build(:workflow_task, due_at: 1.hour.from_now)
      expect(task.overdue?).to be false
    end

    it "returns false when no due date" do
      task = build(:workflow_task, due_at: nil)
      expect(task.overdue?).to be false
    end

    it "returns false when completed" do
      task = build(:workflow_task, :completed, due_at: 1.hour.ago)
      expect(task.overdue?).to be false
    end
  end

  describe "#time_remaining" do
    it "returns time remaining until due" do
      task = build(:workflow_task, due_at: 2.hours.from_now)
      expect(task.time_remaining).to be_within(1.minute).of(2.hours)
    end

    it "returns 0 when overdue" do
      task = build(:workflow_task, due_at: 1.hour.ago)
      expect(task.time_remaining).to eq(0)
    end

    it "returns nil when no due date" do
      task = build(:workflow_task, due_at: nil)
      expect(task.time_remaining).to be_nil
    end
  end

  describe "#time_remaining_text" do
    it "returns days for long durations" do
      task = build(:workflow_task, due_at: 3.days.from_now + 1.hour)
      expect(task.time_remaining_text).to match(/\d+ days?/)
    end

    it "returns hours for medium durations" do
      task = build(:workflow_task, due_at: 5.hours.from_now + 30.minutes)
      expect(task.time_remaining_text).to match(/\d+ hours?/)
    end

    it "returns minutes for short durations" do
      task = build(:workflow_task, due_at: 30.minutes.from_now + 1.minute)
      expect(task.time_remaining_text).to match(/\d+ minutes?/)
    end

    it "returns Overdue when past due" do
      task = build(:workflow_task, due_at: 1.hour.ago)
      expect(task.time_remaining_text).to eq("Overdue")
    end
  end

  describe "#claim!" do
    let(:task) { create(:workflow_task, instance: instance, organization: organization) }
    let(:employee_role) { Identity::Role.find_or_create_by!(name: "employee") { |r| r.display_name = "Employee" } }

    before do
      user.roles << employee_role
    end

    it "assigns the task to the user" do
      task.claim!(user)

      expect(task.assignee).to eq(user)
      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_IN_PROGRESS)
      expect(task.started_at).to be_present
    end

    it "raises error if task is not pending" do
      task.update!(status: Workflow::WorkflowTask::STATUS_COMPLETED)

      expect do
        task.claim!(user)
      end.to raise_error(Workflow::WorkflowError, /not pending/)
    end

    it "raises error if user doesn't have required role" do
      user.roles.destroy_all

      expect do
        task.claim!(user)
      end.to raise_error(Workflow::WorkflowError, /does not have required role/)
    end

    it "records audit event" do
      expect do
        task.claim!(user)
      end.to change { Audit::AuditEvent.by_action("task_claimed").count }.by(1)
    end
  end

  describe "#release!" do
    let(:task) { create(:workflow_task, :in_progress, instance: instance, organization: organization, assignee: user) }

    it "releases the task back to the pool" do
      task.release!(user)

      expect(task.assignee).to be_nil
      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_PENDING)
      expect(task.started_at).to be_nil
    end

    it "raises error if task is not in progress" do
      task.update!(status: Workflow::WorkflowTask::STATUS_PENDING)

      expect do
        task.release!(user)
      end.to raise_error(Workflow::WorkflowError, /not in progress/)
    end

    it "raises error if user is not the assignee" do
      other_user = create(:user, organization: organization)

      expect do
        task.release!(other_user)
      end.to raise_error(Workflow::WorkflowError, /Only assignee can release/)
    end
  end

  describe "#complete!" do
    let(:task) { create(:workflow_task, instance: instance, organization: organization) }

    it "completes the task" do
      task.complete!(user, "Done")

      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_COMPLETED)
      expect(task.completed_at).to be_present
      expect(task.completed_by).to eq(user)
      expect(task.completion_comment).to eq("Done")
    end

    it "raises error if task cannot be completed" do
      task.update!(status: Workflow::WorkflowTask::STATUS_CANCELLED)

      expect do
        task.complete!(user)
      end.to raise_error(Workflow::WorkflowError, /cannot be completed/)
    end

    it "records audit event" do
      expect do
        task.complete!(user)
      end.to change { Audit::AuditEvent.by_action("task_completed").count }.by(1)
    end
  end

  describe "#cancel!" do
    let(:task) { create(:workflow_task, instance: instance, organization: organization) }

    it "cancels the task" do
      task.cancel!(user)

      expect(task.status).to eq(Workflow::WorkflowTask::STATUS_CANCELLED)
      expect(task.cancelled_at).to be_present
    end

    it "records audit event" do
      expect do
        task.cancel!(user)
      end.to change { Audit::AuditEvent.by_action("task_cancelled").count }.by(1)
    end
  end

  describe "#escalate!" do
    let(:task) { create(:workflow_task, instance: instance, organization: organization) }

    it "increases escalation level" do
      task.escalate!(reason: "SLA warning")

      expect(task.escalation_level).to eq(1)
      expect(task.last_escalated_at).to be_present
      expect(task.priority).to be > 0
    end

    it "records escalation in history" do
      task.escalate!(reason: "Test")

      expect(task.escalation_history.last["level"]).to eq(1)
      expect(task.escalation_history.last["reason"]).to eq("Test")
    end

    it "enqueues notification job" do
      expect do
        task.escalate!(reason: "Test")
      end.to have_enqueued_job(WorkflowNotificationJob).with("task_escalated", task.id.to_s, anything)
    end
  end

  describe "#user_can_work?" do
    let(:task) { create(:workflow_task, instance: instance, organization: organization) }
    let(:employee_role) { Identity::Role.find_or_create_by!(name: "employee") { |r| r.display_name = "Employee" } }

    it "returns true for user with matching role" do
      user.roles << employee_role
      expect(task.user_can_work?(user)).to be true
    end

    it "returns true for assignee" do
      task.update!(assignee: user, status: Workflow::WorkflowTask::STATUS_IN_PROGRESS)
      expect(task.user_can_work?(user)).to be true
    end

    it "returns false for user without role" do
      expect(task.user_can_work?(user)).to be false
    end

    it "returns false for completed task" do
      user.roles << employee_role
      task.update!(status: Workflow::WorkflowTask::STATUS_COMPLETED)
      expect(task.user_can_work?(user)).to be false
    end
  end

  describe "#sla_compliant?" do
    let(:task) { create(:workflow_task, instance: instance, organization: organization, due_at: 24.hours.from_now) }

    it "returns true when completed before due date" do
      task.update!(status: Workflow::WorkflowTask::STATUS_COMPLETED, completed_at: Time.current)
      expect(task.sla_compliant?).to be true
    end

    it "returns true when still before due date" do
      expect(task.sla_compliant?).to be true
    end

    it "returns false when overdue and not completed" do
      task.update!(due_at: 1.hour.ago)
      expect(task.sla_compliant?).to be false
    end

    it "returns true when no due date" do
      task.update!(due_at: nil)
      expect(task.sla_compliant?).to be true
    end
  end

  describe "callbacks" do
    it "schedules SLA check job on create when due_at is set" do
      task = create(:workflow_task, instance: instance, organization: organization, due_at: 24.hours.from_now,
                                    sla_hours: 24)
      # Verify job was scheduled (at the due_at time)
      expect(SlaCheckJob).to have_been_enqueued.with(task.id.to_s)
    end

    it "enqueues notification job for assigned role" do
      task = create(:workflow_task, instance: instance, organization: organization, assigned_role: "reviewer")
      # Verify notification job was queued
      expect(WorkflowNotificationJob).to have_been_enqueued.with("task_created", task.id.to_s,
                                                                 hash_including(assigned_role: "reviewer"))
    end
  end
end
