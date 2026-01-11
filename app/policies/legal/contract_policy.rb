# frozen_string_literal: true

module Legal
  class ContractPolicy < ApplicationPolicy
    def index?
      # Allow all authenticated users - scoping will filter appropriately
      true
    end

    def show?
      admin? || legal_staff? || (manager? && owner_or_approver?) || signatory?
    end

    def create?
      admin? || legal_staff? || manager?
    end

    def validate_template?
      admin? || legal_staff? || manager?
    end

    def update?
      return false unless record.editable?
      admin? || legal_staff? || (manager? && owner?)
    end

    def destroy?
      # Admin can delete any contract (for testing/cleanup purposes)
      return true if admin?
      # Others can only delete drafts they own
      return false unless record.draft?
      legal_staff? && owner?
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
      return false unless record.can_activate?
      admin? || legal_staff?
    end

    def sign_document?
      return false unless record.pending_signatures?
      doc = record.generated_document
      return false unless doc
      doc.can_be_signed_by?(user)
    end

    def terminate?
      return false unless record.active?
      admin? || legal_staff?
    end

    def cancel?
      return false if record.active? || record.expired? || record.terminated?
      admin? || legal_staff? || (manager? && owner?)
    end

    def archive?
      return false unless %w[active expired terminated cancelled].include?(record.status)
      admin?
    end

    def unarchive?
      return false unless record.archived?
      admin?
    end

    def generate_document?
      admin? || legal_staff?
    end

    def download_document?
      admin? || legal_staff? || (manager? && owner_or_approver?) || signatory?
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if admin? || legal_staff?
          scope.where(organization_id: user.organization_id)
        elsif manager?
          # Managers see contracts they created, need to approve, or need to sign
          scope.where(organization_id: user.organization_id).any_of(
            { requested_by_id: user.id },
            { :status => "pending_approval" },
            { :status => "pending_signatures" }
          )
        else
          # Other users only see contracts where they are signatories
          scope.where(organization_id: user.organization_id, status: "pending_signatures")
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

    def signatory?
      doc = record.generated_document
      return false unless doc
      doc.can_be_signed_by?(user)
    end
  end
end
