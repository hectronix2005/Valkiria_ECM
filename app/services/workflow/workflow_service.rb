# frozen_string_literal: true

module Workflow
  # Main service for workflow operations
  # Provides a high-level API for managing workflows
  #
  class WorkflowService
    attr_reader :user, :organization

    def initialize(user:, organization: nil)
      @user = user
      @organization = organization || user.organization
    end

    # Start a new workflow instance
    #
    # @param definition_name [String] Name of the workflow definition
    # @param document [Content::Document] Document to attach to workflow
    # @param context_data [Hash] Additional context data
    # @return [WorkflowInstance]
    def start_workflow(definition_name, document: nil, context_data: {})
      definition = find_definition(definition_name)

      instance = definition.create_instance!(
        document: document,
        initiated_by: user
      )

      instance.update!(context_data: context_data) if context_data.present?

      instance
    end

    # Get a workflow instance
    #
    # @param instance_id [String] ID of the instance
    # @return [WorkflowInstance]
    def find_instance(instance_id)
      WorkflowInstance.find(instance_id)
    end

    # Transition a workflow to a new state
    #
    # @param instance [WorkflowInstance] The workflow instance
    # @param to_state [String] Target state
    # @param comment [String] Optional comment
    # @return [WorkflowInstance]
    def transition(instance, to_state, comment: nil)
      action = find_action_for_transition(instance, to_state)

      instance.transition_to!(
        to_state,
        actor: user,
        action: action,
        comment: comment
      )
    end

    # Perform a named action on a workflow
    #
    # @param instance [WorkflowInstance] The workflow instance
    # @param action_name [String] Name of the action (e.g., "approve", "reject")
    # @param comment [String] Optional comment
    # @return [WorkflowInstance]
    def perform_action(instance, action_name, comment: nil)
      to_state = find_state_for_action(instance, action_name)

      unless to_state
        raise WorkflowError,
              "Action '#{action_name}' not available from state '#{instance.current_state}'"
      end

      instance.transition_to!(
        to_state,
        actor: user,
        action: action_name,
        comment: comment
      )
    end

    # Get available actions for current state
    #
    # @param instance [WorkflowInstance] The workflow instance
    # @return [Array<Hash>] Available actions
    def available_actions(instance)
      return [] unless instance.active?

      instance.definition.transitions
        .select { |t| t["from"] == instance.current_state }
        .map do |t|
        {
          action: t["action"],
          to_state: t["to"],
          label: action_label(t["action"])
        }
      end
    end

    # Cancel a workflow
    #
    # @param instance [WorkflowInstance] The workflow instance
    # @param reason [String] Cancellation reason
    # @return [WorkflowInstance]
    def cancel(instance, reason: nil)
      instance.cancel!(actor: user, reason: reason)
    end

    # Claim a task for the current user
    #
    # @param task [WorkflowTask] The task to claim
    # @return [WorkflowTask]
    def claim_task(task)
      task.claim!(user)
    end

    # Release a claimed task
    #
    # @param task [WorkflowTask] The task to release
    # @return [WorkflowTask]
    def release_task(task)
      task.release!(user)
    end

    # Get tasks assigned to current user's roles
    #
    # @return [Mongoid::Criteria]
    def my_tasks
      role_names = user.roles.pluck(:name)

      WorkflowTask.active
        .where(organization_id: organization.id)
        .where(:assigned_role.in => role_names)
        .or(assignee_id: user.id)
        .by_priority
    end

    # Get all active workflows for the organization
    #
    # @return [Mongoid::Criteria]
    def active_workflows
      WorkflowInstance.active
        .where(organization_id: organization.id)
        .order(started_at: :desc)
    end

    # Get workflows for a specific document
    #
    # @param document [Content::Document] The document
    # @return [Mongoid::Criteria]
    def workflows_for_document(document)
      WorkflowInstance.where(document_id: document.id)
        .order(started_at: :desc)
    end

    # Get workflow statistics
    #
    # @return [Hash]
    # rubocop:disable Metrics/AbcSize
    def statistics
      {
        active_workflows: WorkflowInstance.active.where(organization_id: organization.id).count,
        completed_today: WorkflowInstance.completed
          .where(organization_id: organization.id)
          .where(:completed_at.gte => Time.current.beginning_of_day)
          .count,
        pending_tasks: WorkflowTask.pending.where(organization_id: organization.id).count,
        overdue_tasks: WorkflowTask.overdue.where(organization_id: organization.id).count,
        my_pending_tasks: my_tasks.pending.count
      }
    end
    # rubocop:enable Metrics/AbcSize

    private

    def find_definition(name)
      definition = WorkflowDefinition.find_latest(name)
      raise WorkflowError, "Workflow definition '#{name}' not found" unless definition

      definition
    end

    def find_action_for_transition(instance, to_state)
      transition = instance.definition.transitions.find do |t|
        t["from"] == instance.current_state && t["to"] == to_state
      end
      transition&.dig("action")
    end

    def find_state_for_action(instance, action_name)
      transition = instance.definition.transitions.find do |t|
        t["from"] == instance.current_state && t["action"] == action_name
      end
      transition&.dig("to")
    end

    def action_label(action_name)
      action_name.to_s.titleize.tr("_", " ")
    end
  end
end
