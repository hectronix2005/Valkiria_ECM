# frozen_string_literal: true

require "rails_helper"

RSpec.describe WorkflowNotificationJob do
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
    describe "transition notification" do
      it "handles transition notifications" do
        expect do
          described_class.perform_now(
            "transition",
            instance.id.to_s,
            from_state: "draft",
            to_state: "review",
            actor_id: user.id.to_s
          )
        end.to change { Audit::AuditEvent.by_action("notification_sent").count }.by_at_least(1)
      end

      it "handles missing instance gracefully" do
        expect do
          described_class.perform_now(
            "transition",
            BSON::ObjectId.new.to_s,
            from_state: "draft",
            to_state: "review",
            actor_id: user.id.to_s
          )
        end.not_to raise_error
      end
    end

    describe "task created notification" do
      let(:task) { instance.tasks.first }

      it "handles task created notifications" do
        expect do
          described_class.perform_now(
            "task_created",
            task.id.to_s,
            assigned_role: "employee",
            state: "draft"
          )
        end.not_to raise_error
      end
    end

    describe "task escalated notification" do
      let(:task) { instance.tasks.first }

      it "handles task escalated notifications" do
        expect do
          described_class.perform_now(
            "task_escalated",
            task.id.to_s,
            escalation_level: 1,
            reason: "SLA breach"
          )
        end.not_to raise_error
      end
    end

    describe "cancellation notification" do
      it "handles cancellation notifications" do
        expect do
          described_class.perform_now(
            "cancelled",
            instance.id.to_s,
            actor_id: user.id.to_s,
            reason: "No longer needed"
          )
        end.not_to raise_error
      end
    end

    describe "SLA warning notification" do
      let(:task) { instance.tasks.first }

      it "handles SLA warning notifications" do
        expect do
          described_class.perform_now(
            "sla_warning",
            task.id.to_s,
            percentage_remaining: 25
          )
        end.not_to raise_error
      end

      it "skips completed tasks" do
        task.update!(status: Workflow::WorkflowTask::STATUS_COMPLETED)

        expect do
          described_class.perform_now(
            "sla_warning",
            task.id.to_s,
            percentage_remaining: 25
          )
        end.not_to raise_error
      end
    end

    describe "SLA breached notification" do
      let(:task) { instance.tasks.first }

      it "handles SLA breach notifications" do
        task.update!(due_at: 1.hour.ago)

        expect do
          described_class.perform_now(
            "sla_breached",
            task.id.to_s
          )
        end.not_to raise_error
      end
    end

    describe "unknown notification type" do
      it "logs warning for unknown types" do
        allow(Rails.logger).to receive(:warn)

        described_class.perform_now("unknown_type", "some_id")

        expect(Rails.logger).to have_received(:warn).with(/Unknown workflow notification type/)
      end
    end
  end
end
