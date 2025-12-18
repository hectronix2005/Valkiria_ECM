# frozen_string_literal: true

module Workflow
  # Represents a task within a workflow instance
  # Tracks assignment, SLA, and completion of individual workflow steps
  #
  # Tasks are created when a workflow enters a new state and must be
  # completed to advance the workflow
  #
  # rubocop:disable Metrics/ClassLength
  class WorkflowTask
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "workflow_tasks"

    # Status constants
    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_OVERDUE = "overdue"

    STATUSES = [STATUS_PENDING, STATUS_IN_PROGRESS, STATUS_COMPLETED, STATUS_CANCELLED, STATUS_OVERDUE].freeze

    # Fields
    field :state, type: String # The workflow state this task is for
    field :status, type: String, default: STATUS_PENDING
    field :assigned_role, type: String # Role that can complete this task
    field :sla_hours, type: Integer
    field :due_at, type: Time
    field :started_at, type: Time
    field :completed_at, type: Time
    field :cancelled_at, type: Time
    field :completion_comment, type: String
    field :priority, type: Integer, default: 0 # Higher = more urgent

    # Escalation tracking
    field :escalation_level, type: Integer, default: 0
    field :last_escalated_at, type: Time
    field :escalation_history, type: Array, default: []

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ status: 1 })
    index({ assigned_role: 1 })
    index({ due_at: 1 })
    index({ organization_id: 1, status: 1 })
    index({ instance_id: 1, state: 1 })
    index({ assignee_id: 1, status: 1 })

    # Associations
    belongs_to :instance, class_name: "Workflow::WorkflowInstance", inverse_of: :tasks
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :assignee, class_name: "Identity::User", optional: true
    belongs_to :completed_by, class_name: "Identity::User", optional: true

    # Validations
    validates :state, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }

    # Scopes
    scope :pending, -> { where(status: STATUS_PENDING) }
    scope :in_progress, -> { where(status: STATUS_IN_PROGRESS) }
    scope :completed, -> { where(status: STATUS_COMPLETED) }
    scope :active, -> { where(:status.in => [STATUS_PENDING, STATUS_IN_PROGRESS]) }
    scope :overdue, -> { where(:due_at.lt => Time.current, :status.in => [STATUS_PENDING, STATUS_IN_PROGRESS]) }
    scope :due_soon, ->(hours = 4) { where(:due_at.lte => Time.current + hours.hours, :due_at.gt => Time.current) }
    scope :for_role, ->(role) { where(assigned_role: role) }
    scope :for_user, ->(user) { where(assignee_id: user.id) }
    scope :by_priority, -> { order(priority: :desc, due_at: :asc) }

    # Callbacks
    after_create :schedule_sla_check
    after_create :notify_assigned_role

    # Check if task is pending
    def pending?
      status == STATUS_PENDING
    end

    # Check if task is in progress
    def in_progress?
      status == STATUS_IN_PROGRESS
    end

    # Check if task is completed
    def completed?
      status == STATUS_COMPLETED
    end

    # Check if task is overdue
    def overdue?
      return false if due_at.blank?
      return false if completed? || status == STATUS_CANCELLED

      Time.current > due_at
    end

    # Time remaining until due
    def time_remaining
      return nil if due_at.blank?
      return 0 if overdue?

      due_at - Time.current
    end

    # Time remaining as human readable
    # rubocop:disable Metrics/PerceivedComplexity
    def time_remaining_text
      remaining = time_remaining
      return "Overdue" if remaining.nil? || remaining <= 0

      hours = (remaining / 1.hour).floor
      if hours >= 24
        days = (hours / 24).floor
        "#{days} day#{"s" unless days == 1}"
      elsif hours >= 1
        "#{hours} hour#{"s" unless hours == 1}"
      else
        minutes = (remaining / 1.minute).floor
        "#{minutes} minute#{"s" unless minutes == 1}"
      end
    end
    # rubocop:enable Metrics/PerceivedComplexity

    # Claim the task for a specific user
    def claim!(user)
      raise WorkflowError, "Task is not pending" unless pending?
      raise WorkflowError, "User does not have required role" unless user_has_role?(user)

      self.assignee = user
      self.status = STATUS_IN_PROGRESS
      self.started_at = Time.current
      save!

      record_audit_event("task_claimed", user)

      self
    end

    # Release a claimed task back to the pool
    def release!(user)
      raise WorkflowError, "Task is not in progress" unless in_progress?
      raise WorkflowError, "Only assignee can release task" unless assignee_id == user.id

      self.assignee = nil
      self.status = STATUS_PENDING
      self.started_at = nil
      save!

      record_audit_event("task_released", user)

      self
    end

    # Complete the task
    def complete!(actor, comment = nil)
      raise WorkflowError, "Task cannot be completed" unless can_complete?

      self.status = STATUS_COMPLETED
      self.completed_at = Time.current
      self.completed_by = actor
      self.completion_comment = comment
      save!

      record_audit_event("task_completed", actor)

      self
    end

    # Cancel the task
    def cancel!(actor)
      return if status == STATUS_CANCELLED

      self.status = STATUS_CANCELLED
      self.cancelled_at = Time.current
      save!

      record_audit_event("task_cancelled", actor)

      self
    end

    # Check if task can be completed
    def can_complete?
      pending? || in_progress?
    end

    # Check if user can work on this task
    def user_can_work?(user)
      return false unless can_complete?
      return true if assignee_id == user.id

      pending? && user_has_role?(user)
    end

    # Escalate the task
    def escalate!(reason: nil)
      self.escalation_level += 1
      self.last_escalated_at = Time.current
      self.priority += 10

      escalation_history << {
        "level" => escalation_level,
        "at" => Time.current.iso8601,
        "reason" => reason
      }.compact

      save!

      WorkflowNotificationJob.perform_later(
        "task_escalated",
        id.to_s,
        escalation_level: escalation_level,
        reason: reason
      )

      self
    end

    # Get users who can work on this task
    def eligible_users
      return Identity::User.none if assigned_role.blank?

      organization.users.joins(:roles).where(
        identity_roles: { name: assigned_role }
      )
    end

    # Duration of the task (started to completed or now)
    def duration
      return nil unless started_at

      end_time = completed_at || Time.current
      end_time - started_at
    end

    # Check SLA compliance
    def sla_compliant?
      return true if due_at.blank?

      if completed?
        completed_at <= due_at
      else
        Time.current <= due_at
      end
    end

    private

    def user_has_role?(user)
      return true if assigned_role.blank?

      user.roles.exists?(name: assigned_role)
    end

    # rubocop:disable Metrics/AbcSize, Naming/VariableNumber
    def schedule_sla_check
      return if due_at.blank?

      # Schedule a job to check SLA at the due time
      SlaCheckJob.set(wait_until: due_at).perform_later(id.to_s)

      # Also schedule warning notifications at 75% and 50% of SLA
      return unless sla_hours && sla_hours > 2

      warning_time_75 = created_at + (sla_hours * 0.75).hours
      warning_time_50 = created_at + (sla_hours * 0.5).hours

      SlaWarningJob.set(wait_until: warning_time_75).perform_later(id.to_s, 75)
      SlaWarningJob.set(wait_until: warning_time_50).perform_later(id.to_s, 50) if sla_hours > 8
    end
    # rubocop:enable Metrics/AbcSize, Naming/VariableNumber

    def notify_assigned_role
      WorkflowNotificationJob.perform_later(
        "task_created",
        id.to_s,
        assigned_role: assigned_role,
        state: state
      )
    end

    def record_audit_event(action, actor)
      Audit::AuditEvent.log(
        event_type: Audit::AuditEvent::TYPES[:workflow],
        action: action,
        target: self,
        actor: actor,
        metadata: {
          workflow_instance_id: instance_id.to_s,
          state: state,
          assigned_role: assigned_role
        },
        tags: ["workflow", "task", action]
      )
    end
  end
  # rubocop:enable Metrics/ClassLength
end
