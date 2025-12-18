# frozen_string_literal: true

module Workflow
  # Defines a workflow template that can be instantiated
  # Contains the state machine configuration and step definitions
  #
  # Example: Contract Approval Workflow
  #   states: draft -> legal_review -> approved/rejected
  #
  class WorkflowDefinition
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "workflow_definitions"

    # Fields
    field :name, type: String
    field :description, type: String
    field :version, type: Integer, default: 1
    field :active, type: Boolean, default: true
    field :document_type, type: String # Type of document this workflow applies to

    # State machine configuration
    field :initial_state, type: String
    field :states, type: Array, default: [] # Array of state names
    field :final_states, type: Array, default: [] # Terminal states
    field :transitions, type: Array, default: [] # Allowed transitions

    # Step definitions with role assignments and SLAs
    # Format: { state: "legal_review", assigned_role: "legal", sla_hours: 48, ... }
    field :steps, type: Hash, default: {}

    # Default SLA in hours if not specified per step
    field :default_sla_hours, type: Integer, default: 24

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ name: 1, version: 1 }, { unique: true })
    index({ document_type: 1 })
    index({ active: 1 })

    # Associations
    belongs_to :organization, class_name: "Identity::Organization", optional: true
    has_many :instances, class_name: "Workflow::WorkflowInstance", inverse_of: :definition

    # Validations
    validates :name, presence: true
    validates :initial_state, presence: true
    validates :states, presence: true
    validate :initial_state_in_states
    validate :final_states_in_states
    validate :transitions_valid

    # Scopes
    scope :active, -> { where(active: true) }
    scope :for_document_type, ->(type) { where(document_type: type) }
    scope :latest_versions, -> { where(active: true).order(version: :desc) }

    # Check if a transition is allowed
    def transition_allowed?(from_state, to_state)
      transitions.any? do |t|
        t["from"] == from_state && t["to"] == to_state
      end
    end

    # Get available transitions from a state
    def available_transitions(from_state)
      transitions.select { |t| t["from"] == from_state }.pluck("to")
    end

    # Get step configuration for a state
    def step_for(state)
      steps[state] || {}
    end

    # Get assigned role for a state
    def assigned_role_for(state)
      step_for(state)["assigned_role"]
    end

    # Get SLA hours for a state
    def sla_hours_for(state)
      step_for(state)["sla_hours"] || default_sla_hours
    end

    # Check if state is final
    def final_state?(state)
      final_states.include?(state)
    end

    # Create a new instance of this workflow
    def create_instance!(document:, initiated_by:)
      WorkflowInstance.create!(
        definition: self,
        document: document,
        organization: organization || document.organization,
        current_state: initial_state,
        initiated_by: initiated_by,
        started_at: Time.current
      )
    end

    # Create a new version of this definition
    def create_new_version!
      new_def = dup
      new_def.uuid = nil # Clear UUID so a new one is generated
      new_def.version = version + 1
      new_def.save!

      # Deactivate old version
      update!(active: false)

      new_def
    end

    private

    def initial_state_in_states
      return if states.include?(initial_state)

      errors.add(:initial_state, "must be one of the defined states")
    end

    def final_states_in_states
      invalid = final_states - states
      return if invalid.empty?

      errors.add(:final_states, "contains invalid states: #{invalid.join(", ")}")
    end

    def transitions_valid
      transitions.each do |t|
        unless t["from"].present? && t["to"].present?
          errors.add(:transitions, "must have 'from' and 'to' states")
          next
        end

        unless states.include?(t["from"]) && states.include?(t["to"])
          errors.add(:transitions, "contains invalid states in transition: #{t["from"]} -> #{t["to"]}")
        end
      end
    end

    class << self
      # Find the latest active version of a workflow by name
      def find_latest(name)
        active.where(name: name).order(version: :desc).first
      end

      # Seed the contract approval workflow
      # rubocop:disable Metrics/MethodLength, Metrics/BlockLength
      def seed_contract_approval!
        find_or_create_by!(name: "contract_approval", version: 1) do |w|
          w.description = "Standard contract approval workflow with legal review"
          w.document_type = "contract"
          w.initial_state = "draft"
          w.states = ["draft", "legal_review", "approved", "rejected"]
          w.final_states = ["approved", "rejected"]
          w.transitions = [
            { "from" => "draft", "to" => "legal_review", "action" => "submit_for_review" },
            { "from" => "legal_review", "to" => "approved", "action" => "approve" },
            { "from" => "legal_review", "to" => "rejected", "action" => "reject" },
            { "from" => "legal_review", "to" => "draft", "action" => "request_changes" },
            { "from" => "rejected", "to" => "draft", "action" => "revise" }
          ]
          w.steps = {
            "draft" => {
              "assigned_role" => "employee",
              "sla_hours" => nil, # No SLA for draft
              "description" => "Initial draft creation"
            },
            "legal_review" => {
              "assigned_role" => "legal",
              "sla_hours" => 48,
              "description" => "Legal team review and approval"
            },
            "approved" => {
              "assigned_role" => nil,
              "sla_hours" => nil,
              "description" => "Contract approved"
            },
            "rejected" => {
              "assigned_role" => nil,
              "sla_hours" => nil,
              "description" => "Contract rejected"
            }
          }
          w.default_sla_hours = 24
        end
      end
      # rubocop:enable Metrics/MethodLength, Metrics/BlockLength
    end
  end
end
