# frozen_string_literal: true

class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user = user
    @record = record
  end

  def index?
    false
  end

  def show?
    false
  end

  def create?
    false
  end

  def new?
    create?
  end

  def update?
    false
  end

  def edit?
    update?
  end

  def destroy?
    false
  end

  class Scope
    attr_reader :user, :scope

    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      raise NotImplementedError, "You must define #resolve in #{self.class}"
    end

    private

    def admin?
      user&.admin?
    end

    def super_admin?
      user&.super_admin?
    end
  end

  private

  def admin?
    user&.admin?
  end

  def super_admin?
    user&.super_admin?
  end

  def owner?
    return false unless record.respond_to?(:created_by_id)

    record.created_by_id == user&.id
  end

  def same_organization?
    return false unless user&.organization_id && record.respond_to?(:organization_id)

    user.organization_id == record.organization_id
  end

  def has_permission?(permission_name)
    return false unless user

    user.has_permission?(permission_name)
  end

  def has_role?(role_name)
    return false unless user

    user.has_role?(role_name)
  end
end
