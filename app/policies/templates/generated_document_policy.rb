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
          # HR and Admin can see all documents in the organization
          scope.where(organization_id: user.organization_id)
        else
          # Employee mode or regular users: only see their own documents
          # 1. They are the employee on the document (subject of the document)
          # 2. They have a signature on it (pending or signed)
          # NOTE: requested_by_id is intentionally excluded — HR staff who
          # generate documents for others would otherwise see those docs in
          # employee mode.
          employee = ::Hr::Employee.for_user(user)
          employee_id = employee&.id

          conditions = []
          conditions << { employee_id: employee_id } if employee_id
          conditions << { "signatures.user_id" => user.id.to_s }

          # If no employee record exists, fall back to requested_by_id so the
          # user can still see documents they personally requested for themselves.
          conditions << { requested_by_id: user.id } if conditions.empty?

          scope.where(organization_id: user.organization_id).any_of(*conditions)
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
