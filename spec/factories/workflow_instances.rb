# frozen_string_literal: true

FactoryBot.define do
  factory :workflow_instance, class: "Workflow::WorkflowInstance" do
    association :definition, factory: :workflow_definition
    association :organization, factory: :organization
    association :initiated_by, factory: :user

    current_state { definition&.initial_state || "draft" }
    status { Workflow::WorkflowInstance::STATUS_ACTIVE }
    started_at { Time.current }
    state_history { [] }
    context_data { {} }

    transient do
      with_document { false }
    end

    after(:build) do |instance, evaluator|
      instance.organization ||= instance.definition&.organization || instance.initiated_by&.organization

      instance.document = create(:content_document, organization: instance.organization) if evaluator.with_document
    end

    # Skip automatic task creation in factory for testing specific scenarios
    after(:create) do |instance|
      # The model creates initial task via callback, but we can verify it exists
    end

    trait :with_document do
      transient do
        with_document { true }
      end
    end

    trait :completed do
      status { Workflow::WorkflowInstance::STATUS_COMPLETED }
      current_state { "approved" }
      completed_at { Time.current }
      state_history do
        [
          {
            "from" => "draft",
            "to" => "review",
            "action" => "submit",
            "actor_id" => initiated_by&.id&.to_s,
            "at" => 2.hours.ago.iso8601
          },
          {
            "from" => "review",
            "to" => "approved",
            "action" => "approve",
            "actor_id" => initiated_by&.id&.to_s,
            "at" => 1.hour.ago.iso8601
          }
        ]
      end
    end

    trait :cancelled do
      status { Workflow::WorkflowInstance::STATUS_CANCELLED }
      cancelled_at { Time.current }
      cancellation_reason { "Test cancellation" }
    end

    trait :suspended do
      status { Workflow::WorkflowInstance::STATUS_SUSPENDED }
    end

    trait :in_review do
      current_state { "review" }
      state_history do
        [
          {
            "from" => "draft",
            "to" => "review",
            "action" => "submit",
            "actor_id" => initiated_by&.id&.to_s,
            "at" => 1.hour.ago.iso8601
          }
        ]
      end
    end
  end
end
