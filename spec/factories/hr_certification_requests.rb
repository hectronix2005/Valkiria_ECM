# frozen_string_literal: true

FactoryBot.define do
  factory :certification_request, class: "Hr::EmploymentCertificationRequest" do
    association :employee, factory: :hr_employee
    association :organization, factory: :organization
    certification_type { Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT }
    purpose { Hr::EmploymentCertificationRequest::PURPOSE_BANK }
    purpose_details { "Mortgage application" }
    language { "es" }
    status { Hr::EmploymentCertificationRequest::STATUS_PENDING }

    trait :pending do
      status { Hr::EmploymentCertificationRequest::STATUS_PENDING }
    end

    trait :processing do
      status { Hr::EmploymentCertificationRequest::STATUS_PROCESSING }
      processed_at { Time.current }
      association :processed_by, factory: :hr_employee
    end

    trait :completed do
      status { Hr::EmploymentCertificationRequest::STATUS_COMPLETED }
      processed_at { 1.day.ago }
      completed_at { Time.current }
      association :processed_by, factory: :hr_employee
      document_uuid { SecureRandom.uuid }
    end

    trait :rejected do
      status { Hr::EmploymentCertificationRequest::STATUS_REJECTED }
      completed_at { Time.current }
      rejection_reason { "Employment status not verified" }
    end

    trait :cancelled do
      status { Hr::EmploymentCertificationRequest::STATUS_CANCELLED }
    end

    trait :with_salary do
      certification_type { Hr::EmploymentCertificationRequest::TYPE_SALARY }
      include_salary { true }
    end

    trait :full do
      certification_type { Hr::EmploymentCertificationRequest::TYPE_FULL }
      include_salary { true }
      include_start_date { true }
      include_position { true }
      include_department { true }
    end

    trait :for_visa do
      purpose { Hr::EmploymentCertificationRequest::PURPOSE_VISA }
      purpose_details { "Tourist visa application" }
      addressee { "Embassy of Spain" }
    end

    trait :for_rental do
      purpose { Hr::EmploymentCertificationRequest::PURPOSE_RENTAL }
      purpose_details { "Apartment rental application" }
    end

    trait :in_english do
      language { "en" }
    end
  end
end
