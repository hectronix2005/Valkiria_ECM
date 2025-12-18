# frozen_string_literal: true

FactoryBot.define do
  factory :permission, class: "Identity::Permission" do
    sequence(:name) { |n| "permission_#{n}" }
    resource { "documents" }
    action { "read" }
    description { "Test permission" }

    trait :documents_read do
      name { "documents.read" }
      resource { "documents" }
      action { "read" }
    end

    trait :documents_create do
      name { "documents.create" }
      resource { "documents" }
      action { "create" }
    end

    trait :documents_update do
      name { "documents.update" }
      resource { "documents" }
      action { "update" }
    end

    trait :documents_delete do
      name { "documents.delete" }
      resource { "documents" }
      action { "delete" }
    end

    trait :users_read do
      name { "users.read" }
      resource { "users" }
      action { "read" }
    end

    trait :users_manage do
      name { "users.manage" }
      resource { "users" }
      action { "manage" }
    end

    trait :settings_read do
      name { "settings.read" }
      resource { "settings" }
      action { "read" }
    end

    trait :settings_manage do
      name { "settings.manage" }
      resource { "settings" }
      action { "manage" }
    end
  end
end
