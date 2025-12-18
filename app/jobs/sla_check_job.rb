# frozen_string_literal: true

# Checks if a workflow task has breached its SLA
# Scheduled to run at the task's due time
#
class SlaCheckJob < ApplicationJob
  queue_as :default

  # @param task_id [String] ID of the workflow task to check
  def perform(task_id)
    task = Workflow::WorkflowTask.find(task_id)

    # Skip if task is already completed or cancelled
    return if task.completed? || task.status == Workflow::WorkflowTask::STATUS_CANCELLED

    handle_sla_breach(task) if task.overdue?
  rescue Mongoid::Errors::DocumentNotFound
    Rails.logger.warn "[SlaCheckJob] Task not found: #{task_id}"
  end

  private

  # rubocop:disable Metrics/MethodLength
  def handle_sla_breach(task)
    # Update task status
    task.update!(status: Workflow::WorkflowTask::STATUS_OVERDUE)

    # Escalate the task
    task.escalate!(reason: "SLA deadline breached")

    # Send breach notification
    WorkflowNotificationJob.perform_later(
      "sla_breached",
      task.id.to_s
    )

    # Record audit event
    Audit::AuditEvent.log(
      event_type: Audit::AuditEvent::TYPES[:workflow],
      action: "sla_breached",
      target: task,
      actor: nil, # System action
      metadata: {
        workflow_instance_id: task.instance_id.to_s,
        state: task.state,
        due_at: task.due_at&.iso8601,
        assigned_role: task.assigned_role,
        assignee_id: task.assignee_id&.to_s
      },
      tags: ["workflow", "sla", "breached"]
    )

    Rails.logger.warn(
      "[SlaCheckJob] SLA breached for task #{task.id} " \
      "(state: #{task.state}, due: #{task.due_at})"
    )
  end
  # rubocop:enable Metrics/MethodLength
end
