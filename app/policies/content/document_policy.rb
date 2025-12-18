# frozen_string_literal: true

module Content
  class DocumentPolicy < ApplicationPolicy
    def index?
      has_permission?("documents.read")
    end

    def show?
      has_permission?("documents.read") && same_organization?
    end

    def create?
      has_permission?("documents.create")
    end

    def update?
      return true if admin?
      return false unless has_permission?("documents.update")
      return false unless same_organization?

      # Check if user can update (owner or has manage permission)
      owner? || has_permission?("documents.manage")
    end

    def destroy?
      return true if admin?
      return false unless has_permission?("documents.delete")
      return false unless same_organization?

      owner? || has_permission?("documents.manage")
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if admin?
          scope.all
        elsif user&.organization_id
          scope.by_organization(user.organization_id)
        else
          scope.none
        end
      end
    end

    private

    def same_organization?
      return true if admin?
      return true unless record.organization_id

      record.organization_id == user&.organization_id
    end
  end
end
