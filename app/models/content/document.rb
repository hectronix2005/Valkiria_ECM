# frozen_string_literal: true

module Content
  # rubocop:disable Metrics/ClassLength
  class Document
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable
    include SoftDeletable
    include AuditTrackable

    store_in collection: "content_documents"

    # Status constants
    STATUS_DRAFT = "draft"
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_PUBLISHED = "published"
    STATUS_ARCHIVED = "archived"

    STATUSES = [STATUS_DRAFT, STATUS_PENDING_REVIEW, STATUS_PUBLISHED, STATUS_ARCHIVED].freeze

    # Fields
    field :title, type: String
    field :description, type: String
    field :status, type: String, default: STATUS_DRAFT
    field :document_type, type: String
    field :tags, type: Array, default: []
    field :metadata, type: Hash, default: {}

    # Versioning fields
    field :current_version_number, type: Integer, default: 0
    field :version_count, type: Integer, default: 0

    # Locking for concurrency control
    field :lock_version, type: Integer, default: 0
    field :locked_by_id, type: BSON::ObjectId
    field :locked_at, type: Time

    # Retention status
    field :retention_status, type: String # nil, "archived", "expired"
    field :last_modified_by_id, type: BSON::ObjectId

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ title: 1 })
    index({ status: 1 })
    index({ document_type: 1 })
    index({ tags: 1 })
    index({ folder_id: 1 })
    index({ organization_id: 1 })
    index({ created_by_id: 1 })
    index({ current_version_id: 1 })
    index({ locked_by_id: 1 })
    index({ created_at: -1 })
    # Compound indexes for search optimization
    index({ organization_id: 1, status: 1, created_at: -1 })
    index({ organization_id: 1, folder_id: 1, status: 1 })
    index({ organization_id: 1, tags: 1 })
    index({ retention_status: 1 })

    # Associations
    belongs_to :folder, class_name: "Content::Folder", optional: true, inverse_of: :documents
    belongs_to :organization, class_name: "Identity::Organization", optional: true
    belongs_to :created_by, class_name: "Identity::User", optional: true
    belongs_to :last_modified_by, class_name: "Identity::User", optional: true
    has_one :retention_schedule, class_name: "Retention::RetentionSchedule", inverse_of: :document
    belongs_to :current_version, class_name: "Content::DocumentVersion", optional: true
    has_many :versions, class_name: "Content::DocumentVersion", inverse_of: :document, order: :version_number.desc

    # Validations
    validates :title, presence: true, length: { minimum: 1, maximum: 255 }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validate :folder_belongs_to_same_organization
    validate :legal_hold_prevents_modification, on: :update

    # Audit callbacks - EVERY action must be audited
    after_create :audit_document_created
    after_update :audit_document_updated
    before_destroy :prevent_hard_delete

    # Scopes
    scope :drafts, -> { where(status: STATUS_DRAFT) }
    scope :pending_review, -> { where(status: STATUS_PENDING_REVIEW) }
    scope :published, -> { where(status: STATUS_PUBLISHED) }
    scope :archived, -> { where(status: STATUS_ARCHIVED) }
    scope :not_archived, -> { where(:status.ne => STATUS_ARCHIVED) }
    scope :by_status, ->(status) { where(status: status) }
    scope :by_type, ->(type) { where(document_type: type) }
    scope :by_folder, ->(folder_id) { where(folder_id: folder_id) }
    scope :by_organization, ->(org_id) { where(organization_id: org_id) }
    scope :tagged_with, ->(tag) { where(tags: tag) }
    scope :locked, -> { where(:locked_by_id.ne => nil) }
    scope :unlocked, -> { where(locked_by_id: nil) }
    scope :recent, ->(limit = 10) { order(created_at: :desc).limit(limit) }
    scope :retention_archived, -> { where(retention_status: "archived") }
    scope :retention_expired, -> { where(retention_status: "expired") }

    # Check if document is under legal hold
    def under_legal_hold?
      retention_schedule&.under_legal_hold? || false
    end

    # Check if modification is allowed (respects legal hold)
    def modification_allowed?
      !under_legal_hold?
    end

    # Create new version
    def create_version!(attributes = {})
      check_lock!
      check_legal_hold!

      version_attrs = attributes.merge(
        document: self,
        created_by: attributes[:created_by] || Current.user
      )

      version = Content::DocumentVersion.create!(version_attrs)

      # Update document with new current version - use ID for MongoDB serialization
      update_with_lock!(
        current_version_id: version.id,
        current_version_number: version.version_number,
        version_count: versions.count
      )

      version
    end

    # Optimistic locking update
    def update_with_lock!(attrs)
      current_lock = lock_version

      result = self.class.where(
        _id: id,
        lock_version: current_lock
      ).find_one_and_update(
        { "$set" => attrs.merge(lock_version: current_lock + 1, updated_at: Time.current) },
        return_document: :after
      )

      if result.nil?
        reload
        raise ConcurrencyError, "Document was modified by another process. Please reload and try again."
      end

      # Reload to get updated attributes
      reload
      self
    end

    # Locking methods
    def lock!(user)
      return false if locked? && locked_by_id != user.id

      update_with_lock!(
        locked_by_id: user.id,
        locked_at: Time.current
      )
      audit_lock_event("document_locked", user)
      true
    rescue ConcurrencyError
      false
    end

    def unlock!(user = nil)
      return false unless locked?
      return false if user && locked_by_id != user.id && !user.admin?

      update_with_lock!(
        locked_by_id: nil,
        locked_at: nil
      )
      audit_lock_event("document_unlocked", user)
      true
    rescue ConcurrencyError
      false
    end

    def locked?
      locked_by_id.present?
    end

    def locked_by?(user)
      locked_by_id == user.id
    end

    def locked_by
      return nil unless locked_by_id

      @locked_by ||= Identity::User.find(locked_by_id)
    rescue Mongoid::Errors::DocumentNotFound
      nil
    end

    # Version access
    def latest_version
      current_version || versions.first
    end

    def version(number)
      versions.find_by(version_number: number)
    end

    def version_history
      versions.order(version_number: :asc)
    end

    # Status transitions
    def publish!
      update!(status: STATUS_PUBLISHED)
    end

    def archive!
      update!(status: STATUS_ARCHIVED)
    end

    def submit_for_review!
      update!(status: STATUS_PENDING_REVIEW)
    end

    # rubocop:disable Metrics/PerceivedComplexity
    def move_to_folder!(new_folder)
      return false if new_folder && new_folder.organization_id != organization_id

      old_folder_id = folder_id
      result = update!(folder: new_folder)

      if result
        Audit::AuditEvent.log_document_action(
          action: Audit::AuditEvent::DOCUMENT_ACTIONS[:document_moved],
          document: self,
          change_data: { folder_id: [old_folder_id&.to_s, new_folder&.id&.to_s] },
          metadata: {
            old_folder_path: old_folder_id ? Content::Folder.find(old_folder_id)&.path : nil,
            new_folder_path: new_folder&.path
          }
        )
      end

      result
    end
    # rubocop:enable Metrics/PerceivedComplexity

    # Soft delete with audit trail
    def soft_delete_with_audit!(user = nil)
      user ||= Current.user
      result = soft_delete(user)

      if result
        Audit::AuditEvent.log_document_action(
          action: Audit::AuditEvent::DOCUMENT_ACTIONS[:document_deleted],
          document: self,
          actor: user,
          change_data: { deleted_at: [nil, deleted_at&.iso8601] },
          metadata: { soft_delete: true }
        )
      end

      result
    end

    # Restore with audit trail
    def restore_with_audit!(user = nil)
      user ||= Current.user
      old_deleted_at = deleted_at
      result = restore

      if result
        Audit::AuditEvent.log_document_action(
          action: Audit::AuditEvent::DOCUMENT_ACTIONS[:document_restored],
          document: self,
          actor: user,
          change_data: { deleted_at: [old_deleted_at&.iso8601, nil] },
          metadata: { restored: true }
        )
      end

      result
    end

    # Get complete audit trail for this document
    def audit_trail
      Audit::AuditEvent.for_document(self)
    end

    private

    def check_lock!
      return unless locked?
      return if locked_by_id == Current.user&.id

      raise DocumentLockedError, "Document is locked by another user"
    end

    def check_legal_hold!
      return unless under_legal_hold?

      raise LegalHoldError, "Document is under legal hold and cannot be modified"
    end

    def legal_hold_prevents_modification
      return unless under_legal_hold?
      # Only allow retention_status changes when under hold
      return if [["retention_status"], ["retention_status", "updated_at"]].include?(changes.keys)
      return if changes.keys == ["updated_at"]
      return if changes.empty?

      errors.add(:base, "Document is under legal hold and cannot be modified")
    end

    def folder_belongs_to_same_organization
      return unless folder && organization_id

      return if folder.organization_id == organization_id

      errors.add(:folder, "must belong to the same organization")
    end

    def prevent_hard_delete
      raise HardDeleteNotAllowedError, "Documents cannot be hard deleted. Use soft_delete_with_audit! instead."
    end

    def audit_document_created
      Audit::AuditEvent.log_document_action(
        action: Audit::AuditEvent::DOCUMENT_ACTIONS[:document_created],
        document: self,
        change_data: attributes.except("_id", "updated_at", "created_at"),
        metadata: { initial_status: status }
      )
    end

    def audit_document_updated
      # Use previous_changes since changes is cleared after save
      relevant_changes = previous_changes.except("updated_at", "lock_version", "created_at")
      return if relevant_changes.empty?

      # Detect status change for special logging
      action = if relevant_changes.key?("status")
                 Audit::AuditEvent::DOCUMENT_ACTIONS[:document_status_changed]
               else
                 Audit::AuditEvent::DOCUMENT_ACTIONS[:document_updated]
               end

      Audit::AuditEvent.log_document_action(
        action: action,
        document: self,
        change_data: relevant_changes,
        metadata: build_update_metadata(relevant_changes)
      )
    end

    def audit_lock_event(action, user)
      Audit::AuditEvent.log_document_action(
        action: action,
        document: self,
        actor: user,
        change_data: { locked_by_id: locked_by_id&.to_s, locked_at: locked_at&.iso8601 },
        metadata: { lock_action: action }
      )
    end

    def build_update_metadata(changes)
      metadata = {}
      metadata[:status_transition] = changes["status"] if changes.key?("status")
      metadata[:title_changed] = true if changes.key?("title")
      metadata[:folder_changed] = true if changes.key?("folder_id")
      metadata[:version_updated] = true if changes.key?("current_version_id")
      metadata
    end

    class ConcurrencyError < StandardError; end
    class DocumentLockedError < StandardError; end
    class HardDeleteNotAllowedError < StandardError; end
    class LegalHoldError < StandardError; end
  end
  # rubocop:enable Metrics/ClassLength
end
