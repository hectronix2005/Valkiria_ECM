# frozen_string_literal: true

module Workflow
  # Represents a running instance of a workflow
  # Tracks the current state, history, and progress through the workflow
  #
  # Example: A specific contract going through the approval workflow
  #
  # rubocop:disable Metrics/ClassLength
  class WorkflowInstance
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "workflow_instances"

    # Status constants
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_SUSPENDED = "suspended"

    STATUSES = [STATUS_ACTIVE, STATUS_COMPLETED, STATUS_CANCELLED, STATUS_SUSPENDED].freeze

    # Fields
    field :current_state, type: String
    field :status, type: String, default: STATUS_ACTIVE
    field :started_at, type: Time
    field :completed_at, type: Time
    field :cancelled_at, type: Time
    field :cancellation_reason, type: String

    # State history for audit trail
    # Format: [{ from: "draft", to: "review", action: "submit", actor_id: "...", at: Time, comment: "..." }]
    field :state_history, type: Array, default: []

    # Custom data associated with this instance
    field :context_data, type: Hash, default: {}

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ status: 1 })
    index({ current_state: 1 })
    index({ organization_id: 1, status: 1 })
    index({ document_id: 1 })
    index({ started_at: -1 })

    # Associations
    belongs_to :definition, class_name: "Workflow::WorkflowDefinition", inverse_of: :instances
    belongs_to :document, class_name: "Content::Document", optional: true
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :initiated_by, class_name: "Identity::User"
    has_many :tasks, class_name: "Workflow::WorkflowTask", inverse_of: :instance, dependent: :destroy

    # Validations
    validates :current_state, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }
    validate :current_state_valid

    # Scopes
    scope :active, -> { where(status: STATUS_ACTIVE) }
    scope :completed, -> { where(status: STATUS_COMPLETED) }
    scope :cancelled, -> { where(status: STATUS_CANCELLED) }
    scope :suspended, -> { where(status: STATUS_SUSPENDED) }
    scope :for_document, ->(doc) { where(document_id: doc.is_a?(BSON::ObjectId) ? doc : doc.id) }
    scope :in_state, ->(state) { where(current_state: state) }

    # Callbacks
    after_create :create_initial_task
    after_create :record_workflow_started

    # Check if workflow is active
    def active?
      status == STATUS_ACTIVE
    end

    # Check if workflow is completed
    def completed?
      status == STATUS_COMPLETED
    end

    # Check if workflow is in a final state
    def in_final_state?
      definition.final_state?(current_state)
    end

    # Get available transitions from current state
    def available_transitions
      definition.available_transitions(current_state)
    end

    # Check if a transition is allowed
    def can_transition_to?(to_state)
      return false unless active?

      definition.transition_allowed?(current_state, to_state)
    end

    # Perform a state transition
    # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
    def transition_to!(to_state, actor:, action: nil, comment: nil)
      raise WorkflowError, "Workflow is not active" unless active?
      raise WorkflowError, "Transition not allowed: #{current_state} -> #{to_state}" unless can_transition_to?(to_state)

      from_state = current_state

      # Complete the task for the current (from) state BEFORE changing state
      complete_task_for_state!(from_state, actor, comment)

      # Record transition in history
      state_history << {
        "from" => from_state,
        "to" => to_state,
        "action" => action || find_action_for_transition(from_state, to_state),
        "actor_id" => actor.id.to_s,
        "actor_name" => actor.full_name,
        "at" => Time.current.iso8601,
        "comment" => comment
      }.compact

      # Update current state
      self.current_state = to_state

      # Check if we've reached a final state
      if definition.final_state?(to_state)
        self.status = STATUS_COMPLETED
        self.completed_at = Time.current
      else
        # Create task for next state
        create_task_for_state!(to_state)
      end

      save!

      # Fire notification job
      notify_transition(from_state, to_state, actor)

      self
    end
    # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

    # Cancel the workflow
    def cancel!(actor:, reason: nil)
      raise WorkflowError, "Workflow is not active" unless active?

      self.status = STATUS_CANCELLED
      self.cancelled_at = Time.current
      self.cancellation_reason = reason

      state_history << {
        "from" => current_state,
        "to" => "cancelled",
        "action" => "cancel",
        "actor_id" => actor.id.to_s,
        "actor_name" => actor.full_name,
        "at" => Time.current.iso8601,
        "comment" => reason
      }.compact

      # Cancel any active tasks (pending or in_progress)
      # rubocop:disable Rails/FindEach
      Workflow::WorkflowTask.active.where(instance_id: id).each { |task| task.cancel!(actor) }
      # rubocop:enable Rails/FindEach

      save!

      notify_cancellation(actor, reason)

      self
    end

    # Suspend the workflow
    def suspend!(actor:, reason: nil)
      raise WorkflowError, "Workflow is not active" unless active?

      self.status = STATUS_SUSPENDED

      state_history << {
        "from" => current_state,
        "to" => current_state,
        "action" => "suspend",
        "actor_id" => actor.id.to_s,
        "actor_name" => actor.full_name,
        "at" => Time.current.iso8601,
        "comment" => reason
      }.compact

      save!
      self
    end

    # Resume a suspended workflow
    def resume!(actor:)
      raise WorkflowError, "Workflow is not suspended" unless status == STATUS_SUSPENDED

      self.status = STATUS_ACTIVE

      state_history << {
        "from" => current_state,
        "to" => current_state,
        "action" => "resume",
        "actor_id" => actor.id.to_s,
        "actor_name" => actor.full_name,
        "at" => Time.current.iso8601
      }

      save!
      self
    end

    # Get the current active task (pending or in progress)
    def current_task
      tasks.active.where(state: current_state).first
    end

    # Get step configuration for current state
    def current_step
      definition.step_for(current_state)
    end

    # Get assigned role for current state
    def current_assigned_role
      definition.assigned_role_for(current_state)
    end

    # Duration of the workflow so far
    def duration
      end_time = completed_at || cancelled_at || Time.current
      end_time - started_at
    end

    # Duration in a specific state
    def time_in_state(state)
      entries = state_history.select { |h| h["to"] == state }
      exits = state_history.select { |h| h["from"] == state }

      total = 0
      entries.each_with_index do |entry, i|
        exit_record = exits[i]
        entry_time = Time.zone.parse(entry["at"])
        exit_time = exit_record ? Time.zone.parse(exit_record["at"]) : Time.current
        total += (exit_time - entry_time)
      end

      total
    end

    private

    def current_state_valid
      return if definition.blank?
      return if definition.states.include?(current_state)

      errors.add(:current_state, "is not a valid state for this workflow")
    end

    def create_initial_task
      create_task_for_state!(current_state)
    end

    def create_task_for_state!(state)
      step = definition.step_for(state)
      sla_hours = definition.sla_hours_for(state)

      tasks.create!(
        state: state,
        assigned_role: step["assigned_role"],
        organization: organization,
        due_at: sla_hours ? Time.current + sla_hours.hours : nil,
        sla_hours: sla_hours
      )
    end

    def complete_task_for_state!(state, actor, comment)
      task = tasks.active.where(state: state).first
      task&.complete!(actor, comment)
    end

    def find_action_for_transition(from, to)
      transition = definition.transitions.find { |t| t["from"] == from && t["to"] == to }
      transition&.dig("action")
    end

    def record_workflow_started
      Audit::AuditEvent.log(
        event_type: Audit::AuditEvent::TYPES[:workflow],
        action: "workflow_started",
        target: self,
        actor: initiated_by,
        metadata: {
          workflow_name: definition.name,
          initial_state: current_state,
          document_id: document_id&.to_s
        },
        tags: ["workflow", "started"]
      )
    end

    def notify_transition(from_state, to_state, actor)
      WorkflowNotificationJob.perform_later(
        "transition",
        id.to_s,
        from_state: from_state,
        to_state: to_state,
        actor_id: actor.id.to_s
      )
    end

    def notify_cancellation(actor, reason)
      WorkflowNotificationJob.perform_later(
        "cancelled",
        id.to_s,
        actor_id: actor.id.to_s,
        reason: reason
      )
    end
  end
  # rubocop:enable Metrics/ClassLength

  # Custom workflow error
  class WorkflowError < StandardError; end
end
