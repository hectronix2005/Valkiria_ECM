# frozen_string_literal: true

FactoryBot.define do
  factory :retention_schedule, class: "Retention::RetentionSchedule" do
    association :document, factory: :content_document
    association :policy, factory: :retention_policy
    association :organization, factory: :organization

    status { Retention::RetentionSchedule::STATUS_ACTIVE }
    retention_start_date { Time.current }
    expiration_date { 1.year.from_now }
    warning_date { 11.months.from_now }

    trait :active do
      status { Retention::RetentionSchedule::STATUS_ACTIVE }
    end

    trait :warning do
      status { Retention::RetentionSchedule::STATUS_WARNING }
      warning_sent_at { Time.current }
      warning_count { 1 }
    end

    trait :pending_action do
      status { Retention::RetentionSchedule::STATUS_PENDING_ACTION }
      expiration_date { 1.day.ago }
    end

    trait :archived do
      status { Retention::RetentionSchedule::STATUS_ARCHIVED }
      action_date { Time.current }
      action_taken { Retention::RetentionPolicy::ACTION_ARCHIVE }
    end

    trait :expired do
      status { Retention::RetentionSchedule::STATUS_EXPIRED }
      action_date { Time.current }
      action_taken { Retention::RetentionPolicy::ACTION_EXPIRE }
    end

    trait :held do
      status { Retention::RetentionSchedule::STATUS_HELD }
    end

    trait :expiring_soon do
      expiration_date { 7.days.from_now }
      warning_date { 1.day.ago }
    end

    trait :past_expiration do
      status { Retention::RetentionSchedule::STATUS_ACTIVE }
      expiration_date { 1.day.ago }
    end

    trait :needs_warning do
      status { Retention::RetentionSchedule::STATUS_ACTIVE }
      warning_date { 1.day.ago }
      expiration_date { 30.days.from_now }
    end
  end
end
