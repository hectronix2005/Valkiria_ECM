# frozen_string_literal: true

# Sends SLA warning notifications before a task becomes overdue
# Typically scheduled at 75% and 50% of the SLA period
#
class SlaWarningJob < ApplicationJob
  queue_as :default

  # @param task_id [String] ID of the workflow task
  # @param percentage_remaining [Integer] Percentage of SLA time remaining (e.g., 75, 50, 25)
  def perform(task_id, percentage_remaining)
    task = Workflow::WorkflowTask.find(task_id)

    # Skip if task is already completed, cancelled, or overdue
    return if task.completed?
    return if task.status == Workflow::WorkflowTask::STATUS_CANCELLED
    return if task.overdue?

    # Send warning notification
    WorkflowNotificationJob.perform_later(
      "sla_warning",
      task.id.to_s,
      percentage_remaining: percentage_remaining
    )

    Rails.logger.info(
      "[SlaWarningJob] Warning sent for task #{task.id} " \
      "(#{percentage_remaining}% time remaining)"
    )
  rescue Mongoid::Errors::DocumentNotFound
    Rails.logger.warn "[SlaWarningJob] Task not found: #{task_id}"
  end
end
