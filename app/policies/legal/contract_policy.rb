# frozen_string_literal: true

module Legal
  class ContractPolicy < ApplicationPolicy
    def index?
      admin? || legal_staff? || manager?
    end

    def show?
      admin? || legal_staff? || (manager? && owner_or_approver?)
    end

    def create?
      admin? || legal_staff? || manager?
    end

    def update?
      return false unless record.editable?
      admin? || legal_staff? || (manager? && owner?)
    end

    def destroy?
      return false unless record.draft?
      admin? || (legal_staff? && owner?)
    end

    def submit?
      return false unless record.can_submit?
      admin? || legal_staff? || (manager? && owner?)
    end

    def approve?
      return false unless record.pending_approval?
      record.can_approve?(user)
    end

    def reject?
      approve?
    end

    def activate?
      return false unless record.approved?
      admin? || legal_staff?
    end

    def terminate?
      return false unless record.active?
      admin? || legal_staff?
    end

    def cancel?
      return false if record.active? || record.expired? || record.terminated?
      admin? || legal_staff? || (manager? && owner?)
    end

    def generate_document?
      admin? || legal_staff?
    end

    def download_document?
      admin? || legal_staff? || (manager? && owner_or_approver?)
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if admin? || legal_staff?
          scope.where(organization_id: user.organization_id)
        elsif manager?
          # Managers see contracts they created or need to approve
          scope.where(organization_id: user.organization_id).any_of(
            { requested_by_id: user.id },
            { :status => "pending_approval" }
          )
        else
          scope.none
        end
      end

      private

      def manager?
        user.has_role?("manager") || user.has_role?("general_manager") || user.has_role?("ceo")
      end

      def legal_staff?
        user.has_role?("legal")
      end
    end

    private

    def legal_staff?
      user.has_role?("legal")
    end

    def manager?
      user.has_role?("manager") || user.has_role?("general_manager") || user.has_role?("ceo")
    end

    def owner?
      record.requested_by_id == user.id
    end

    def owner_or_approver?
      owner? || record.can_approve?(user)
    end
  end
end
