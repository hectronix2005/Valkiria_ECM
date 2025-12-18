# frozen_string_literal: true

FactoryBot.define do
  factory :content_document, class: "Content::Document" do
    sequence(:title) { |n| "Document #{n}" }
    description { Faker::Lorem.paragraph }
    status { Content::Document::STATUS_DRAFT }
    document_type { "general" }
    tags { [] }

    trait :draft do
      status { Content::Document::STATUS_DRAFT }
    end

    trait :pending_review do
      status { Content::Document::STATUS_PENDING_REVIEW }
    end

    trait :published do
      status { Content::Document::STATUS_PUBLISHED }
    end

    trait :archived do
      status { Content::Document::STATUS_ARCHIVED }
    end

    trait :with_organization do
      organization { association :organization }
    end

    trait :with_creator do
      created_by { association :user }
    end

    trait :with_folder do
      folder { association :content_folder }
    end

    trait :locked do
      locked_by_id { BSON::ObjectId.new }
      locked_at { Time.current }
    end

    trait :with_version do
      after(:create) do |document|
        create(:document_version, document: document)
      end
    end

    trait :with_versions do
      transient do
        version_count { 3 }
      end

      after(:create) do |document, evaluator|
        evaluator.version_count.times do
          create(:document_version, document: document)
        end
      end
    end
  end
end
