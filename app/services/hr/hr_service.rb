# frozen_string_literal: true

module Hr
  # Main service for HR operations
  # Handles vacation requests, certifications, and employee management
  #
  # rubocop:disable Metrics/ClassLength
  class HrService
    attr_reader :actor, :organization

    def initialize(actor:, organization: nil)
      @actor = actor
      @organization = organization || actor.organization
      @employee = find_or_create_employee(actor)
    end

    # ============================================
    # Employee Management
    # ============================================

    def current_employee
      @employee
    end

    def find_employee(user_or_id)
      case user_or_id
      when Hr::Employee
        user_or_id
      when Identity::User
        Hr::Employee.find_by(user_id: user_or_id.id)
      else
        Hr::Employee.find(user_or_id)
      end
    end

    def get_subordinates # rubocop:disable Naming/AccessorMethodName
      return Hr::Employee.active.where(organization_id: organization.id) if @employee.hr_manager?

      @employee.subordinates.active
    end

    def get_team_calendar(start_date, end_date)
      employees = if @employee.hr_manager?
                    Hr::Employee.where(organization_id: organization.id).pluck(:id)
                  else
                    [@employee.id] + @employee.subordinates.pluck(:id)
                  end

      VacationRequest
        .where(:employee_id.in => employees)
        .approved
        .in_date_range(start_date, end_date)
        .includes(:employee)
    end

    # ============================================
    # Vacation Requests
    # ============================================

    def create_vacation_request(start_date:, end_date:, vacation_type: VacationRequest::TYPE_VACATION, reason: nil)
      days = calculate_business_days(start_date, end_date)

      request = VacationRequest.new(
        employee: @employee,
        organization: organization,
        start_date: start_date,
        end_date: end_date,
        days_requested: days,
        vacation_type: vacation_type,
        reason: reason
      )

      request.save!
      request
    end

    def submit_vacation_request(request)
      ensure_own_request!(request)
      request.submit!(actor: @employee)
    end

    def approve_vacation_request(request, reason: nil)
      ensure_can_approve!(request)
      request.approve!(actor: @employee, reason: reason)
    end

    def reject_vacation_request(request, reason:)
      ensure_can_approve!(request)
      request.reject!(actor: @employee, reason: reason)
    end

    def cancel_vacation_request(request, reason: nil)
      raise AuthorizationError, "Cannot cancel this request" unless request.can_cancel?(@employee)

      request.cancel!(actor: @employee, reason: reason)
    end

    def my_vacation_requests
      @employee.vacation_requests.order(created_at: :desc)
    end

    def pending_approvals
      if @employee.hr_manager?
        VacationRequest
          .where(organization_id: organization.id)
          .pending
          .order(submitted_at: :asc)
      else
        VacationRequest.for_approval_by(@employee).order(submitted_at: :asc)
      end
    end

    def vacation_balance
      {
        available: @employee.vacation_balance_days,
        used_ytd: @employee.vacation_used_ytd,
        accrued_ytd: @employee.vacation_accrued_ytd,
        carry_over: @employee.vacation_carry_over,
        pending: pending_vacation_days
      }
    end

    # ============================================
    # Employment Certification Requests
    # ============================================

    def create_certification_request(
      certification_type: EmploymentCertificationRequest::TYPE_EMPLOYMENT,
      purpose: EmploymentCertificationRequest::PURPOSE_OTHER,
      **
    )
      request = EmploymentCertificationRequest.new(
        employee: @employee,
        organization: organization,
        certification_type: certification_type,
        purpose: purpose,
        **
      )

      request.save!
      request
    end

    def cancel_certification_request(request, reason: nil)
      raise AuthorizationError, "Cannot cancel this request" unless request.can_cancel?(@employee)

      request.cancel!(actor: @employee, reason: reason)
    end

    def my_certification_requests
      @employee.certification_requests.order(created_at: :desc)
    end

    def process_certification_request(request)
      ensure_hr_staff!
      request.start_processing!(actor: @employee)
    end

    def complete_certification_request(request, document_uuid: nil, notes: nil)
      ensure_hr_staff!
      request.complete!(actor: @employee, document_uuid: document_uuid, notes: notes)
    end

    def reject_certification_request(request, reason:)
      ensure_hr_staff!
      request.reject!(actor: @employee, reason: reason)
    end

    def pending_certifications
      ensure_hr_staff!
      EmploymentCertificationRequest
        .where(organization_id: organization.id)
        .for_processing
        .order(submitted_at: :asc)
    end

    # ============================================
    # Statistics (HR Dashboard)
    # ============================================

    def statistics
      ensure_hr_staff!

      {
        employees: employee_stats,
        vacation_requests: vacation_request_stats,
        certification_requests: certification_request_stats
      }
    end

    def employee_stats
      ensure_hr_staff!

      {
        total: Hr::Employee.where(organization_id: organization.id).count,
        active: Hr::Employee.active.where(organization_id: organization.id).count,
        on_leave: Hr::Employee.on_leave.where(organization_id: organization.id).count,
        by_department: Hr::Employee
          .where(organization_id: organization.id)
          .active
          .group_by(&:department)
          .transform_values(&:count)
      }
    end

    def vacation_request_stats
      base = VacationRequest.where(organization_id: organization.id)
      current_year = Date.current.year

      {
        pending: base.pending.count,
        approved_this_year: base.approved.where(:start_date.gte => Date.new(current_year, 1, 1)).count,
        rejected_this_year: base.rejected.where(:created_at.gte => Date.new(current_year, 1, 1)).count,
        employees_on_vacation_today: base.current.distinct(:employee_id).count
      }
    end

    def certification_request_stats
      base = EmploymentCertificationRequest.where(organization_id: organization.id)
      current_year = Date.current.year

      {
        pending: base.pending.count,
        processing: base.processing.count,
        completed_this_year: base.completed.where(:completed_at.gte => Date.new(current_year, 1, 1)).count,
        average_processing_days: calculate_avg_processing_time(base.completed)
      }
    end

    private

    def find_or_create_employee(user)
      Hr::Employee.find_or_create_for_user!(
        user.respond_to?(:user) ? user.user : user,
        vacation_balance_days: 15.0 # Default balance for new employees
      )
    end

    def calculate_business_days(start_date, end_date)
      count = 0
      (start_date..end_date).each do |date|
        count += 1 unless date.saturday? || date.sunday?
      end
      count.to_f
    end

    def pending_vacation_days
      @employee.vacation_requests
        .where(:status.in => [VacationRequest::STATUS_PENDING, VacationRequest::STATUS_APPROVED])
        .where(:start_date.gte => Date.current)
        .sum(:days_requested)
    end

    def calculate_avg_processing_time(completed_requests)
      return 0 if completed_requests.empty?

      total_days = completed_requests.sum do |req|
        next 0 unless req.completed_at && req.submitted_at

        (req.completed_at.to_date - req.submitted_at.to_date).to_i
      end

      (total_days.to_f / completed_requests.count).round(1)
    end

    def ensure_own_request!(request)
      return if request.employee_id == @employee.id

      raise AuthorizationError, "Can only submit your own requests"
    end

    def ensure_can_approve!(request)
      return if request.can_approve?(@employee)

      raise AuthorizationError, "Not authorized to approve this request"
    end

    def ensure_hr_staff!
      return if @employee.hr_staff?

      raise AuthorizationError, "Only HR staff can perform this action"
    end

    class AuthorizationError < StandardError; end
  end
  # rubocop:enable Metrics/ClassLength
end
