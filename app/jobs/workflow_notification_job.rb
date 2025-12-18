# frozen_string_literal: true

# Handles workflow-related notifications
# Supports various notification types: transitions, escalations, SLA warnings
#
# rubocop:disable Metrics/ClassLength
class WorkflowNotificationJob < ApplicationJob
  queue_as :default

  # @param notification_type [String] Type of notification
  # @param resource_id [String] ID of the workflow instance or task
  # @param options [Hash] Additional notification options
  def perform(notification_type, resource_id, **options)
    case notification_type
    when "transition"
      handle_transition_notification(resource_id, options)
    when "task_created"
      handle_task_created_notification(resource_id, options)
    when "task_escalated"
      handle_task_escalated_notification(resource_id, options)
    when "cancelled"
      handle_cancellation_notification(resource_id, options)
    when "sla_warning"
      handle_sla_warning_notification(resource_id, options)
    when "sla_breached"
      handle_sla_breached_notification(resource_id, options)
    else
      Rails.logger.warn "Unknown workflow notification type: #{notification_type}"
    end
  end

  private

  # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
  def handle_transition_notification(instance_id, options)
    instance = Workflow::WorkflowInstance.find(instance_id)
    from_state = options[:from_state]
    to_state = options[:to_state]
    actor = Identity::User.find(options[:actor_id])

    # Notify stakeholders about the state change
    notify_stakeholders(
      instance,
      subject: "Workflow transitioned: #{from_state} → #{to_state}",
      body: build_transition_message(instance, from_state, to_state, actor)
    )

    # If entering a new state with assigned role, notify that role
    if (step = instance.definition.step_for(to_state)) && step["assigned_role"] && step["assigned_role"]
      notify_role(
        instance.organization,
        step["assigned_role"],
        subject: "New task: #{instance.definition.name} - #{to_state}",
        body: build_new_task_message(instance, to_state)
      )
    end

    Rails.logger.info(
      "[WorkflowNotification] Transition: #{instance.definition.name} " \
      "#{from_state} → #{to_state} by #{actor.email}"
    )
  rescue Mongoid::Errors::DocumentNotFound => e
    Rails.logger.error "[WorkflowNotification] Resource not found: #{e.message}"
  end
  # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

  def handle_task_created_notification(task_id, options)
    task = Workflow::WorkflowTask.find(task_id)
    assigned_role = options[:assigned_role]
    state = options[:state]

    return unless assigned_role

    notify_role(
      task.organization,
      assigned_role,
      subject: "New workflow task available: #{state}",
      body: build_task_available_message(task)
    )

    Rails.logger.info(
      "[WorkflowNotification] Task created: #{task.id} " \
      "assigned to role: #{assigned_role}"
    )
  rescue Mongoid::Errors::DocumentNotFound => e
    Rails.logger.error "[WorkflowNotification] Task not found: #{e.message}"
  end

  def handle_task_escalated_notification(task_id, options)
    task = Workflow::WorkflowTask.find(task_id)
    escalation_level = options[:escalation_level]
    reason = options[:reason]

    # Notify managers/admins about escalation
    notify_managers(
      task.organization,
      subject: "[ESCALATION Level #{escalation_level}] Workflow task requires attention",
      body: build_escalation_message(task, escalation_level, reason)
    )

    Rails.logger.info(
      "[WorkflowNotification] Task escalated: #{task.id} " \
      "level: #{escalation_level}"
    )
  rescue Mongoid::Errors::DocumentNotFound => e
    Rails.logger.error "[WorkflowNotification] Task not found: #{e.message}"
  end

  def handle_cancellation_notification(instance_id, options)
    instance = Workflow::WorkflowInstance.find(instance_id)
    actor = Identity::User.find(options[:actor_id])
    reason = options[:reason]

    notify_stakeholders(
      instance,
      subject: "Workflow cancelled: #{instance.definition.name}",
      body: build_cancellation_message(instance, actor, reason)
    )

    Rails.logger.info(
      "[WorkflowNotification] Workflow cancelled: #{instance.id} " \
      "by #{actor.email}, reason: #{reason}"
    )
  rescue Mongoid::Errors::DocumentNotFound => e
    Rails.logger.error "[WorkflowNotification] Resource not found: #{e.message}"
  end

  # rubocop:disable Metrics/MethodLength
  def handle_sla_warning_notification(task_id, options)
    task = Workflow::WorkflowTask.find(task_id)
    percentage_remaining = options[:percentage_remaining]

    return if task.completed? || task.status == Workflow::WorkflowTask::STATUS_CANCELLED

    # Notify assignee if claimed, otherwise notify role
    if task.assignee
      notify_user(
        task.assignee,
        subject: "[SLA Warning] Task due soon: #{task.state}",
        body: build_sla_warning_message(task, percentage_remaining)
      )
    else
      notify_role(
        task.organization,
        task.assigned_role,
        subject: "[SLA Warning] Unclaimed task due soon: #{task.state}",
        body: build_sla_warning_message(task, percentage_remaining)
      )
    end

    Rails.logger.info(
      "[WorkflowNotification] SLA warning: #{task.id} " \
      "#{percentage_remaining}% time remaining"
    )
  rescue Mongoid::Errors::DocumentNotFound => e
    Rails.logger.error "[WorkflowNotification] Task not found: #{e.message}"
  end
  # rubocop:enable Metrics/MethodLength

  def handle_sla_breached_notification(task_id, _options)
    task = Workflow::WorkflowTask.find(task_id)

    return if task.completed? || task.status == Workflow::WorkflowTask::STATUS_CANCELLED

    # Notify managers about SLA breach
    notify_managers(
      task.organization,
      subject: "[SLA BREACH] Task overdue: #{task.state}",
      body: build_sla_breach_message(task)
    )

    # Also notify assignee if claimed
    if task.assignee
      notify_user(
        task.assignee,
        subject: "[SLA BREACH] Your task is overdue: #{task.state}",
        body: build_sla_breach_message(task)
      )
    end

    Rails.logger.warn(
      "[WorkflowNotification] SLA breached: #{task.id}"
    )
  rescue Mongoid::Errors::DocumentNotFound => e
    Rails.logger.error "[WorkflowNotification] Task not found: #{e.message}"
  end

  # Notification delivery methods
  # These would integrate with your notification system (email, in-app, etc.)

  def notify_stakeholders(instance, subject:, body:)
    # Stakeholders: initiator + anyone in state history
    stakeholder_ids = [instance.initiated_by_id.to_s]
    instance.state_history.each do |entry|
      stakeholder_ids << entry["actor_id"] if entry["actor_id"]
    end

    stakeholder_ids.uniq.each do |user_id|
      user = Identity::User.find(user_id)
      deliver_notification(user, subject, body)
    rescue Mongoid::Errors::DocumentNotFound
      next
    end
  end

  def notify_role(organization, role_name, subject:, body:)
    return if role_name.blank?

    users_with_role = organization.users.joins(:roles).where(
      identity_roles: { name: role_name }
    )

    users_with_role.each do |user|
      deliver_notification(user, subject, body)
    end
  end

  def notify_managers(organization, subject:, body:)
    # Notify admin and manager roles
    ["admin", "manager"].each do |role_name|
      notify_role(organization, role_name, subject: subject, body: body)
    end
  end

  def notify_user(user, subject:, body:)
    return unless user

    deliver_notification(user, subject, body)
  end

  def deliver_notification(user, subject, body)
    # Placeholder for actual notification delivery
    # Could send email, create in-app notification, push notification, etc.
    Rails.logger.info(
      "[WorkflowNotification] Delivering to #{user.email}: #{subject}"
    )

    # Example: Create audit record of notification
    Audit::AuditEvent.log(
      event_type: Audit::AuditEvent::TYPES[:system],
      action: "notification_sent",
      target: user,
      actor: nil, # System notification
      metadata: {
        subject: subject,
        body_preview: body.to_s[0..100]
      },
      tags: ["notification", "workflow"]
    )
  end

  # Message builders

  def build_transition_message(instance, from_state, to_state, actor)
    <<~MESSAGE
      Workflow: #{instance.definition.name}
      Document: #{instance.document&.title || "N/A"}

      State changed from "#{from_state}" to "#{to_state}"
      Changed by: #{actor.full_name} (#{actor.email})
      Time: #{Time.current.strftime("%Y-%m-%d %H:%M %Z")}
    MESSAGE
  end

  def build_new_task_message(instance, state)
    step = instance.definition.step_for(state)
    sla_hours = instance.definition.sla_hours_for(state)

    <<~MESSAGE
      A new task is available for you to work on.

      Workflow: #{instance.definition.name}
      Document: #{instance.document&.title || "N/A"}
      Current State: #{state}
      Description: #{step["description"] || "N/A"}
      SLA: #{sla_hours ? "#{sla_hours} hours" : "No deadline"}
    MESSAGE
  end

  def build_task_available_message(task)
    <<~MESSAGE
      A workflow task is available for your role.

      State: #{task.state}
      Due: #{task.due_at&.strftime("%Y-%m-%d %H:%M %Z") || "No deadline"}
      Priority: #{task.priority}

      Please claim this task to begin working on it.
    MESSAGE
  end

  def build_escalation_message(task, level, reason)
    <<~MESSAGE
      A workflow task has been escalated and requires management attention.

      Escalation Level: #{level}
      Reason: #{reason || "Automatic escalation due to SLA"}

      Task Details:
      State: #{task.state}
      Assigned Role: #{task.assigned_role}
      Due: #{task.due_at&.strftime("%Y-%m-%d %H:%M %Z") || "No deadline"}
      Assignee: #{task.assignee&.full_name || "Unclaimed"}

      Time Remaining: #{task.time_remaining_text}
    MESSAGE
  end

  def build_cancellation_message(instance, actor, reason)
    <<~MESSAGE
      A workflow has been cancelled.

      Workflow: #{instance.definition.name}
      Document: #{instance.document&.title || "N/A"}

      Cancelled by: #{actor.full_name} (#{actor.email})
      Reason: #{reason || "No reason provided"}
      Time: #{Time.current.strftime("%Y-%m-%d %H:%M %Z")}

      Previous state: #{instance.current_state}
    MESSAGE
  end

  def build_sla_warning_message(task, percentage_remaining)
    <<~MESSAGE
      A workflow task is approaching its deadline.

      State: #{task.state}
      Due: #{task.due_at&.strftime("%Y-%m-%d %H:%M %Z")}
      Time Remaining: #{task.time_remaining_text} (#{percentage_remaining}%)

      Please complete this task before the deadline to avoid escalation.
    MESSAGE
  end

  def build_sla_breach_message(task)
    <<~MESSAGE
      [URGENT] A workflow task has exceeded its SLA deadline.

      State: #{task.state}
      Was Due: #{task.due_at&.strftime("%Y-%m-%d %H:%M %Z")}
      Overdue By: #{((Time.current - task.due_at) / 1.hour).round(1)} hours

      Assigned Role: #{task.assigned_role}
      Assignee: #{task.assignee&.full_name || "Unclaimed"}

      Immediate action is required.
    MESSAGE
  end
end
# rubocop:enable Metrics/ClassLength
