# frozen_string_literal: true

module Hr
  # Vacation/PTO request with approval workflow
  # Requires supervisor approval, enforces balance rules
  #
  # rubocop:disable Metrics/ClassLength
  class VacationRequest
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "hr_vacation_requests"

    # Status constants
    STATUS_DRAFT = "draft"
    STATUS_PENDING = "pending"      # Solicitada
    STATUS_APPROVED = "approved"    # Aprobada (programada, aún no disfrutada)
    STATUS_ENJOYED = "enjoyed"      # Disfrutada (vacaciones ya tomadas)
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"

    STATUSES = [STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_ENJOYED, STATUS_REJECTED, STATUS_CANCELLED].freeze

    STATUS_LABELS = {
      STATUS_DRAFT => "Borrador",
      STATUS_PENDING => "Solicitada",
      STATUS_APPROVED => "Aprobada",
      STATUS_ENJOYED => "Disfrutada",
      STATUS_REJECTED => "Rechazada",
      STATUS_CANCELLED => "Cancelada"
    }.freeze

    # Vacation type constants
    TYPE_VACATION = "vacation"
    TYPE_PERSONAL = "personal"
    TYPE_SICK = "sick"
    TYPE_BEREAVEMENT = "bereavement"
    TYPE_UNPAID = "unpaid"

    VACATION_TYPES = [TYPE_VACATION, TYPE_PERSONAL, TYPE_SICK, TYPE_BEREAVEMENT, TYPE_UNPAID].freeze

    # Fields
    field :request_number, type: String
    field :vacation_type, type: String, default: TYPE_VACATION
    field :start_date, type: Date
    field :end_date, type: Date
    field :days_requested, type: Float
    field :reason, type: String
    field :status, type: String, default: STATUS_DRAFT
    field :notes, type: String

    # Approval fields
    field :submitted_at, type: Time
    field :decided_at, type: Time
    field :decision_reason, type: String
    field :approved_by_name, type: String

    # Generated document reference
    field :document_uuid, type: String

    # History tracking
    field :history, type: Array, default: []

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ request_number: 1 }, { unique: true, sparse: true })
    index({ employee_id: 1 })
    index({ approver_id: 1 })
    index({ organization_id: 1 })
    index({ status: 1 })
    index({ start_date: 1 })
    index({ end_date: 1 })
    index({ organization_id: 1, status: 1 })
    index({ employee_id: 1, status: 1 })
    index({ approver_id: 1, status: 1 })

    # Associations
    belongs_to :employee, class_name: "Hr::Employee"
    belongs_to :approver, class_name: "Hr::Employee", optional: true
    belongs_to :organization, class_name: "Identity::Organization"

    # Validations
    validates :vacation_type, inclusion: { in: VACATION_TYPES }
    validates :status, inclusion: { in: STATUSES }
    validates :start_date, presence: true
    validates :end_date, presence: true
    validates :days_requested, presence: true, numericality: { greater_than: 0 }
    validate :end_date_after_start_date
    validate :dates_not_in_past, on: :create
    validate :sufficient_balance, on: :create, if: :requires_balance_check?
    validate :no_overlapping_requests, if: :dates_changed?

    # Callbacks
    before_create :generate_request_number
    after_create :log_request_created

    # Scopes
    scope :draft, -> { where(status: STATUS_DRAFT) }
    scope :pending, -> { where(status: STATUS_PENDING) }
    scope :approved, -> { where(status: STATUS_APPROVED) }
    scope :enjoyed, -> { where(status: STATUS_ENJOYED) }
    scope :rejected, -> { where(status: STATUS_REJECTED) }
    scope :cancelled, -> { where(status: STATUS_CANCELLED) }
    scope :active, -> { where(:status.in => [STATUS_PENDING, STATUS_APPROVED]) }
    scope :decided, -> { where(:status.in => [STATUS_APPROVED, STATUS_REJECTED]) }
    scope :scheduled, -> { approved.where(:start_date.gt => Date.current) }  # Programadas (futuras)
    scope :in_progress, -> { approved.where(:start_date.lte => Date.current, :end_date.gte => Date.current) }
    scope :used, -> { where(:status.in => [STATUS_APPROVED, STATUS_ENJOYED]) }  # Consumen balance
    scope :for_approval_by, ->(employee) { pending.where(approver_id: employee.id) }
    scope :upcoming, -> { approved.where(:start_date.gte => Date.current) }
    scope :past, -> { approved.where(:end_date.lt => Date.current) }
    scope :current, -> { approved.where(:start_date.lte => Date.current, :end_date.gte => Date.current) }
    scope :in_date_range, ->(start_d, end_d) { where(:start_date.lte => end_d, :end_date.gte => start_d) }
    scope :overlapping, ->(start_d, end_d) { approved.in_date_range(start_d, end_d) }

    # State predicates
    def draft?
      status == STATUS_DRAFT
    end

    def pending?
      status == STATUS_PENDING
    end

    def approved?
      status == STATUS_APPROVED
    end

    def rejected?
      status == STATUS_REJECTED
    end

    def cancelled?
      status == STATUS_CANCELLED
    end

    def enjoyed?
      status == STATUS_ENJOYED
    end

    def decided?
      approved? || rejected?
    end

    def status_label
      STATUS_LABELS[status] || status
    end

    # Check if vacation period has passed and should be marked as enjoyed
    def should_mark_as_enjoyed?
      approved? && end_date < Date.current
    end

    # Submit request for approval
    def submit!(actor:)
      raise InvalidStateError, "Can only submit draft requests" unless draft?
      raise ValidationError, "Insufficient vacation balance" unless has_sufficient_balance?

      self.status = STATUS_PENDING
      self.submitted_at = Time.current
      self.approver = determine_approver

      record_history("submitted", actor)
      save!

      log_audit_event("vacation_request_submitted", actor)

      self
    end

    # Approve request (by supervisor or HR)
    # rubocop:disable Naming/PredicateMethod
    def approve!(actor:, reason: nil)
      raise InvalidStateError, "Can only approve pending requests" unless pending?
      raise AuthorizationError, "Not authorized to approve" unless can_approve?(actor)

      self.status = STATUS_APPROVED
      self.decided_at = Time.current
      self.decision_reason = reason
      self.approved_by_name = actor.full_name

      # Deduct vacation balance
      employee.deduct_vacation!(days_requested) if deducts_balance?

      record_history("approved", actor, reason)
      save!

      log_audit_event("vacation_request_approved", actor, { reason: reason })

      true
    end

    # Reject request
    def reject!(actor:, reason:)
      raise InvalidStateError, "Can only reject pending requests" unless pending?
      raise AuthorizationError, "Not authorized to reject" unless can_approve?(actor)
      raise ValidationError, "Rejection reason is required" if reason.blank?

      self.status = STATUS_REJECTED
      self.decided_at = Time.current
      self.decision_reason = reason

      record_history("rejected", actor, reason)
      save!

      log_audit_event("vacation_request_rejected", actor, { reason: reason })

      true
    end

    # Cancel request (by employee or HR)
    def cancel!(actor:, reason: nil)
      raise InvalidStateError, "Cannot cancel decided requests" if rejected?

      was_approved = approved?

      self.status = STATUS_CANCELLED
      self.decided_at = Time.current
      self.decision_reason = reason

      # Restore vacation balance if was approved
      employee.restore_vacation!(days_requested) if was_approved && deducts_balance?

      record_history("cancelled", actor, reason)
      save!

      log_audit_event("vacation_request_cancelled", actor, {
        reason: reason,
        was_approved: was_approved
      })

      true
    end

    # Mark vacation as enjoyed (after end_date has passed)
    def mark_as_enjoyed!(actor: nil)
      raise InvalidStateError, "Can only mark approved vacations as enjoyed" unless approved?
      raise InvalidStateError, "Cannot mark as enjoyed before end date" if end_date >= Date.current

      self.status = STATUS_ENJOYED

      record_history("enjoyed", actor)
      save!

      log_audit_event("vacation_request_enjoyed", actor) if actor

      true
    end

    # Class method to auto-mark past approved vacations as enjoyed
    def self.mark_past_vacations_as_enjoyed!
      approved.where(:end_date.lt => Date.current).each do |vacation|
        vacation.mark_as_enjoyed!
      rescue InvalidStateError
        # Skip if already processed
        next
      end
    end

    # Check if actor can approve this request
    def can_approve?(actor)
      # Must be in same organization
      return false unless actor.organization_id == organization_id

      return true if actor.hr_manager?
      return true if actor.hr_staff? && employee.supervisor.nil?

      actor.supervises?(employee)
    end

    # Check if actor can view this request
    def can_view?(actor)
      return true if actor.hr_staff?
      return true if actor.id == employee.id
      return true if actor.supervises?(employee)

      employee.supervisor_chain.include?(actor)
    end

    # Check if actor can cancel this request
    # rubocop:disable Metrics/PerceivedComplexity
    def can_cancel?(actor)
      return false if rejected?
      return true if actor.hr_manager?
      return true if actor.id == employee.id && (draft? || pending?)
      return true if actor.id == employee.id && approved? && start_date > Date.current

      false
    end
    # rubocop:enable Metrics/PerceivedComplexity
    # rubocop:enable Naming/PredicateMethod

    # Calculate business days (simplified - excludes weekends)
    def business_days
      return days_requested if days_requested

      count = 0
      (start_date..end_date).each do |date|
        count += 1 unless date.saturday? || date.sunday?
      end
      count
    end

    private

    def end_date_after_start_date
      return unless start_date && end_date

      errors.add(:end_date, "must be after or equal to start date") if end_date < start_date
    end

    def dates_not_in_past
      return unless start_date

      # Allow 1 day tolerance for timezone differences (UTC vs local time)
      errors.add(:start_date, "cannot be in the past") if start_date < Date.current - 1.day
    end

    def no_overlapping_requests
      return unless employee && start_date && end_date

      # Find other requests from the same employee that overlap with these dates
      # Exclude cancelled and rejected requests, and exclude self (for updates)
      overlapping = employee.vacation_requests
                            .where(:status.nin => [STATUS_CANCELLED, STATUS_REJECTED])
                            .where(:id.ne => id)
                            .where(:start_date.lte => end_date, :end_date.gte => start_date)

      return unless overlapping.exists?

      overlapping_request = overlapping.first
      errors.add(:base, "Ya tienes una solicitud (#{overlapping_request.request_number}) que incluye estas fechas")
    end

    def dates_changed?
      new_record? || start_date_changed? || end_date_changed?
    end

    def sufficient_balance
      return unless employee && days_requested

      return if has_sufficient_balance?

      errors.add(:days_requested, "exceeds available vacation balance")
    end

    def has_sufficient_balance? # rubocop:disable Naming/PredicatePrefix
      return true unless requires_balance_check?

      employee.has_vacation_balance?(days_requested)
    end

    def requires_balance_check?
      [TYPE_VACATION, TYPE_PERSONAL].include?(vacation_type)
    end

    def deducts_balance?
      [TYPE_VACATION, TYPE_PERSONAL].include?(vacation_type)
    end

    def determine_approver
      employee.supervisor || find_hr_manager
    end

    def find_hr_manager
      Hr::Employee
        .where(organization_id: organization_id)
        .active
        .detect(&:hr_manager?)
    end

    def generate_request_number
      return if request_number.present?

      year = Date.current.year
      sequence = VacationRequest.where(organization_id: organization_id)
        .where(:created_at.gte => Date.new(year, 1, 1))
        .count + 1

      self.request_number = "VAC-#{year}-#{sequence.to_s.rjust(5, "0")}"
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

    def log_request_created
      log_audit_event("vacation_request_created", employee)
    end

    def log_audit_event(action, actor, metadata = {})
      Audit::AuditEvent.log(
        event_type: "hr",
        action: action,
        target: self,
        actor: actor&.user,
        metadata: metadata.merge(
          request_number: request_number,
          employee_name: employee.full_name,
          vacation_type: vacation_type,
          days_requested: days_requested,
          start_date: start_date&.iso8601,
          end_date: end_date&.iso8601
        ),
        tags: ["hr", "vacation", action]
      )
    end

    class InvalidStateError < StandardError; end
    class AuthorizationError < StandardError; end
    class ValidationError < StandardError; end
  end
  # rubocop:enable Metrics/ClassLength
end
