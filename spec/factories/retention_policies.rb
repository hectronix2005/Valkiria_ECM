# frozen_string_literal: true

FactoryBot.define do
  factory :retention_policy, class: "Retention::RetentionPolicy" do
    sequence(:name) { |n| "Retention Policy #{n}" }
    description { "Test retention policy" }
    document_type { "contract" }
    retention_period_days { 365 }
    retention_trigger { Retention::RetentionPolicy::TRIGGER_CREATION }
    expiration_action { Retention::RetentionPolicy::ACTION_ARCHIVE }
    warning_days { 30 }
    priority { 0 }
    active { true }

    trait :inactive do
      active { false }
    end

    trait :for_contracts do
      document_type { "contract" }
      retention_period_days { 7 * 365 } # 7 years
      retention_trigger { Retention::RetentionPolicy::TRIGGER_WORKFLOW_COMPLETE }
      warning_days { 90 }
      priority { 10 }
    end

    trait :for_invoices do
      document_type { "invoice" }
      retention_period_days { 5 * 365 } # 5 years
      retention_trigger { Retention::RetentionPolicy::TRIGGER_CREATION }
      warning_days { 60 }
      priority { 10 }
    end

    trait :short_retention do
      retention_period_days { 30 }
      warning_days { 7 }
    end

    trait :expire_action do
      expiration_action { Retention::RetentionPolicy::ACTION_EXPIRE }
    end

    trait :review_action do
      expiration_action { Retention::RetentionPolicy::ACTION_REVIEW }
    end

    trait :with_organization do
      association :organization, factory: :organization
    end
  end
end
