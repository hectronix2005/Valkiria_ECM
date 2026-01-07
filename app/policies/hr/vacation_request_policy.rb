# frozen_string_literal: true

module Hr
  class VacationRequestPolicy < ApplicationPolicy
    def index?
      true # All authenticated users can list their own
    end

    def show?
      owner? || hr_staff? || supervisor_of_owner?
    end

    def create?
      true # All authenticated employees can create
    end

    def update?
      owner? && record.draft?
    end

    def submit?
      owner? && record.draft?
    end

    def cancel?
      return false if record.rejected?

      hr_manager? || (owner? && can_employee_cancel?)
    end

    def destroy?
      # Admin/HR can delete any request, owner can delete their own (with restrictions in controller)
      admin? || hr_manager? || owner?
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if user_employee.hr_staff? || user_employee.hr_manager?
          scope.where(organization_id: user.organization_id)
        else
          scope.where(employee_id: user_employee.id)
        end
      end

      private

      def user_employee
        @user_employee ||= ::Hr::Employee.for_user(user)
      end
    end

    private

    def owner?
      record.employee_id == user_employee&.id
    end

    def hr_staff?
      user_employee&.hr_staff? || user_employee&.hr_manager?
    end

    def hr_manager?
      user_employee&.hr_manager?
    end

    def supervisor_of_owner?
      user_employee&.supervises?(record.employee)
    end

    def can_employee_cancel?
      record.draft? || record.pending? || (record.approved? && record.start_date > Date.current)
    end

    def user_employee
      @user_employee ||= ::Hr::Employee.for_user(user)
    end
  end
end
