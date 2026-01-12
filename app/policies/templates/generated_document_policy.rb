# frozen_string_literal: true

module Templates
  class GeneratedDocumentPolicy < ApplicationPolicy
    def index?
      true # All authenticated users can list their documents
    end

    def show?
      owner? || can_sign? || employee_document? || hr_staff? || admin?
    end

    def preview?
      show?
    end

    def download?
      show?
    end

    def destroy?
      admin? # Only admins can delete generated documents
    end

    def sign?
      # User can sign if they have a pending signature on this document
      record.can_be_signed_by?(user)
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if user.admin? || hr_staff?
          # HR and Admin can see all documents in the organization
          scope.where(organization_id: user.organization_id)
        else
          # Regular users see documents they:
          # 1. Requested
          # 2. Are the employee on
          # 3. Have a signature on (pending or signed)
          employee = ::Hr::Employee.for_user(user)
          employee_id = employee&.id

          conditions = [{ requested_by_id: user.id }]
          conditions << { employee_id: employee_id } if employee_id
          conditions << { "signatures.user_id" => user.id.to_s }

          scope.where(organization_id: user.organization_id).any_of(*conditions)
        end
      end

      private

      def hr_staff?
        employee = ::Hr::Employee.for_user(user)
        employee&.hr_staff? || employee&.hr_manager?
      end
    end

    private

    def owner?
      record.requested_by_id == user.id
    end

    def can_sign?
      record.signatures.any? { |s| s["user_id"] == user.id.to_s }
    end

    def employee_document?
      employee = ::Hr::Employee.for_user(user)
      employee && record.employee_id == employee.id
    end

    def hr_staff?
      employee = ::Hr::Employee.for_user(user)
      employee&.hr_staff? || employee&.hr_manager?
    end

    def admin?
      user.admin?
    end
  end
end
