# frozen_string_literal: true

module Content
  class FolderPolicy < ApplicationPolicy
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

      has_permission?("documents.update") && same_organization?
    end

    def destroy?
      return true if admin?

      has_permission?("documents.delete") && same_organization?
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
