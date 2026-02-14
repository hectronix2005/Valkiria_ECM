# frozen_string_literal: true

class SettingsPolicy < ApplicationPolicy
  def show?
    admin_access? || has_permission?("settings.read")
  end

  def update?
    admin_access? || has_permission?("settings.manage")
  end
end
