# frozen_string_literal: true

FactoryBot.define do
  factory :user, class: "Identity::User" do
    email { Faker::Internet.unique.email }
    password { "password123" }
    first_name { Faker::Name.first_name }
    last_name { Faker::Name.last_name }
    active { true }
    time_zone { "UTC" }
    locale { "en" }

    # Skip the default role assignment callback for test control
    after(:create) do |user|
      # Clear any auto-assigned roles for clean test control
      # Individual traits will re-add specific roles
    end

    trait :inactive do
      active { false }
    end

    trait :with_organization do
      organization { association :organization }
    end

    trait :with_default_role do
      # This trait allows the default employee role to be assigned
      after(:create) do |user|
        employee_role = Identity::Role.where(name: Identity::Role::EMPLOYEE).first
        user.roles << employee_role if employee_role && user.roles.empty?
      end
    end

    trait :admin do
      after(:create) do |user|
        user.roles.clear
        admin_role = Identity::Role.find_by(name: Identity::Role::ADMIN) ||
                     create(:role, :admin)
        user.roles << admin_role
      end
    end

    trait :legal do
      after(:create) do |user|
        user.roles.clear
        legal_role = Identity::Role.find_by(name: Identity::Role::LEGAL) ||
                     create(:role, :legal)
        user.roles << legal_role
      end
    end

    trait :hr do
      after(:create) do |user|
        user.roles.clear
        hr_role = Identity::Role.find_by(name: Identity::Role::HR) ||
                  create(:role, :hr)
        user.roles << hr_role
      end
    end

    trait :employee do
      after(:create) do |user|
        user.roles.clear
        employee_role = Identity::Role.find_by(name: Identity::Role::EMPLOYEE) ||
                        create(:role, :employee)
        user.roles << employee_role
      end
    end

    trait :viewer do
      after(:create) do |user|
        user.roles.clear
        viewer_role = Identity::Role.find_by(name: Identity::Role::VIEWER) ||
                      create(:role, :viewer)
        user.roles << viewer_role
      end
    end
  end
end
