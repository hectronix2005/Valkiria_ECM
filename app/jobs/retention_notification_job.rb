# frozen_string_literal: true

# Handles retention-related notifications
# Supports warnings, pending actions, and legal hold notifications
#
# rubocop:disable Metrics/ClassLength
class RetentionNotificationJob < ApplicationJob
  queue_as :default

  # @param notification_type [String] Type of notification
  # @param schedule_id [String] ID of the retention schedule
  # @param options [Hash] Additional notification options
  def perform(notification_type, schedule_id, **options)
    schedule = Retention::RetentionSchedule.find(schedule_id)

    case notification_type
    when "warning"
      handle_warning_notification(schedule, options)
    when "pending_action"
      handle_pending_action_notification(schedule, options)
    when "archived"
      handle_archived_notification(schedule, options)
    when "expired"
      handle_expired_notification(schedule, options)
    when "legal_hold_placed"
      handle_legal_hold_placed_notification(schedule, options)
    when "legal_hold_released"
      handle_legal_hold_released_notification(schedule, options)
    else
      Rails.logger.warn "[RetentionNotification] Unknown notification type: #{notification_type}"
    end
  rescue Mongoid::Errors::DocumentNotFound
    Rails.logger.error "[RetentionNotification] Schedule not found: #{schedule_id}"
  end

  private

  def handle_warning_notification(schedule, options)
    days = options[:days_until_expiration]
    document = schedule.document

    # Notify document owner/creator
    notify_document_stakeholders(
      schedule,
      subject: "[Retention Warning] Document expiring soon: #{document.title}",
      body: build_warning_message(schedule, days)
    )

    # Notify records managers
    notify_records_managers(
      schedule.organization,
      subject: "[Retention Warning] Document requires attention",
      body: build_warning_message(schedule, days)
    )

    Rails.logger.info "[RetentionNotification] Warning sent for #{document.title}"
  end

  def handle_pending_action_notification(schedule, options)
    action = options[:action]
    days_overdue = options[:days_overdue]
    document = schedule.document

    notify_records_managers(
      schedule.organization,
      subject: "[Retention Action Required] Document ready for #{action}: #{document.title}",
      body: build_pending_action_message(schedule, action, days_overdue)
    )

    Rails.logger.info "[RetentionNotification] Pending action notification for #{document.title}"
  end

  def handle_archived_notification(schedule, _options)
    document = schedule.document

    notify_document_stakeholders(
      schedule,
      subject: "[Retention] Document archived: #{document.title}",
      body: build_archived_message(schedule)
    )

    Rails.logger.info "[RetentionNotification] Archive notification for #{document.title}"
  end

  def handle_expired_notification(schedule, _options)
    document = schedule.document

    notify_document_stakeholders(
      schedule,
      subject: "[Retention] Document expired: #{document.title}",
      body: build_expired_message(schedule)
    )

    Rails.logger.info "[RetentionNotification] Expiration notification for #{document.title}"
  end

  def handle_legal_hold_placed_notification(schedule, options)
    hold_name = options[:hold_name]
    document = schedule.document

    notify_document_stakeholders(
      schedule,
      subject: "[Legal Hold] Document placed on hold: #{document.title}",
      body: build_legal_hold_placed_message(schedule, hold_name)
    )

    notify_legal_team(
      schedule.organization,
      subject: "[Legal Hold] Document preservation active",
      body: build_legal_hold_placed_message(schedule, hold_name)
    )

    Rails.logger.info "[RetentionNotification] Legal hold placed for #{document.title}"
  end

  def handle_legal_hold_released_notification(schedule, options)
    hold_name = options[:hold_name]
    document = schedule.document

    notify_document_stakeholders(
      schedule,
      subject: "[Legal Hold Released] #{document.title}",
      body: build_legal_hold_released_message(schedule, hold_name)
    )

    Rails.logger.info "[RetentionNotification] Legal hold released for #{document.title}"
  end

  # Notification delivery methods

  def notify_document_stakeholders(schedule, subject:, body:)
    document = schedule.document

    # Notify creator
    deliver_notification(document.created_by, subject, body) if document.created_by

    # Notify last modifier if different
    return unless document.last_modified_by && document.last_modified_by != document.created_by

    deliver_notification(document.last_modified_by, subject, body)
  end

  def notify_records_managers(organization, subject:, body:)
    # Notify users with records_manager or admin role
    ["records_manager", "admin"].each do |role_name|
      # rubocop:disable Rails/FindEach
      organization.users.joins(:roles).where(identity_roles: { name: role_name }).each do |user|
        deliver_notification(user, subject, body)
      end
      # rubocop:enable Rails/FindEach
    rescue StandardError
      next
    end
  end

  def notify_legal_team(organization, subject:, body:)
    # rubocop:disable Rails/FindEach
    organization.users.joins(:roles).where(identity_roles: { name: "legal" }).each do |user|
      deliver_notification(user, subject, body)
    end
    # rubocop:enable Rails/FindEach
  rescue StandardError => e
    Rails.logger.warn "[RetentionNotification] Could not notify legal team: #{e.message}"
  end

  def deliver_notification(user, subject, body)
    return unless user

    Rails.logger.info "[RetentionNotification] Delivering to #{user.email}: #{subject}"

    Audit::AuditEvent.log(
      event_type: Audit::AuditEvent::TYPES[:system],
      action: "notification_sent",
      target: user,
      actor: nil,
      metadata: {
        subject: subject,
        body_preview: body.to_s[0..100]
      },
      tags: ["notification", "retention"]
    )
  end

  # Message builders

  def build_warning_message(schedule, days)
    <<~MESSAGE
      Document Retention Warning

      Document: #{schedule.document.title}
      Policy: #{schedule.policy&.name || "N/A"}
      Expiration Date: #{schedule.expiration_date&.strftime("%Y-%m-%d")}
      Days Remaining: #{days}

      Action Required: #{schedule.policy&.expiration_action&.titleize || "Review"}

      Please review this document before the retention period expires.
    MESSAGE
  end

  def build_pending_action_message(schedule, action, days_overdue)
    <<~MESSAGE
      Document Ready for Retention Action

      Document: #{schedule.document.title}
      Policy: #{schedule.policy&.name || "N/A"}
      Expiration Date: #{schedule.expiration_date&.strftime("%Y-%m-%d")}
      Days Overdue: #{days_overdue}

      Required Action: #{action&.titleize || "Review"}

      This document has exceeded its retention period and requires action.
    MESSAGE
  end

  def build_archived_message(schedule)
    <<~MESSAGE
      Document Archived

      Document: #{schedule.document.title}
      Archived Date: #{schedule.action_date&.strftime("%Y-%m-%d %H:%M")}
      Policy: #{schedule.policy&.name || "N/A"}

      This document has been archived per retention policy.
      The document remains accessible in read-only mode.
    MESSAGE
  end

  def build_expired_message(schedule)
    <<~MESSAGE
      Document Expired

      Document: #{schedule.document.title}
      Expiration Date: #{schedule.action_date&.strftime("%Y-%m-%d %H:%M")}
      Policy: #{schedule.policy&.name || "N/A"}

      This document has been marked as expired per retention policy.
      The document is preserved but flagged as expired.
    MESSAGE
  end

  def build_legal_hold_placed_message(schedule, hold_name)
    <<~MESSAGE
      Legal Hold Placed on Document

      Document: #{schedule.document.title}
      Hold Name: #{hold_name}
      Effective Date: #{Time.current.strftime("%Y-%m-%d %H:%M")}

      IMPORTANT: This document is now under legal hold.
      - No modifications are permitted
      - No archival or deletion actions will be performed
      - The document must be preserved in its current state

      Contact your legal department for questions.
    MESSAGE
  end

  def build_legal_hold_released_message(schedule, hold_name)
    <<~MESSAGE
      Legal Hold Released

      Document: #{schedule.document.title}
      Hold Name: #{hold_name}
      Release Date: #{Time.current.strftime("%Y-%m-%d %H:%M")}

      The legal hold on this document has been released.
      Normal retention processing will resume.
    MESSAGE
  end
end
# rubocop:enable Metrics/ClassLength
