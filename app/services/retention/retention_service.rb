# frozen_string_literal: true

module Retention
  # Main service for retention management operations
  # Handles policy application, schedule management, and legal holds
  #
  class RetentionService
    attr_reader :user, :organization

    def initialize(user:, organization: nil)
      @user = user
      @organization = organization || user.organization
    end

    # Apply retention policy to a document
    def apply_policy(document, policy: nil)
      # Find existing schedule or create new one
      schedule = RetentionSchedule.where(document_id: document.id).first

      if schedule
        return schedule if schedule.under_legal_hold?

        update_schedule_policy(schedule, policy || find_policy(document))
      else
        create_schedule(document, policy || find_policy(document))
      end
    end

    # Find applicable policy for a document
    def find_policy(document)
      RetentionPolicy.find_policy_for(document, organization: organization)
    end

    # Get retention schedule for a document
    def get_schedule(document)
      RetentionSchedule.where(document_id: document.id).first
    end

    # Place a legal hold on a document
    def place_legal_hold(document, name:, hold_type:, custodian_name:, **)
      LegalHold.place_hold!(
        document: document,
        name: name,
        hold_type: hold_type,
        placed_by: user,
        organization: organization,
        custodian_name: custodian_name,
        **
      )
    end

    # Release a legal hold
    def release_legal_hold(hold, reason:)
      hold.release!(actor: user, reason: reason)
    end

    # Archive a document (soft action)
    def archive_document(document, notes: nil)
      schedule = get_schedule(document)
      raise RetentionError, "No retention schedule found for document" unless schedule
      raise RetentionError, "Document is under legal hold" if schedule.under_legal_hold?

      schedule.archive!(actor: user, notes: notes)
    end

    # Mark document as expired
    def expire_document(document, notes: nil)
      schedule = get_schedule(document)
      raise RetentionError, "No retention schedule found for document" unless schedule
      raise RetentionError, "Document is under legal hold" if schedule.under_legal_hold?

      schedule.expire!(actor: user, notes: notes)
    end

    # Extend retention period
    def extend_retention(document, additional_days:, reason: nil)
      schedule = get_schedule(document)
      raise RetentionError, "No retention schedule found for document" unless schedule

      schedule.extend_retention!(
        additional_days: additional_days,
        actor: user,
        reason: reason
      )
    end

    # Review a document's retention
    def review_document(document, notes: nil)
      schedule = get_schedule(document)
      raise RetentionError, "No retention schedule found for document" unless schedule

      schedule.record_review!(actor: user, notes: notes)
    end

    # Check if document can be modified
    def modification_allowed?(document)
      schedule = get_schedule(document)
      return true unless schedule

      schedule.modification_allowed?
    end

    # Check if document is under legal hold
    def under_legal_hold?(document)
      schedule = get_schedule(document)
      return false unless schedule

      schedule.under_legal_hold?
    end

    # Get documents expiring soon
    def documents_expiring_soon(days: 30)
      RetentionSchedule
        .expiring_soon(days)
        .where(organization_id: organization.id)
        .includes(:document, :policy)
    end

    # Get documents past expiration
    def documents_past_expiration
      RetentionSchedule
        .past_expiration
        .where(organization_id: organization.id)
        .includes(:document, :policy)
    end

    # Get documents under legal hold
    def documents_under_hold
      RetentionSchedule
        .held
        .where(organization_id: organization.id)
        .includes(:document, :legal_holds)
    end

    # Get active legal holds
    def active_legal_holds
      LegalHold
        .active
        .where(organization_id: organization.id)
        .includes(:schedule)
    end

    # Get statistics
    # rubocop:disable Metrics/AbcSize
    def statistics
      {
        total_scheduled: RetentionSchedule.where(organization_id: organization.id).count,
        active: RetentionSchedule.active.where(organization_id: organization.id).count,
        warning: RetentionSchedule.warning.where(organization_id: organization.id).count,
        pending_action: RetentionSchedule.pending_action.where(organization_id: organization.id).count,
        archived: RetentionSchedule.archived.where(organization_id: organization.id).count,
        expired: RetentionSchedule.expired.where(organization_id: organization.id).count,
        held: RetentionSchedule.held.where(organization_id: organization.id).count,
        active_holds: LegalHold.active.where(organization_id: organization.id).count
      }
    end
    # rubocop:enable Metrics/AbcSize

    # Bulk apply policies to documents without schedules
    # rubocop:disable Rails/PluckInWhere
    def apply_policies_to_unscheduled_documents
      documents = Content::Document
        .where(organization_id: organization.id)
        .where(:id.nin => RetentionSchedule.pluck(:document_id))

      count = 0
      documents.each do |doc|
        policy = find_policy(doc)
        next unless policy

        create_schedule(doc, policy)
        count += 1
      end

      count
    end
    # rubocop:enable Rails/PluckInWhere

    private

    def create_schedule(document, policy)
      return nil unless policy

      expiration_date = policy.calculate_expiration_date(document)
      warning_date = policy.calculate_warning_date(document)

      RetentionSchedule.create!(
        document: document,
        policy: policy,
        organization: organization,
        retention_start_date: Time.current,
        expiration_date: expiration_date,
        warning_date: warning_date
      )
    end

    def update_schedule_policy(schedule, policy)
      return schedule unless policy
      return schedule if schedule.policy_id == policy.id

      expiration_date = policy.calculate_expiration_date(schedule.document)
      warning_date = policy.calculate_warning_date(schedule.document)

      schedule.update!(
        policy: policy,
        expiration_date: expiration_date,
        warning_date: warning_date
      )

      schedule
    end
  end

  # Custom error class for retention operations
  class RetentionError < StandardError; end
end
