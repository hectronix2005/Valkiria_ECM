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
      admin_access?
    end

    def sign?
      # User can sign if they have a pending signature on this document
      record.can_be_signed_by?(user)
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if !employee_mode? && (user.admin_access? || hr_staff?)
          # HR and Admin (non-employee mode): see all documents in the org
          scope.where(organization_id: user.organization_id)
        else
          # Employee mode (or users without elevated roles): only documents
          # where this user IS the employee subject.
          # Intentionally excludes requested_by_id (HR who generated docs for
          # others) and signatures.user_id (HR signature slots on others' docs).
          employee = ::Hr::Employee.for_user(user)
          return scope.none unless employee

          scope.where(organization_id: user.organization_id, employee_id: employee.id)
        end
      end

      private

      def employee_mode?
        Thread.current[:employee_mode] == true
      end

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
      user.admin_access?
    end
  end
end
