# frozen_string_literal: true

FactoryBot.define do
  factory :workflow_definition, class: "Workflow::WorkflowDefinition" do
    sequence(:name) { |n| "workflow_#{n}" }
    description { "Test workflow definition" }
    version { 1 }
    active { true }
    document_type { "document" }
    initial_state { "draft" }
    states { ["draft", "review", "approved", "rejected"] }
    final_states { ["approved", "rejected"] }
    transitions do
      [
        { "from" => "draft", "to" => "review", "action" => "submit" },
        { "from" => "review", "to" => "approved", "action" => "approve" },
        { "from" => "review", "to" => "rejected", "action" => "reject" },
        { "from" => "review", "to" => "draft", "action" => "request_changes" }
      ]
    end
    steps do
      {
        "draft" => { "assigned_role" => "employee", "sla_hours" => nil },
        "review" => { "assigned_role" => "reviewer", "sla_hours" => 24 },
        "approved" => { "assigned_role" => nil, "sla_hours" => nil },
        "rejected" => { "assigned_role" => nil, "sla_hours" => nil }
      }
    end
    default_sla_hours { 24 }

    association :organization, factory: :organization

    trait :contract_approval do
      name { "contract_approval" }
      description { "Contract approval workflow with legal review" }
      document_type { "contract" }
      initial_state { "draft" }
      states { ["draft", "legal_review", "approved", "rejected"] }
      final_states { ["approved", "rejected"] }
      transitions do
        [
          { "from" => "draft", "to" => "legal_review", "action" => "submit_for_review" },
          { "from" => "legal_review", "to" => "approved", "action" => "approve" },
          { "from" => "legal_review", "to" => "rejected", "action" => "reject" },
          { "from" => "legal_review", "to" => "draft", "action" => "request_changes" },
          { "from" => "rejected", "to" => "draft", "action" => "revise" }
        ]
      end
      steps do
        {
          "draft" => { "assigned_role" => "employee", "sla_hours" => nil, "description" => "Initial draft" },
          "legal_review" => { "assigned_role" => "legal", "sla_hours" => 48, "description" => "Legal review" },
          "approved" => { "assigned_role" => nil, "sla_hours" => nil, "description" => "Approved" },
          "rejected" => { "assigned_role" => nil, "sla_hours" => nil, "description" => "Rejected" }
        }
      end
    end

    trait :inactive do
      active { false }
    end
  end
end
