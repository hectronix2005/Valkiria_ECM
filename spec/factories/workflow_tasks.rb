# frozen_string_literal: true

FactoryBot.define do
  factory :workflow_task, class: "Workflow::WorkflowTask" do
    association :instance, factory: :workflow_instance
    association :organization, factory: :organization

    state { "draft" }
    status { Workflow::WorkflowTask::STATUS_PENDING }
    assigned_role { "employee" }
    sla_hours { 24 }
    due_at { 24.hours.from_now }
    priority { 0 }

    after(:build) do |task|
      task.organization ||= task.instance&.organization
    end

    trait :in_progress do
      status { Workflow::WorkflowTask::STATUS_IN_PROGRESS }
      started_at { Time.current }
      association :assignee, factory: :user
    end

    trait :completed do
      status { Workflow::WorkflowTask::STATUS_COMPLETED }
      started_at { 2.hours.ago }
      completed_at { Time.current }
      association :assignee, factory: :user
      association :completed_by, factory: :user
    end

    trait :overdue do
      status { Workflow::WorkflowTask::STATUS_PENDING }
      due_at { 2.hours.ago }
    end

    trait :cancelled do
      status { Workflow::WorkflowTask::STATUS_CANCELLED }
      cancelled_at { Time.current }
    end

    trait :no_sla do
      sla_hours { nil }
      due_at { nil }
    end

    trait :urgent do
      priority { 100 }
      sla_hours { 4 }
      due_at { 4.hours.from_now }
    end

    trait :for_legal_review do
      state { "legal_review" }
      assigned_role { "legal" }
      sla_hours { 48 }
      due_at { 48.hours.from_now }
    end
  end
end
