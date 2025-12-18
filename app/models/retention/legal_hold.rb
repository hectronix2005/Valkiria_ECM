# frozen_string_literal: true

module Retention
  # Represents a legal hold placed on a document
  # While under legal hold, a document cannot be modified, archived, or deleted
  #
  # Legal holds are typically placed during litigation, regulatory investigation,
  # or audit situations where document preservation is legally required
  #
  # rubocop:disable Metrics/ClassLength
  class LegalHold
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "legal_holds"

    # Status constants
    STATUS_ACTIVE = "active"
    STATUS_RELEASED = "released"

    STATUSES = [STATUS_ACTIVE, STATUS_RELEASED].freeze

    # Hold types
    TYPE_LITIGATION = "litigation"
    TYPE_REGULATORY = "regulatory"
    TYPE_AUDIT = "audit"
    TYPE_INVESTIGATION = "investigation"
    TYPE_PRESERVATION = "preservation"

    TYPES = [TYPE_LITIGATION, TYPE_REGULATORY, TYPE_AUDIT, TYPE_INVESTIGATION, TYPE_PRESERVATION].freeze

    # Fields
    field :name, type: String
    field :description, type: String
    field :hold_type, type: String
    field :status, type: String, default: STATUS_ACTIVE
    field :reference_number, type: String # Case number, audit ID, etc.

    # Dates
    field :effective_date, type: Time
    field :release_date, type: Time
    field :expected_release_date, type: Time

    # Release information
    field :release_reason, type: String
    field :released_by_id, type: BSON::ObjectId
    field :released_by_name, type: String

    # Custodian information
    field :custodian_name, type: String
    field :custodian_email, type: String
    field :custodian_department, type: String

    # Notes and history
    field :notes, type: String
    field :history, type: Array, default: []

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ status: 1 })
    index({ reference_number: 1 })
    index({ schedule_id: 1, status: 1 })
    index({ organization_id: 1, status: 1 })
    index({ hold_type: 1 })

    # Associations
    belongs_to :schedule, class_name: "Retention::RetentionSchedule", inverse_of: :legal_holds
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :placed_by, class_name: "Identity::User"

    # Validations
    validates :name, presence: true
    validates :hold_type, presence: true, inclusion: { in: TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :effective_date, presence: true
    validates :custodian_name, presence: true

    # Scopes
    scope :active, -> { where(status: STATUS_ACTIVE) }
    scope :released, -> { where(status: STATUS_RELEASED) }
    scope :by_type, ->(type) { where(hold_type: type) }
    scope :for_reference, ->(ref) { where(reference_number: ref) }

    # Callbacks
    after_create :place_schedule_on_hold
    after_save :update_schedule_hold_status, if: :saved_change_to_status?

    # Check if hold is active
    def active?
      status == STATUS_ACTIVE
    end

    # Check if hold is released
    def released?
      status == STATUS_RELEASED
    end

    # Release the hold
    # rubocop:disable Naming/PredicateMethod
    def release!(actor:, reason:)
      return false if released?

      self.status = STATUS_RELEASED
      self.release_date = Time.current
      self.release_reason = reason
      self.released_by_id = actor.id
      self.released_by_name = actor.full_name

      record_history("released", actor, reason)
      save!

      log_audit_event("legal_hold_released", actor, {
        release_reason: reason,
        hold_duration_days: hold_duration_days
      })

      true
    end
    # rubocop:enable Naming/PredicateMethod

    # Extend expected release date
    def extend!(new_expected_date:, actor:, reason: nil) # rubocop:disable Naming/PredicateMethod
      return false unless active?

      old_date = expected_release_date
      self.expected_release_date = new_expected_date

      record_history("extended", actor, "Extended to #{new_expected_date}. Reason: #{reason}")
      save!

      log_audit_event("legal_hold_extended", actor, {
        old_expected_date: old_date&.iso8601,
        new_expected_date: new_expected_date.iso8601,
        reason: reason
      })

      true
    end

    # Duration of hold in days
    def hold_duration_days
      end_date = release_date || Time.current
      ((end_date - effective_date) / 1.day).ceil
    end

    # Get the document through schedule
    def document
      schedule&.document
    end

    # Human-readable hold type
    def hold_type_display
      hold_type.to_s.titleize
    end

    private

    def place_schedule_on_hold
      schedule.place_on_hold!(reason: "Legal hold: #{name}")

      log_audit_event("legal_hold_placed", placed_by, {
        hold_type: hold_type,
        reference_number: reference_number,
        custodian: custodian_name
      })
    end

    def update_schedule_hold_status
      return unless released?

      # Check if there are other active holds
      schedule.release_from_hold! unless schedule.legal_holds.active.exists?(:id.ne => id)
    end

    def record_history(action, actor, details = nil)
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
        target: document || schedule,
        actor: actor,
        metadata: metadata.merge(
          legal_hold_id: id.to_s,
          legal_hold_name: name
        ),
        tags: ["legal_hold", action]
      )
    end

    class << self
      # Find all holds for a document
      def for_document(document)
        schedule = Retention::RetentionSchedule.where(document_id: document.id).first
        return none unless schedule

        where(schedule_id: schedule.id)
      end

      # Place a new hold on a document
      def place_hold!(document:, name:, hold_type:, placed_by:, organization:, **)
        # Find or create retention schedule for document
        schedule = Retention::RetentionSchedule.where(document_id: document.id).first

        schedule ||= Retention::RetentionSchedule.create!(
          document: document,
          organization: organization,
          status: Retention::RetentionSchedule::STATUS_HELD,
          retention_start_date: Time.current
        )

        create!(
          schedule: schedule,
          organization: organization,
          name: name,
          hold_type: hold_type,
          placed_by: placed_by,
          effective_date: Time.current,
          **
        )
      end
    end
  end
  # rubocop:enable Metrics/ClassLength
end
