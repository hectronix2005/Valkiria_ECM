# frozen_string_literal: true

module Retention
  # Defines retention rules for documents based on type
  # Specifies how long documents should be retained before archiving/expiration
  #
  # Example: Contracts must be retained for 7 years after completion
  #
  class RetentionPolicy
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "retention_policies"

    # Retention action types
    ACTION_ARCHIVE = "archive"
    ACTION_EXPIRE = "expire"
    ACTION_REVIEW = "review"
    ACTION_DESTROY = "destroy"

    ACTIONS = [ACTION_ARCHIVE, ACTION_EXPIRE, ACTION_REVIEW, ACTION_DESTROY].freeze

    # Trigger types - when to start counting retention period
    TRIGGER_CREATION = "creation"
    TRIGGER_LAST_MODIFIED = "last_modified"
    TRIGGER_WORKFLOW_COMPLETE = "workflow_complete"
    TRIGGER_CUSTOM_DATE = "custom_date"

    TRIGGERS = [TRIGGER_CREATION, TRIGGER_LAST_MODIFIED, TRIGGER_WORKFLOW_COMPLETE, TRIGGER_CUSTOM_DATE].freeze

    # Fields
    field :name, type: String
    field :description, type: String
    field :document_type, type: String # Type of document this policy applies to
    field :active, type: Boolean, default: true

    # Retention period configuration
    field :retention_period_days, type: Integer
    field :retention_trigger, type: String, default: TRIGGER_CREATION

    # Action to take when retention period expires
    field :expiration_action, type: String, default: ACTION_ARCHIVE

    # Warning period - days before expiration to send warnings
    field :warning_days, type: Integer, default: 30

    # Priority for policy selection (higher = more specific)
    field :priority, type: Integer, default: 0

    # Custom field for trigger date (if using custom_date trigger)
    field :custom_trigger_field, type: String

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ document_type: 1, active: 1 })
    index({ organization_id: 1, active: 1 })
    index({ priority: -1 })

    # Associations
    belongs_to :organization, class_name: "Identity::Organization", optional: true
    has_many :schedules, class_name: "Retention::RetentionSchedule", inverse_of: :policy

    # Validations
    validates :name, presence: true
    validates :document_type, presence: true
    validates :retention_period_days, presence: true, numericality: { greater_than: 0 }
    validates :retention_trigger, presence: true, inclusion: { in: TRIGGERS }
    validates :expiration_action, presence: true, inclusion: { in: ACTIONS }
    validates :warning_days, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

    # Scopes
    scope :active, -> { where(active: true) }
    scope :for_document_type, ->(type) { where(document_type: type) }
    scope :by_priority, -> { order(priority: :desc) }
    scope :global, -> { where(organization_id: nil) }

    # Calculate expiration date based on document
    def calculate_expiration_date(document)
      trigger_date = determine_trigger_date(document)
      return nil unless trigger_date

      trigger_date + retention_period_days.days
    end

    # Calculate warning date
    def calculate_warning_date(document)
      expiration = calculate_expiration_date(document)
      return nil unless expiration && warning_days&.positive?

      expiration - warning_days.days
    end

    # Human-readable retention period
    def retention_period_text
      if retention_period_days >= 365
        years = retention_period_days / 365
        "#{years} year#{"s" unless years == 1}"
      elsif retention_period_days >= 30
        months = retention_period_days / 30
        "#{months} month#{"s" unless months == 1}"
      else
        "#{retention_period_days} day#{"s" unless retention_period_days == 1}"
      end
    end

    private

    def determine_trigger_date(document)
      case retention_trigger
      when TRIGGER_CREATION
        document.created_at
      when TRIGGER_LAST_MODIFIED
        document.updated_at
      when TRIGGER_WORKFLOW_COMPLETE
        find_workflow_completion_date(document)
      when TRIGGER_CUSTOM_DATE
        document.metadata&.dig(custom_trigger_field)&.to_time
      end
    end

    def find_workflow_completion_date(document)
      # Find the most recent completed workflow for this document
      workflow = Workflow::WorkflowInstance
        .where(document_id: document.id, status: Workflow::WorkflowInstance::STATUS_COMPLETED)
        .order(completed_at: :desc)
        .first

      workflow&.completed_at
    end

    class << self
      # Find the best matching policy for a document
      def find_policy_for(document, organization: nil)
        # First try organization-specific policies
        if organization
          policy = active.for_document_type(document.document_type)
            .where(organization_id: organization.id)
            .by_priority
            .first
          return policy if policy
        end

        # Fall back to global policies
        active.for_document_type(document.document_type)
          .global
          .by_priority
          .first
      end

      # Seed default retention policies
      # rubocop:disable Metrics/MethodLength
      def seed_defaults!
        policies = [
          {
            name: "Contract Retention",
            description: "Contracts must be retained for 7 years after workflow completion",
            document_type: "contract",
            retention_period_days: 7 * 365, # 7 years
            retention_trigger: TRIGGER_WORKFLOW_COMPLETE,
            expiration_action: ACTION_ARCHIVE,
            warning_days: 90,
            priority: 10
          },
          {
            name: "Invoice Retention",
            description: "Invoices must be retained for 5 years from creation",
            document_type: "invoice",
            retention_period_days: 5 * 365, # 5 years
            retention_trigger: TRIGGER_CREATION,
            expiration_action: ACTION_ARCHIVE,
            warning_days: 60,
            priority: 10
          },
          {
            name: "HR Document Retention",
            description: "HR documents retained for 7 years after last modification",
            document_type: "hr_document",
            retention_period_days: 7 * 365,
            retention_trigger: TRIGGER_LAST_MODIFIED,
            expiration_action: ACTION_REVIEW,
            warning_days: 90,
            priority: 10
          },
          {
            name: "General Document Retention",
            description: "Default retention policy for general documents",
            document_type: "general",
            retention_period_days: 3 * 365, # 3 years
            retention_trigger: TRIGGER_CREATION,
            expiration_action: ACTION_ARCHIVE,
            warning_days: 30,
            priority: 0
          }
        ]

        policies.each do |attrs|
          find_or_create_by!(name: attrs[:name]) do |p|
            p.assign_attributes(attrs)
          end
        end
      end
      # rubocop:enable Metrics/MethodLength
    end
  end
end
