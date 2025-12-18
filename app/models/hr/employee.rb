# frozen_string_literal: true

module Hr
  # Employee profile extending User with HR-specific data
  # Tracks vacation balance, supervisor hierarchy, and employment details
  #
  class Employee
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "hr_employees"

    # Employment status constants
    STATUS_ACTIVE = "active"
    STATUS_ON_LEAVE = "on_leave"
    STATUS_TERMINATED = "terminated"
    STATUS_SUSPENDED = "suspended"

    STATUSES = [STATUS_ACTIVE, STATUS_ON_LEAVE, STATUS_TERMINATED, STATUS_SUSPENDED].freeze

    # Employment type constants
    TYPE_FULL_TIME = "full_time"
    TYPE_PART_TIME = "part_time"
    TYPE_CONTRACTOR = "contractor"
    TYPE_INTERN = "intern"

    EMPLOYMENT_TYPES = [TYPE_FULL_TIME, TYPE_PART_TIME, TYPE_CONTRACTOR, TYPE_INTERN].freeze

    # Fields
    field :employee_number, type: String
    field :employment_status, type: String, default: STATUS_ACTIVE
    field :employment_type, type: String, default: TYPE_FULL_TIME
    field :hire_date, type: Date
    field :termination_date, type: Date
    field :job_title, type: String
    field :department, type: String
    field :cost_center, type: String

    # Vacation balance (mock for now - would integrate with payroll system)
    field :vacation_balance_days, type: Float, default: 0.0
    field :vacation_accrued_ytd, type: Float, default: 0.0
    field :vacation_used_ytd, type: Float, default: 0.0
    field :vacation_carry_over, type: Float, default: 0.0

    # Sick leave balance
    field :sick_leave_balance_days, type: Float, default: 0.0
    field :sick_leave_used_ytd, type: Float, default: 0.0

    # Personal data
    field :date_of_birth, type: Date
    field :emergency_contact_name, type: String
    field :emergency_contact_phone, type: String

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ employee_number: 1 }, { unique: true, sparse: true })
    index({ user_id: 1 }, { unique: true })
    index({ supervisor_id: 1 })
    index({ organization_id: 1 })
    index({ employment_status: 1 })
    index({ department: 1 })
    index({ organization_id: 1, employment_status: 1 })

    # Associations
    belongs_to :user, class_name: "Identity::User"
    belongs_to :supervisor, class_name: "Hr::Employee", optional: true
    belongs_to :organization, class_name: "Identity::Organization"
    has_many :subordinates, class_name: "Hr::Employee", inverse_of: :supervisor
    has_many :vacation_requests, class_name: "Hr::VacationRequest", inverse_of: :employee
    has_many :certification_requests, class_name: "Hr::EmploymentCertificationRequest", inverse_of: :employee

    # Validations
    validates :user_id, uniqueness: true
    validates :employment_status, inclusion: { in: STATUSES }
    validates :employment_type, inclusion: { in: EMPLOYMENT_TYPES }
    validates :vacation_balance_days, numericality: { greater_than_or_equal_to: 0 }
    validates :employee_number, uniqueness: true, allow_blank: true

    # Scopes
    scope :active, -> { where(employment_status: STATUS_ACTIVE) }
    scope :on_leave, -> { where(employment_status: STATUS_ON_LEAVE) }
    scope :terminated, -> { where(employment_status: STATUS_TERMINATED) }
    scope :by_department, ->(dept) { where(department: dept) }
    scope :by_supervisor, ->(supervisor) { where(supervisor_id: supervisor.id) }
    scope :full_time, -> { where(employment_type: TYPE_FULL_TIME) }

    # Delegate user attributes
    delegate :email, :first_name, :last_name, :full_name, to: :user
    delegate :has_role?, :has_permission?, :admin?, to: :user

    # Check if employee is a supervisor
    def supervisor?
      subordinates.active.exists?
    end

    # Check if employee is HR staff
    def hr_staff?
      user.has_role?("hr") || user.has_role?("hr_manager") || user.admin?
    end

    # Check if employee is HR manager
    def hr_manager?
      user.has_role?("hr_manager") || user.admin?
    end

    # Check if this employee supervises another
    def supervises?(other_employee)
      return false unless other_employee

      other_employee.supervisor_id == id
    end

    # Get all subordinates recursively (direct reports + their reports)
    def all_subordinates
      direct = subordinates.to_a
      indirect = direct.flat_map(&:all_subordinates)
      direct + indirect
    end

    # Check if has sufficient vacation balance
    def has_vacation_balance?(days) # rubocop:disable Naming/PredicatePrefix
      vacation_balance_days >= days
    end

    # Deduct vacation days (called when request is approved)
    def deduct_vacation!(days)
      raise InsufficientBalanceError, "Insufficient vacation balance" unless has_vacation_balance?(days)

      self.vacation_balance_days -= days
      self.vacation_used_ytd += days
      save!
    end

    # Restore vacation days (called when approved request is cancelled)
    def restore_vacation!(days)
      self.vacation_balance_days += days
      self.vacation_used_ytd -= days
      save!
    end

    # Mock: Accrue vacation days (would be called by payroll integration)
    def accrue_vacation!(days)
      self.vacation_balance_days += days
      self.vacation_accrued_ytd += days
      save!
    end

    # Get pending vacation requests
    def pending_vacation_requests
      vacation_requests.pending
    end

    # Get approved vacation days for a date range
    def approved_vacation_days_in_range(start_date, end_date)
      vacation_requests
        .approved
        .overlapping(start_date, end_date)
        .sum(&:business_days)
    end

    # Get supervisor chain (for escalation)
    def supervisor_chain
      chain = []
      current = supervisor
      while current
        chain << current
        current = current.supervisor
      end
      chain
    end

    class << self
      # Find employee by user
      def for_user(user)
        where(user_id: user.id).first
      end

      # Find or create employee for user
      def find_or_create_for_user!(user, attributes = {})
        where(user_id: user.id).first || create!(
          attributes.merge(
            user: user,
            organization: user.organization
          )
        )
      end

      # Mock: Initialize vacation balances for new year
      def reset_vacation_balances_for_year!(organization, default_days: 15)
        active.where(organization_id: organization.id).find_each do |employee|
          carry_over = [employee.vacation_balance_days, 5].min # Max 5 days carry over
          employee.update!(
            vacation_carry_over: carry_over,
            vacation_balance_days: default_days + carry_over,
            vacation_accrued_ytd: 0,
            vacation_used_ytd: 0
          )
        end
      end
    end

    class InsufficientBalanceError < StandardError; end
  end
end
