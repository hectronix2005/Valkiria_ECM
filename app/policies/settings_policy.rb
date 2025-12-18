# frozen_string_literal: true

class SettingsPolicy < ApplicationPolicy
  def show?
    admin? || has_permission?("settings.read")
  end

  def update?
    admin? || has_permission?("settings.manage")
  end
end
