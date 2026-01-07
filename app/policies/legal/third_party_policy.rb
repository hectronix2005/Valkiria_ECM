# frozen_string_literal: true

module Legal
  class ThirdPartyPolicy < ApplicationPolicy
    def index?
      admin? || legal_staff? || manager?
    end

    def show?
      admin? || legal_staff? || manager?
    end

    def create?
      admin? || legal_staff?
    end

    def update?
      admin? || legal_staff?
    end

    def destroy?
      admin?
    end

    class Scope < ApplicationPolicy::Scope
      def resolve
        if admin? || legal_staff? || manager?
          scope.where(organization_id: user.organization_id)
        else
          scope.none
        end
      end
    end

    private

    def legal_staff?
      user.has_role?("legal")
    end

    def manager?
      user.has_role?("manager") || user.has_role?("general_manager") || user.has_role?("ceo")
    end
  end
end
