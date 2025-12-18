# frozen_string_literal: true

# Processes retention schedules on a scheduled basis
# - Sends warnings for approaching expirations
# - Marks documents for pending action when expired
# - Does NOT physically delete any documents
#
# This job should be run daily via cron or similar scheduler
#
class RetentionProcessorJob < ApplicationJob
  queue_as :low

  # @param organization_id [String] Optional - process only for specific organization
  def perform(organization_id = nil)
    if organization_id
      process_organization(Identity::Organization.find(organization_id))
    else
      process_all_organizations
    end
  end

  private

  def process_all_organizations
    Identity::Organization.each do |org|
      process_organization(org)
    rescue StandardError => e
      Rails.logger.error "[RetentionProcessor] Error processing org #{org.id}: #{e.message}"
    end

    # Also process schedules without organization (shouldn't happen, but safety)
    process_global_schedules
  end

  def process_organization(organization)
    Rails.logger.info "[RetentionProcessor] Processing organization: #{organization.name}"

    stats = {
      warnings_sent: 0,
      marked_pending: 0,
      skipped_held: 0
    }

    # Process warning notifications
    stats[:warnings_sent] = process_warnings(organization)

    # Process expired documents
    result = process_expirations(organization)
    stats[:marked_pending] = result[:marked]
    stats[:skipped_held] = result[:skipped]

    log_processing_complete(organization, stats)
  end

  def process_global_schedules
    Retention::RetentionSchedule
      .where(organization_id: nil)
      .needs_warning
      .each { |schedule| send_warning(schedule) }

    Retention::RetentionSchedule
      .where(organization_id: nil)
      .past_expiration
      .each { |schedule| mark_for_action(schedule) }
  end

  def process_warnings(organization)
    count = 0

    # rubocop:disable Rails/FindEach
    Retention::RetentionSchedule
      .needs_warning
      .where(organization_id: organization.id)
      .each do |schedule|
      # rubocop:enable Rails/FindEach
      next if schedule.under_legal_hold?

      send_warning(schedule)
      count += 1
    rescue StandardError => e
      Rails.logger.error "[RetentionProcessor] Warning error for schedule #{schedule.id}: #{e.message}"
    end

    count
  end

  def process_expirations(organization)
    marked = 0
    skipped = 0

    # rubocop:disable Rails/FindEach
    Retention::RetentionSchedule
      .past_expiration
      .where(organization_id: organization.id)
      .each do |schedule|
      # rubocop:enable Rails/FindEach
      if schedule.under_legal_hold?
        skipped += 1
        log_skipped_due_to_hold(schedule)
        next
      end

      mark_for_action(schedule)
      marked += 1
    rescue StandardError => e
      Rails.logger.error "[RetentionProcessor] Expiration error for schedule #{schedule.id}: #{e.message}"
    end

    { marked: marked, skipped: skipped }
  end

  def send_warning(schedule)
    schedule.mark_warning!

    # Queue notification
    RetentionNotificationJob.perform_later(
      "warning",
      schedule.id.to_s,
      days_until_expiration: schedule.days_until_expiration
    )

    Rails.logger.info(
      "[RetentionProcessor] Warning sent for document #{schedule.document_id} " \
      "(expires in #{schedule.days_until_expiration} days)"
    )
  end

  def mark_for_action(schedule)
    schedule.mark_pending!

    # Queue notification for pending action
    RetentionNotificationJob.perform_later(
      "pending_action",
      schedule.id.to_s,
      action: schedule.policy&.expiration_action,
      days_overdue: schedule.days_overdue
    )

    Rails.logger.info(
      "[RetentionProcessor] Marked pending action for document #{schedule.document_id} " \
      "(overdue by #{schedule.days_overdue} days)"
    )
  end

  def log_skipped_due_to_hold(schedule)
    Rails.logger.info(
      "[RetentionProcessor] Skipped document #{schedule.document_id} - under legal hold"
    )

    # Record in audit
    Audit::AuditEvent.log(
      event_type: Audit::AuditEvent::TYPES[:system],
      action: "retention_skipped_legal_hold",
      target: schedule.document,
      actor: nil,
      metadata: {
        schedule_id: schedule.id.to_s,
        expiration_date: schedule.expiration_date&.iso8601,
        active_holds: schedule.legal_holds.active.count
      },
      tags: ["retention", "legal_hold", "skipped"]
    )
  end

  def log_processing_complete(organization, stats)
    Rails.logger.info(
      "[RetentionProcessor] Completed for #{organization.name}: " \
      "#{stats[:warnings_sent]} warnings, #{stats[:marked_pending]} marked pending, " \
      "#{stats[:skipped_held]} skipped (held)"
    )

    Audit::AuditEvent.log(
      event_type: Audit::AuditEvent::TYPES[:system],
      action: "retention_processing_complete",
      target: organization,
      actor: nil,
      metadata: stats,
      tags: ["retention", "processing", "batch"]
    )
  end
end
