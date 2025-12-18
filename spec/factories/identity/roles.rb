# frozen_string_literal: true

FactoryBot.define do
  factory :role, class: "Identity::Role" do
    sequence(:name) { |n| "role_#{n}" }
    sequence(:display_name) { |n| "Role #{n}" }
    description { "Test role" }
    system_role { false }
    level { 50 }

    trait :admin do
      name { Identity::Role::ADMIN }
      display_name { "Administrator" }
      description { "Full system access" }
      system_role { true }
      level { 100 }
    end

    trait :legal do
      name { Identity::Role::LEGAL }
      display_name { "Legal" }
      description { "Legal documents access" }
      system_role { true }
      level { 80 }
    end

    trait :hr do
      name { Identity::Role::HR }
      display_name { "Human Resources" }
      description { "HR requests access" }
      system_role { true }
      level { 70 }
    end

    trait :employee do
      name { Identity::Role::EMPLOYEE }
      display_name { "Employee" }
      description { "Standard employee access" }
      system_role { true }
      level { 50 }
    end

    trait :viewer do
      name { Identity::Role::VIEWER }
      display_name { "Viewer" }
      description { "Read-only access" }
      system_role { true }
      level { 10 }
    end
  end
end
