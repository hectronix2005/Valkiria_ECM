# frozen_string_literal: true

FactoryBot.define do
  factory :hr_employee, class: "Hr::Employee" do
    association :user, factory: :user
    association :organization, factory: :organization
    sequence(:employee_number) { |n| "EMP-#{n.to_s.rjust(5, "0")}" }
    employment_status { Hr::Employee::STATUS_ACTIVE }
    employment_type { Hr::Employee::TYPE_FULL_TIME }
    hire_date { 1.year.ago.to_date }
    job_title { "Software Engineer" }
    department { "Engineering" }
    vacation_balance_days { 15.0 }
    vacation_accrued_ytd { 0.0 }
    vacation_used_ytd { 0.0 }

    trait :with_supervisor do
      association :supervisor, factory: :hr_employee
    end

    trait :supervisor do
      job_title { "Engineering Manager" }
      after(:create) do |employee|
        create_list(:hr_employee, 2, supervisor: employee, organization: employee.organization)
      end
    end

    trait :hr_staff do
      department { "Human Resources" }
      job_title { "HR Specialist" }
      after(:create) do |employee|
        hr_role = Identity::Role.find_or_create_by!(name: "hr") do |role|
          role.display_name = "HR Staff"
          role.description = "HR Staff"
          role.level = 60
        end
        employee.user.roles << hr_role unless employee.user.roles.include?(hr_role)
      end
    end

    trait :hr_manager do
      department { "Human Resources" }
      job_title { "HR Manager" }
      after(:create) do |employee|
        hr_manager_role = Identity::Role.find_or_create_by!(name: "hr_manager") do |role|
          role.display_name = "HR Manager"
          role.description = "HR Manager"
          role.level = 80
        end
        employee.user.roles << hr_manager_role unless employee.user.roles.include?(hr_manager_role)
      end
    end

    trait :on_leave do
      employment_status { Hr::Employee::STATUS_ON_LEAVE }
    end

    trait :terminated do
      employment_status { Hr::Employee::STATUS_TERMINATED }
      termination_date { 1.week.ago.to_date }
    end

    trait :part_time do
      employment_type { Hr::Employee::TYPE_PART_TIME }
      vacation_balance_days { 7.5 }
    end

    trait :contractor do
      employment_type { Hr::Employee::TYPE_CONTRACTOR }
      vacation_balance_days { 0.0 }
    end

    trait :low_balance do
      vacation_balance_days { 2.0 }
    end

    trait :no_balance do
      vacation_balance_days { 0.0 }
    end

    trait :high_balance do
      vacation_balance_days { 25.0 }
    end
  end
end
