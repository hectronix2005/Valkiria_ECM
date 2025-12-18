# frozen_string_literal: true

module Identity
  class UserPolicy < ApplicationPolicy
    def index?
      admin? || has_permission?("users.read")
    end

    def show?
      admin? || has_permission?("users.read") || user == record
    end

    def create?
      admin? || has_permission?("users.create")
    end

    def update?
      admin? || has_permission?("users.update") || user == record
    end

    def destroy?
      admin? || has_permission?("users.delete")
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if admin?
          scope.all
        elsif user&.has_permission?("users.read")
          scope.where(organization_id: user.organization_id)
        else
          scope.none
        end
      end
    end
  end
end
