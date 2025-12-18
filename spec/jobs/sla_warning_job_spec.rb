# frozen_string_literal: true

require "rails_helper"

RSpec.describe SlaWarningJob do
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
    context "when task is still pending" do
      let(:task) do
        create(:workflow_task,
               instance: instance,
               organization: organization,
               due_at: 6.hours.from_now,
               status: Workflow::WorkflowTask::STATUS_PENDING)
      end

      it "enqueues notification job" do
        expect do
          described_class.perform_now(task.id.to_s, 75)
        end.to have_enqueued_job(WorkflowNotificationJob).with(
          "sla_warning",
          task.id.to_s,
          percentage_remaining: 75
        )
      end
    end

    context "when task is completed" do
      it "does not enqueue notification job" do
        task = create(:workflow_task,
                      instance: instance,
                      organization: organization,
                      due_at: 6.hours.from_now,
                      status: Workflow::WorkflowTask::STATUS_COMPLETED)
        clear_enqueued_jobs

        expect do
          described_class.perform_now(task.id.to_s, 75)
        end.not_to have_enqueued_job(WorkflowNotificationJob)
      end
    end

    context "when task is cancelled" do
      it "does not enqueue notification job" do
        task = create(:workflow_task,
                      instance: instance,
                      organization: organization,
                      due_at: 6.hours.from_now,
                      status: Workflow::WorkflowTask::STATUS_CANCELLED)
        clear_enqueued_jobs

        expect do
          described_class.perform_now(task.id.to_s, 75)
        end.not_to have_enqueued_job(WorkflowNotificationJob)
      end
    end

    context "when task is already overdue" do
      it "does not enqueue notification job" do
        task = create(:workflow_task,
                      instance: instance,
                      organization: organization,
                      due_at: 1.hour.ago,
                      status: Workflow::WorkflowTask::STATUS_PENDING)
        clear_enqueued_jobs

        expect do
          described_class.perform_now(task.id.to_s, 75)
        end.not_to have_enqueued_job(WorkflowNotificationJob)
      end
    end

    context "when task not found" do
      it "handles missing task gracefully" do
        expect do
          described_class.perform_now(BSON::ObjectId.new.to_s, 75)
        end.not_to raise_error
      end
    end
  end
end
