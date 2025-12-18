# frozen_string_literal: true

module Audit
  # rubocop:disable Metrics/ClassLength
  class AuditEvent
    include Mongoid::Document
    include Mongoid::Timestamps::Created

    # Store in separate collection for performance
    store_in collection: "audit_events"

    # Event identification
    field :uuid, type: String
    field :event_type, type: String
    field :action, type: String

    # Actor information (who performed the action)
    field :actor_id, type: BSON::ObjectId
    field :actor_type, type: String
    field :actor_email, type: String
    field :actor_name, type: String

    # Target information (what was affected)
    field :target_id, type: BSON::ObjectId
    field :target_type, type: String
    field :target_uuid, type: String

    # Organization context
    field :organization_id, type: BSON::ObjectId

    # Change details
    field :change_data, type: Hash, default: {}
    field :previous_values, type: Hash, default: {}
    field :new_values, type: Hash, default: {}

    # Request context
    field :request_id, type: String
    field :ip_address, type: String
    field :user_agent, type: String
    field :session_id, type: String

    # Additional metadata
    field :metadata, type: Hash, default: {}
    field :tags, type: Array, default: []

    # Indexes for efficient querying
    index({ uuid: 1 }, { unique: true })
    index({ event_type: 1 })
    index({ action: 1 })
    index({ actor_id: 1 })
    index({ target_id: 1 })
    index({ target_type: 1 })
    index({ organization_id: 1 })
    index({ created_at: -1 })
    index({ tags: 1 })
    index({ target_type: 1, target_id: 1 })
    index({ actor_id: 1, created_at: -1 })
    index({ organization_id: 1, created_at: -1 })

    # Validations
    validates :uuid, presence: true, uniqueness: true
    validates :event_type, presence: true
    validates :action, presence: true

    # Callbacks
    before_validation :generate_uuid, on: :create
    before_create :capture_request_context
    after_create :ensure_immutable

    # Scopes
    scope :by_event_type, ->(type) { where(event_type: type) }
    scope :by_action, ->(action) { where(action: action) }
    scope :by_actor, ->(actor_id) { where(actor_id: actor_id) }
    scope :by_target, ->(target_type, target_id) { where(target_type: target_type, target_id: target_id) }
    scope :by_organization, ->(org_id) { where(organization_id: org_id) }
    scope :recent, -> { order(created_at: :desc) }
    scope :since, ->(time) { where(:created_at.gte => time) }
    scope :until, ->(time) { where(:created_at.lte => time) }
    scope :tagged, ->(tag) { where(tags: tag) }

    # Event types
    TYPES = {
      identity: "identity",
      content: "content",
      workflow: "workflow",
      system: "system",
      security: "security",
      record: "record", # Records management / retention
      hr: "hr" # Human resources / Intranet
    }.freeze

    # Common actions
    ACTIONS = {
      create: "create",
      read: "read",
      update: "update",
      delete: "delete",
      restore: "restore",
      login: "login",
      logout: "logout",
      permission_change: "permission_change",
      export: "export",
      import: "import"
    }.freeze

    # Document-specific actions
    DOCUMENT_ACTIONS = {
      document_created: "document_created",
      document_updated: "document_updated",
      document_deleted: "document_deleted",
      document_restored: "document_restored",
      document_locked: "document_locked",
      document_unlocked: "document_unlocked",
      document_moved: "document_moved",
      document_status_changed: "document_status_changed",
      version_created: "version_created",
      version_downloaded: "version_downloaded",
      version_viewed: "version_viewed"
    }.freeze

    # Folder-specific actions
    FOLDER_ACTIONS = {
      folder_created: "folder_created",
      folder_updated: "folder_updated",
      folder_deleted: "folder_deleted",
      folder_moved: "folder_moved"
    }.freeze

    # All valid actions combined
    ALL_ACTIONS = ACTIONS.merge(DOCUMENT_ACTIONS).merge(FOLDER_ACTIONS).freeze

    class << self
      def log(event_type:, action:, target: nil, actor: nil, change_data: {}, metadata: {}, tags: [])
        create!(
          event_type: event_type,
          action: action,
          actor_id: actor&.id,
          actor_type: actor&.class&.name,
          actor_email: actor.try(:email),
          actor_name: actor.try(:full_name) || actor.try(:name),
          target_id: target&.id,
          target_type: target&.class&.name,
          target_uuid: target.try(:uuid),
          organization_id: extract_organization_id(actor, target),
          change_data: change_data,
          metadata: metadata,
          tags: Array(tags)
        )
      end

      def log_model_change(record, action, change_data = {})
        actor = Current.user

        create!(
          event_type: event_type_for_model(record),
          action: action,
          actor_id: actor&.id,
          actor_type: actor&.class&.name,
          actor_email: actor.try(:email),
          actor_name: actor.try(:full_name) || actor.try(:name),
          target_id: record.id,
          target_type: record.class.name,
          target_uuid: record.try(:uuid),
          organization_id: extract_organization_id(actor, record),
          change_data: change_data,
          previous_values: change_data.transform_values { |v| v.is_a?(Array) ? v.first : nil },
          new_values: change_data.transform_values { |v| v.is_a?(Array) ? v.last : v }
        )
      end

      # Specialized document audit logging
      def log_document_action(action:, document:, actor: nil, change_data: {}, metadata: {})
        actor ||= Current.user
        log(
          event_type: TYPES[:content],
          action: action,
          target: document,
          actor: actor,
          change_data: change_data,
          metadata: metadata.merge(
            document_title: document.try(:title),
            document_status: document.try(:status)
          ),
          tags: ["document", action]
        )
      end

      # Specialized version audit logging
      def log_version_action(action:, version:, actor: nil, metadata: {})
        actor ||= Current.user
        log(
          event_type: TYPES[:content],
          action: action,
          target: version,
          actor: actor,
          metadata: metadata.merge(
            document_id: version.document_id&.to_s,
            version_number: version.version_number,
            file_name: version.file_name,
            content_type: version.content_type,
            file_size: version.file_size
          ),
          tags: ["version", action]
        )
      end

      # Specialized folder audit logging
      def log_folder_action(action:, folder:, actor: nil, change_data: {}, metadata: {})
        actor ||= Current.user
        log(
          event_type: TYPES[:content],
          action: action,
          target: folder,
          actor: actor,
          change_data: change_data,
          metadata: metadata.merge(
            folder_name: folder.try(:name),
            folder_path: folder.try(:path)
          ),
          tags: ["folder", action]
        )
      end

      # Query methods for audit trail
      def for_document(document)
        where(target_type: "Content::Document", target_id: document.id)
          .or(where("metadata.document_id" => document.id.to_s))
          .recent
      end

      def for_version(version)
        where(target_type: "Content::DocumentVersion", target_id: version.id).recent
      end

      def for_folder(folder)
        where(target_type: "Content::Folder", target_id: folder.id).recent
      end

      def for_user(user)
        where(actor_id: user.id).recent
      end

      private

      def extract_organization_id(actor, target)
        actor.try(:organization_id) || target.try(:organization_id) || Current.organization&.id
      end

      def event_type_for_model(record)
        class_name = record.class.name
        case class_name
        when /\AIdentity::/
          TYPES[:identity]
        when /\AContent::/
          TYPES[:content]
        when /\AWorkflow::/
          TYPES[:workflow]
        when /\AHr::/
          TYPES[:hr]
        when /\ARetention::/
          TYPES[:record]
        else
          # Audit::* and all other models default to system
          TYPES[:system]
        end
      end
    end

    # ============================================
    # IMMUTABILITY ENFORCEMENT (Append-Only Log)
    # ============================================

    # Instance-level immutability

    def save(*)
      return super if new_record?

      raise ImmutableRecordError, "AuditEvent records cannot be modified after creation"
    end

    def save!(*)
      return super if new_record?

      raise ImmutableRecordError, "AuditEvent records cannot be modified after creation"
    end

    def update(*)
      raise ImmutableRecordError, "AuditEvent records cannot be modified after creation"
    end

    def update!(*)
      raise ImmutableRecordError, "AuditEvent records cannot be modified after creation"
    end

    def delete
      raise ImmutableRecordError, "AuditEvent records cannot be deleted"
    end

    def destroy
      raise ImmutableRecordError, "AuditEvent records cannot be deleted"
    end

    def destroy!
      raise ImmutableRecordError, "AuditEvent records cannot be deleted"
    end

    def remove
      raise ImmutableRecordError, "AuditEvent records cannot be deleted"
    end

    # Class-level protection against mass operations
    # These are defined on the class itself, not on Mongoid::Criteria
    def self.delete_all(*)
      raise ImmutableRecordError, "AuditEvent records cannot be deleted in bulk"
    end

    def self.destroy_all(*)
      raise ImmutableRecordError, "AuditEvent records cannot be deleted in bulk"
    end

    def self.update_all(*)
      raise ImmutableRecordError, "AuditEvent records cannot be updated in bulk"
    end

    private

    def generate_uuid
      self.uuid ||= SecureRandom.uuid
    end

    def capture_request_context
      self.request_id ||= Current.request_id
      self.ip_address ||= Current.ip_address
      self.user_agent ||= Current.user_agent
    end

    def ensure_immutable
      readonly!
    end

    class ImmutableRecordError < StandardError; end
  end
  # rubocop:enable Metrics/ClassLength
end
