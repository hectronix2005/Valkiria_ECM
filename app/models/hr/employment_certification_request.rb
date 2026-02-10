# frozen_string_literal: true

module Hr
  # Employment certification request (constancia laboral)
  # Can be requested by employee, processed by HR
  #
  # rubocop:disable Metrics/ClassLength
  class EmploymentCertificationRequest
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "hr_certification_requests"

    # Status constants
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"

    STATUSES = [STATUS_PENDING, STATUS_PROCESSING, STATUS_COMPLETED, STATUS_REJECTED, STATUS_CANCELLED].freeze

    # Certification type constants
    TYPE_EMPLOYMENT = "employment"           # Basic employment verification
    TYPE_SALARY = "salary"                   # With salary information
    TYPE_POSITION = "position"               # Position/role details
    TYPE_FULL = "full"                       # Complete employment details
    TYPE_CUSTOM = "custom"                   # Custom content requested

    CERTIFICATION_TYPES = [TYPE_EMPLOYMENT, TYPE_SALARY, TYPE_POSITION, TYPE_FULL, TYPE_CUSTOM].freeze

    # Purpose constants (why they need the letter)
    PURPOSE_BANK = "bank"                    # Bank loan/credit
    PURPOSE_VISA = "visa"                    # Visa application
    PURPOSE_RENTAL = "rental"                # Rental application
    PURPOSE_GOVERNMENT = "government"        # Government procedures
    PURPOSE_LEGAL = "legal"                  # Legal proceedings
    PURPOSE_OTHER = "other"

    PURPOSES = [PURPOSE_BANK, PURPOSE_VISA, PURPOSE_RENTAL, PURPOSE_GOVERNMENT, PURPOSE_LEGAL, PURPOSE_OTHER].freeze

    # Fields
    field :request_number, type: String
    field :certification_type, type: String, default: TYPE_EMPLOYMENT
    field :purpose, type: String, default: PURPOSE_OTHER
    field :purpose_details, type: String
    field :addressee, type: String # "To whom it may concern" or specific
    field :language, type: String, default: "es" # es, en
    field :special_instructions, type: String
    field :status, type: String, default: STATUS_PENDING

    # Include specific data (for salary type)
    field :include_salary, type: Boolean, default: false
    field :include_start_date, type: Boolean, default: true
    field :include_position, type: Boolean, default: true
    field :include_department, type: Boolean, default: false

    # Processing fields
    field :submitted_at, type: Time
    field :processed_at, type: Time
    field :completed_at, type: Time
    field :rejection_reason, type: String
    field :processor_notes, type: String

    # Generated document reference
    field :document_uuid, type: String # Reference to generated PDF document
    field :pickup_date, type: Date
    field :delivery_method, type: String, default: "digital" # digital, physical, both

    # History tracking
    field :history, type: Array, default: []

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ request_number: 1 }, { unique: true, sparse: true })
    index({ employee_id: 1 })
    index({ processed_by_id: 1 })
    index({ organization_id: 1 })
    index({ status: 1 })
    index({ organization_id: 1, status: 1 })
    index({ employee_id: 1, status: 1 })

    # Associations
    belongs_to :employee, class_name: "Hr::Employee"
    belongs_to :processed_by, class_name: "Hr::Employee", optional: true
    belongs_to :organization, class_name: "Identity::Organization"

    # Validations
    validates :certification_type, inclusion: { in: CERTIFICATION_TYPES }
    validates :purpose, inclusion: { in: PURPOSES }
    validates :status, inclusion: { in: STATUSES }
    validates :language, inclusion: { in: ["es", "en"] }
    validate :salary_permission_required, if: :include_salary?

    # Callbacks
    before_create :generate_request_number
    before_create :set_submitted_at
    after_create :log_request_created

    # Scopes
    scope :pending, -> { where(status: STATUS_PENDING) }
    scope :processing, -> { where(status: STATUS_PROCESSING) }
    scope :completed, -> { where(status: STATUS_COMPLETED) }
    scope :rejected, -> { where(status: STATUS_REJECTED) }
    scope :cancelled, -> { where(status: STATUS_CANCELLED) }
    scope :for_processing, -> { where(:status.in => [STATUS_PENDING, STATUS_PROCESSING]) }

    # State predicates
    def pending?
      status == STATUS_PENDING
    end

    def processing?
      status == STATUS_PROCESSING
    end

    def completed?
      status == STATUS_COMPLETED
    end

    def rejected?
      status == STATUS_REJECTED
    end

    def cancelled?
      status == STATUS_CANCELLED
    end

    # Start processing (by HR)
    def start_processing!(actor:)
      raise InvalidStateError, "Can only process pending requests" unless pending?
      raise AuthorizationError, "Only HR staff can process requests" unless actor.hr_staff?

      self.status = STATUS_PROCESSING
      self.processed_by = actor
      self.processed_at = Time.current

      record_history("processing_started", actor)
      save!

      log_audit_event("certification_processing_started", actor)

      self
    end

    # Complete request (by HR)
    # rubocop:disable Naming/PredicateMethod
    def complete!(actor:, document_uuid: nil, notes: nil)
      raise InvalidStateError, "Can only complete processing requests" unless processing?
      raise AuthorizationError, "Only HR staff can complete requests" unless actor.hr_staff?

      self.status = STATUS_COMPLETED
      self.completed_at = Time.current
      self.document_uuid = document_uuid
      self.processor_notes = notes

      record_history("completed", actor, notes)
      save!

      log_audit_event("certification_completed", actor, { document_uuid: document_uuid })

      true
    end

    # Reject request (by HR)
    def reject!(actor:, reason:)
      raise InvalidStateError, "Cannot reject completed requests" if completed?
      raise AuthorizationError, "Only HR staff can reject requests" unless actor.hr_staff?
      raise ValidationError, "Rejection reason is required" if reason.blank?

      self.status = STATUS_REJECTED
      self.rejection_reason = reason
      self.completed_at = Time.current

      record_history("rejected", actor, reason)
      save!

      log_audit_event("certification_rejected", actor, { reason: reason })

      true
    end

    # Cancel request (by employee)
    def cancel!(actor:, reason: nil)
      raise InvalidStateError, "Cannot cancel completed or rejected requests" if completed? || rejected?
      raise AuthorizationError, "Only the employee can cancel their request" unless can_cancel?(actor)

      self.status = STATUS_CANCELLED

      record_history("cancelled", actor, reason)
      save!

      log_audit_event("certification_cancelled", actor, { reason: reason })

      true
    end

    # Check if actor can view this request
    def can_view?(actor)
      return true if actor.hr_staff?
      return true if actor.id == employee.id
      return true if actor.supervises?(employee)

      false
    end

    # Check if actor can cancel this request
    def can_cancel?(actor)
      return false if completed? || rejected?
      return true if actor.hr_staff?

      actor.id == employee.id
    end

    # rubocop:enable Naming/PredicateMethod

    # Estimated processing time in days
    # rubocop:disable Lint/DuplicateBranch
    def estimated_days
      case certification_type
      when TYPE_EMPLOYMENT, TYPE_POSITION
        1
      when TYPE_SALARY
        2
      when TYPE_FULL, TYPE_CUSTOM
        3
      else
        1 # Default to shortest time for unknown types
      end
    end
    # rubocop:enable Lint/DuplicateBranch

    # Generate certification content (for preview/generation)
    def certification_content
      {
        employee_name: employee.full_name,
        employee_number: employee.employee_number,
        job_title: include_position? ? employee.job_title : nil,
        department: include_department? ? employee.department : nil,
        hire_date: include_start_date? ? employee.hire_date : nil,
        employment_status: employee.employment_status,
        employment_type: employee.employment_type,
        addressee: addressee || "A quien corresponda",
        language: language,
        certification_type: certification_type,
        purpose: purpose,
        generated_at: Time.current
      }.compact
    end

    private

    def salary_permission_required
      return unless include_salary? && certification_type != TYPE_SALARY

      errors.add(:include_salary, "requires salary certification type") unless certification_type == TYPE_FULL
    end

    def generate_request_number
      return if request_number.present?

      year = Date.current.year
      # Use max existing number + 1 instead of count to avoid race conditions
      # with the unique index on request_number as a safety net
      last_request = EmploymentCertificationRequest
        .where(organization_id: organization_id)
        .where(:request_number => /\ACERT-#{year}-/)
        .order(request_number: :desc)
        .first

      sequence = if last_request&.request_number
                   last_request.request_number.split("-").last.to_i + 1
                 else
                   1
                 end

      self.request_number = "CERT-#{year}-#{sequence.to_s.rjust(5, "0")}"
    end

    def set_submitted_at
      self.submitted_at ||= Time.current
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
      log_audit_event("certification_request_created", employee)
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
          certification_type: certification_type,
          purpose: purpose
        ),
        tags: ["hr", "certification", action]
      )
    end

    class InvalidStateError < StandardError; end
    class AuthorizationError < StandardError; end
    class ValidationError < StandardError; end
  end
  # rubocop:enable Metrics/ClassLength
end
