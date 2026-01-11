# frozen_string_literal: true

module Templates
  class GeneratedDocumentPolicy < ApplicationPolicy
    def index?
      true # All authenticated users can list their documents
    end

    def show?
      owner? || hr_staff? || admin?
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
          # Regular users only see documents they requested
          scope.where(requested_by_id: user.id)
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

    def hr_staff?
      employee = ::Hr::Employee.for_user(user)
      employee&.hr_staff? || employee&.hr_manager?
    end

    def admin?
      user.admin?
    end
  end
end
