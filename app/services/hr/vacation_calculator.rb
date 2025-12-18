# frozen_string_literal: true

module Hr
  # Calculates vacation entitlement according to Colombian Labor Law (CST Art. 186)
  #
  # Rules:
  # - 15 business days of paid vacation per year of service
  # - Vacation accrues proportionally from day one
  # - Can accumulate up to 2 periods (30 days max pending)
  # - After 4 years, can compensate in cash up to half of annual vacation
  #
  class VacationCalculator
    DAYS_PER_YEAR = 15.0 # 15 días hábiles por año según ley colombiana
    MAX_ACCUMULATION_YEARS = 2 # Máximo 2 períodos acumulables
    DAYS_IN_YEAR = 365.0

    attr_reader :employee

    def initialize(employee)
      @employee = employee
    end

    # Total days earned since hire date
    def days_accrued
      return 0.0 unless employee.hire_date

      years_worked = years_of_service
      (years_worked * DAYS_PER_YEAR).round(2)
    end

    # Days used (from employee record)
    def days_used
      employee.vacation_used_ytd || 0.0
    end

    # Days pending (accrued - used)
    def days_pending
      [days_accrued - total_days_used, 0.0].max.round(2)
    end

    # Days available to request (considering max accumulation)
    def days_available
      max_allowed = DAYS_PER_YEAR * MAX_ACCUMULATION_YEARS
      [days_pending, max_allowed].min.round(2)
    end

    # Years of service (decimal)
    def years_of_service
      return 0.0 unless employee.hire_date

      days_worked = (Date.current - employee.hire_date.to_date).to_f
      (days_worked / DAYS_IN_YEAR).round(4)
    end

    # Complete years of service (integer)
    def complete_years_of_service
      years_of_service.floor
    end

    # Days accrued in current year (proportional)
    def days_accrued_current_year
      return 0.0 unless employee.hire_date

      # Calculate from anniversary date or hire date in current year
      anniversary_this_year = calculate_anniversary_this_year
      days_since_anniversary = (Date.current - anniversary_this_year).to_f

      return 0.0 if days_since_anniversary.negative?

      ((days_since_anniversary / DAYS_IN_YEAR) * DAYS_PER_YEAR).round(2)
    end

    # Days that will expire if not taken (over max accumulation)
    def days_expiring
      excess = days_pending - (DAYS_PER_YEAR * MAX_ACCUMULATION_YEARS)
      [excess, 0.0].max.round(2)
    end

    # Can request cash compensation? (after 4 years, up to half)
    def can_compensate_in_cash?
      complete_years_of_service >= 4
    end

    # Max days that can be compensated in cash
    def max_cash_compensation_days
      return 0.0 unless can_compensate_in_cash?

      (DAYS_PER_YEAR / 2).round(2) # Half of annual vacation
    end

    # Summary hash for API response
    def summary
      {
        hire_date: employee.hire_date&.iso8601,
        years_of_service: years_of_service.round(2),
        complete_years: complete_years_of_service,
        days_per_year: DAYS_PER_YEAR,
        days_accrued_total: days_accrued,
        days_accrued_current_year: days_accrued_current_year,
        days_used_total: total_days_used,
        days_used_current_year: days_used,
        days_pending: days_pending,
        days_available: days_available,
        days_expiring: days_expiring,
        max_accumulation_days: DAYS_PER_YEAR * MAX_ACCUMULATION_YEARS,
        can_compensate_cash: can_compensate_in_cash?,
        max_cash_compensation: max_cash_compensation_days
      }
    end

    private

    def total_days_used
      # Sum all approved vacation requests
      employee.vacation_requests
        .where(status: "approved")
        .sum(:days_requested) || 0.0
    end

    def calculate_anniversary_this_year
      hire = employee.hire_date.to_date
      anniversary = Date.new(Date.current.year, hire.month, hire.day)

      # If anniversary hasn't happened yet this year, use last year's
      anniversary > Date.current ? anniversary.prev_year : anniversary
    rescue ArgumentError
      # Handle Feb 29 for non-leap years
      Date.new(Date.current.year, hire.month, hire.day - 1)
    end
  end
end
