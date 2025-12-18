# frozen_string_literal: true

module Hr
  class EmployeePolicy < ApplicationPolicy
    def index?
      hr_staff? || supervisor?
    end

    def show?
      owner? || hr_staff? || supervisor_of_record?
    end

    def update?
      hr_staff? || admin?
    end

    def show_balance?
      owner? || hr_staff? || supervisor_of_record?
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if user_employee.hr_staff? || user_employee.hr_manager?
          scope.where(organization_id: user.organization_id)
        elsif user_employee.supervisor?
          # Supervisors see their subordinates plus themselves
          scope.or(
            { id: user_employee.id },
            { supervisor_id: user_employee.id }
          )
        else
          scope.where(id: user_employee.id)
        end
      end

      private

      def user_employee
        @user_employee ||= ::Hr::Employee.for_user(user)
      end
    end

    private

    def owner?
      record.id == user_employee&.id
    end

    def hr_staff?
      user_employee&.hr_staff? || user_employee&.hr_manager?
    end

    def supervisor?
      user_employee&.supervisor?
    end

    def supervisor_of_record?
      user_employee&.supervises?(record)
    end

    def admin?
      user&.admin?
    end

    def user_employee
      @user_employee ||= ::Hr::Employee.for_user(user)
    end
  end
end
