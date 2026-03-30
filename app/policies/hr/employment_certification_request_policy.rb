# frozen_string_literal: true

module Hr
  class EmploymentCertificationRequestPolicy < ApplicationPolicy
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
      owner? && record.pending?
    end

    def cancel?
      return false if record.completed? || record.rejected?

      hr_staff? || owner?
    end

    def generate_document?
      hr_staff? # Only HR can generate/regenerate documents
    end

    def sign_document?
      hr_staff? || admin? # HR and Admin can sign documents
    end

    def destroy?
      admin? # Only admin can delete certifications
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        # /hr/certifications is the "My Requests" endpoint — always scoped to
        # the current employee's own records regardless of admin/employee mode.
        # HR staff manages all requests via /hr/approvals.
        employee = ::Hr::Employee.for_user(user)
        return scope.none unless employee

        scope.where(employee_id: employee.id)
      end
    end

    private

    def owner?
      record.employee_id == user_employee&.id
    end

    def hr_staff?
      user_employee&.hr_staff? || user_employee&.hr_manager?
    end

    def supervisor_of_owner?
      user_employee&.supervises?(record.employee)
    end

    def user_employee
      @user_employee ||= ::Hr::Employee.for_user(user)
    end

    def admin?
      user.has_role?(:admin)
    end
  end
end
