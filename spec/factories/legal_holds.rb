# frozen_string_literal: true

FactoryBot.define do
  factory :legal_hold, class: "Retention::LegalHold" do
    sequence(:name) { |n| "Legal Hold #{n}" }
    description { "Test legal hold" }
    hold_type { Retention::LegalHold::TYPE_LITIGATION }
    status { Retention::LegalHold::STATUS_ACTIVE }
    effective_date { Time.current }
    custodian_name { "Legal Department" }
    custodian_email { "legal@example.com" }

    association :schedule, factory: :retention_schedule
    association :organization, factory: :organization
    association :placed_by, factory: :user

    trait :litigation do
      hold_type { Retention::LegalHold::TYPE_LITIGATION }
      sequence(:reference_number) { |n| "LIT-2024-#{n.to_s.rjust(4, "0")}" }
    end

    trait :regulatory do
      hold_type { Retention::LegalHold::TYPE_REGULATORY }
      sequence(:reference_number) { |n| "REG-2024-#{n.to_s.rjust(4, "0")}" }
    end

    trait :audit do
      hold_type { Retention::LegalHold::TYPE_AUDIT }
      sequence(:reference_number) { |n| "AUD-2024-#{n.to_s.rjust(4, "0")}" }
    end

    trait :released do
      status { Retention::LegalHold::STATUS_RELEASED }
      release_date { Time.current }
      release_reason { "Matter resolved" }
    end

    trait :with_expected_release do
      expected_release_date { 6.months.from_now }
    end
  end
end
