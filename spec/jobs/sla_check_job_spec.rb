# frozen_string_literal: true

require "rails_helper"

RSpec.describe SlaCheckJob do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:definition) { create(:workflow_definition, organization: organization) }
  let(:instance) do
    create(:workflow_instance,
           definition: definition,
           organization: organization,
           initiated_by: user)
  end

  describe "#perform" do
    context "when task is overdue" do
      let(:task) do
        create(:workflow_task,
               instance: instance,
               organization: organization,
               due_at: 1.hour.ago,
               status: Workflow::WorkflowTask::STATUS_PENDING)
      end

      it "updates task status to overdue" do
        described_class.perform_now(task.id.to_s)

        task.reload
        expect(task.status).to eq(Workflow::WorkflowTask::STATUS_OVERDUE)
      end

      it "escalates the task" do
        described_class.perform_now(task.id.to_s)

        task.reload
        expect(task.escalation_level).to eq(1)
      end

      it "creates audit event" do
        expect do
          described_class.perform_now(task.id.to_s)
        end.to change { Audit::AuditEvent.by_action("sla_breached").count }.by(1)
      end

      it "enqueues notification job" do
        expect do
          described_class.perform_now(task.id.to_s)
        end.to have_enqueued_job(WorkflowNotificationJob).with("sla_breached", task.id.to_s)
      end
    end

    context "when task is not overdue" do
      let(:task) do
        create(:workflow_task,
               instance: instance,
               organization: organization,
               due_at: 1.hour.from_now,
               status: Workflow::WorkflowTask::STATUS_PENDING)
      end

      it "does not update task status" do
        described_class.perform_now(task.id.to_s)

        task.reload
        expect(task.status).to eq(Workflow::WorkflowTask::STATUS_PENDING)
      end
    end

    context "when task is already completed" do
      let(:task) do
        create(:workflow_task,
               instance: instance,
               organization: organization,
               due_at: 1.hour.ago,
               status: Workflow::WorkflowTask::STATUS_COMPLETED)
      end

      it "does not update task status" do
        described_class.perform_now(task.id.to_s)

        task.reload
        expect(task.status).to eq(Workflow::WorkflowTask::STATUS_COMPLETED)
      end
    end

    context "when task is cancelled" do
      let(:task) do
        create(:workflow_task,
               instance: instance,
               organization: organization,
               due_at: 1.hour.ago,
               status: Workflow::WorkflowTask::STATUS_CANCELLED)
      end

      it "does not update task status" do
        described_class.perform_now(task.id.to_s)

        task.reload
        expect(task.status).to eq(Workflow::WorkflowTask::STATUS_CANCELLED)
      end
    end

    context "when task not found" do
      it "handles missing task gracefully" do
        expect do
          described_class.perform_now(BSON::ObjectId.new.to_s)
        end.not_to raise_error
      end
    end
  end
end
