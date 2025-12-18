# frozen_string_literal: true

module Retention
  # Tracks retention status for individual documents
  # Links a document to its applicable policy and tracks lifecycle events
  #
  # Note: Documents are NEVER physically deleted - they are marked for archive/expiration
  #
  # rubocop:disable Metrics/ClassLength
  class RetentionSchedule
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "retention_schedules"

    # Status constants
    STATUS_ACTIVE = "active"           # Document within retention period
    STATUS_WARNING = "warning"         # Approaching expiration
    STATUS_PENDING_ACTION = "pending"  # Ready for expiration action
    STATUS_ARCHIVED = "archived"       # Archived (still accessible)
    STATUS_EXPIRED = "expired"         # Expired but preserved
    STATUS_HELD = "held"               # Under legal hold

    STATUSES = [
      STATUS_ACTIVE, STATUS_WARNING, STATUS_PENDING_ACTION,
      STATUS_ARCHIVED, STATUS_EXPIRED, STATUS_HELD
    ].freeze

    # Fields
    field :status, type: String, default: STATUS_ACTIVE
    field :retention_start_date, type: Time
    field :expiration_date, type: Time
    field :warning_date, type: Time
    field :action_date, type: Time # When the action was taken
    field :action_taken, type: String # What action was performed

    # Tracking fields
    field :warning_sent_at, type: Time
    field :warning_count, type: Integer, default: 0
    field :last_reviewed_at, type: Time
    field :reviewed_by_id, type: BSON::ObjectId

    # Notes and history
    field :notes, type: String
    field :history, type: Array, default: []

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ document_id: 1 }, { unique: true })
    index({ status: 1 })
    index({ expiration_date: 1 })
    index({ warning_date: 1 })
    index({ organization_id: 1, status: 1 })

    # Associations
    belongs_to :document, class_name: "Content::Document"
    belongs_to :policy, class_name: "Retention::RetentionPolicy", optional: true
    belongs_to :organization, class_name: "Identity::Organization"
    has_many :legal_holds, class_name: "Retention::LegalHold", inverse_of: :schedule

    # Validations
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :document_id, uniqueness: true

    # Scopes
    scope :active, -> { where(status: STATUS_ACTIVE) }
    scope :warning, -> { where(status: STATUS_WARNING) }
    scope :pending_action, -> { where(status: STATUS_PENDING_ACTION) }
    scope :archived, -> { where(status: STATUS_ARCHIVED) }
    scope :expired, -> { where(status: STATUS_EXPIRED) }
    scope :held, -> { where(status: STATUS_HELD) }

    scope :expiring_soon, lambda { |days = 30|
      where(:expiration_date.lte => Time.current + days.days)
        .where(:status.in => [STATUS_ACTIVE, STATUS_WARNING])
    }

    scope :past_expiration, lambda {
      where(:expiration_date.lte => Time.current)
        .where(:status.in => [STATUS_ACTIVE, STATUS_WARNING, STATUS_PENDING_ACTION])
    }

    scope :needs_warning, lambda {
      where(:warning_date.lte => Time.current)
        .where(status: STATUS_ACTIVE)
    }

    # Check if document is under legal hold
    def under_legal_hold?
      legal_holds.active.exists?
    end

    # Check if document can be modified
    def modification_allowed?
      !under_legal_hold? && !archived? && !expired?
    end

    # Check if document can be deleted (spoiler: never physically deleted)
    def deletion_allowed?
      false # Documents are NEVER physically deleted
    end

    # Status checks
    def active?
      status == STATUS_ACTIVE
    end

    def archived?
      status == STATUS_ARCHIVED
    end

    def expired?
      status == STATUS_EXPIRED
    end

    def held?
      status == STATUS_HELD
    end

    def past_expiration?
      expiration_date.present? && Time.current > expiration_date
    end

    def needs_warning?
      warning_date.present? && Time.current >= warning_date && active?
    end

    # Transition to warning status
    def mark_warning!(actor: nil)
      return if under_legal_hold?
      return unless active?

      self.status = STATUS_WARNING
      self.warning_sent_at = Time.current
      self.warning_count += 1

      record_history("warning_sent", actor)
      save!

      self
    end

    # Mark for pending action (ready for archive/expire)
    def mark_pending!(actor: nil)
      return if under_legal_hold?

      self.status = STATUS_PENDING_ACTION

      record_history("marked_pending", actor)
      save!

      self
    end

    # Archive the document (soft action - document still accessible)
    def archive!(actor:, notes: nil) # rubocop:disable Naming/PredicateMethod
      return false if under_legal_hold?

      self.status = STATUS_ARCHIVED
      self.action_date = Time.current
      self.action_taken = RetentionPolicy::ACTION_ARCHIVE
      self.notes = notes if notes

      # Update document status
      document.update!(retention_status: "archived")

      record_history("archived", actor, notes)
      save!

      log_audit_event("document_archived", actor)

      true
    end

    # Mark as expired (document preserved but flagged)
    def expire!(actor:, notes: nil) # rubocop:disable Naming/PredicateMethod
      return false if under_legal_hold?

      self.status = STATUS_EXPIRED
      self.action_date = Time.current
      self.action_taken = RetentionPolicy::ACTION_EXPIRE
      self.notes = notes if notes

      # Update document status
      document.update!(retention_status: "expired")

      record_history("expired", actor, notes)
      save!

      log_audit_event("document_expired", actor)

      true
    end

    # Place under legal hold
    def place_on_hold!(reason:)
      self.status = STATUS_HELD

      record_history("placed_on_hold", nil, reason)
      save!

      self
    end

    # Release from legal hold (if no other holds exist)
    def release_from_hold!
      return if legal_holds.active.exists?

      # Determine appropriate status
      self.status = if past_expiration?
                      STATUS_PENDING_ACTION
                    elsif needs_warning?
                      STATUS_WARNING
                    else
                      STATUS_ACTIVE
                    end

      record_history("released_from_hold", nil)
      save!

      self
    end

    # Extend retention period
    def extend_retention!(additional_days:, actor:, reason: nil) # rubocop:disable Naming/PredicateMethod
      return false if under_legal_hold?

      old_date = expiration_date
      self.expiration_date = expiration_date + additional_days.days
      self.warning_date = policy.calculate_warning_date(document) if policy.warning_days&.positive?

      # Reset status if was pending
      self.status = STATUS_ACTIVE if status == STATUS_PENDING_ACTION

      record_history("retention_extended", actor, "Extended by #{additional_days} days. Reason: #{reason}")
      save!

      log_audit_event("retention_extended", actor, {
        old_expiration: old_date&.iso8601,
        new_expiration: expiration_date.iso8601,
        additional_days: additional_days,
        reason: reason
      })

      true
    end

    # Record review
    def record_review!(actor:, notes: nil)
      self.last_reviewed_at = Time.current
      self.reviewed_by_id = actor.id

      record_history("reviewed", actor, notes)
      save!

      self
    end

    # Days until expiration
    def days_until_expiration
      return nil unless expiration_date

      ((expiration_date - Time.current) / 1.day).ceil
    end

    # Days overdue
    def days_overdue
      return 0 unless past_expiration?

      ((Time.current - expiration_date) / 1.day).floor
    end

    private

    def record_history(action, actor = nil, details = nil)
      history << {
        "action" => action,
        "at" => Time.current.iso8601,
        "actor_id" => actor&.id&.to_s,
        "actor_name" => actor&.full_name,
        "details" => details
      }.compact
    end

    def log_audit_event(action, actor, metadata = {})
      Audit::AuditEvent.log(
        event_type: Audit::AuditEvent::TYPES[:record],
        action: action,
        target: document,
        actor: actor,
        metadata: metadata.merge(
          retention_policy: policy.name,
          schedule_id: id.to_s
        ),
        tags: ["retention", action]
      )
    end
  end
  # rubocop:enable Metrics/ClassLength
end
