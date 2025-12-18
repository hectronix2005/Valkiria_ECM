# frozen_string_literal: true

FactoryBot.define do
  factory :vacation_request, class: "Hr::VacationRequest" do
    association :employee, factory: :hr_employee
    association :organization, factory: :organization
    vacation_type { Hr::VacationRequest::TYPE_VACATION }
    start_date { 1.week.from_now.to_date }
    end_date { 1.week.from_now.to_date + 4.days }
    days_requested { 5.0 }
    reason { "Family vacation" }
    status { Hr::VacationRequest::STATUS_DRAFT }

    trait :pending do
      status { Hr::VacationRequest::STATUS_PENDING }
      submitted_at { Time.current }
      association :approver, factory: :hr_employee
    end

    trait :approved do
      status { Hr::VacationRequest::STATUS_APPROVED }
      submitted_at { 1.day.ago }
      decided_at { Time.current }
      association :approver, factory: :hr_employee
      approved_by_name { "Manager Name" }
    end

    trait :rejected do
      status { Hr::VacationRequest::STATUS_REJECTED }
      submitted_at { 1.day.ago }
      decided_at { Time.current }
      association :approver, factory: :hr_employee
      decision_reason { "Insufficient staffing during requested period" }
    end

    trait :cancelled do
      status { Hr::VacationRequest::STATUS_CANCELLED }
      decided_at { Time.current }
      decision_reason { "Plans changed" }
    end

    trait :sick_leave do
      vacation_type { Hr::VacationRequest::TYPE_SICK }
      start_date { Date.current }
      end_date { Date.current + 2.days }
      days_requested { 3.0 }
      reason { "Medical appointment" }
    end

    trait :personal do
      vacation_type { Hr::VacationRequest::TYPE_PERSONAL }
      days_requested { 1.0 }
      reason { "Personal errand" }
    end

    trait :unpaid do
      vacation_type { Hr::VacationRequest::TYPE_UNPAID }
      reason { "Extended personal leave" }
    end

    trait :short do
      start_date { 1.week.from_now.to_date }
      end_date { 1.week.from_now.to_date }
      days_requested { 1.0 }
    end

    trait :long do
      start_date { 1.month.from_now.to_date }
      end_date { 1.month.from_now.to_date + 13.days }
      days_requested { 10.0 }
    end

    trait :current do
      status { Hr::VacationRequest::STATUS_APPROVED }
      start_date { Date.current - 2.days }
      end_date { Date.current + 2.days }
      days_requested { 5.0 }
      submitted_at { 1.week.ago }
      decided_at { 6.days.ago }
    end

    trait :past do
      status { Hr::VacationRequest::STATUS_APPROVED }
      start_date { 1.month.ago.to_date }
      end_date { 1.month.ago.to_date + 4.days }
      days_requested { 5.0 }
      submitted_at { 2.months.ago }
      decided_at { 2.months.ago + 1.day }
    end

    trait :upcoming do
      status { Hr::VacationRequest::STATUS_APPROVED }
      start_date { 2.weeks.from_now.to_date }
      end_date { 2.weeks.from_now.to_date + 6.days }
      days_requested { 5.0 }
    end
  end
end
