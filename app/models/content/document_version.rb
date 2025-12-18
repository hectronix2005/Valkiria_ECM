# frozen_string_literal: true

module Content
  class DocumentVersion
    include Mongoid::Document
    include Mongoid::Timestamps::Created
    include UuidIdentifiable

    store_in collection: "document_versions"

    # Fields - all immutable after creation
    field :version_number, type: Integer
    field :file_name, type: String
    field :file_size, type: Integer
    field :content_type, type: String
    field :checksum, type: String
    field :storage_key, type: String
    field :content, type: String # For text content (can be replaced with file storage)

    # Version metadata
    field :change_summary, type: String
    field :metadata, type: Hash, default: {}

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ document_id: 1, version_number: 1 }, { unique: true })
    index({ document_id: 1, created_at: -1 })
    index({ checksum: 1 })
    index({ created_by_id: 1 })

    # Associations
    belongs_to :document, class_name: "Content::Document", inverse_of: :versions
    belongs_to :created_by, class_name: "Identity::User", optional: true

    # Validations
    validates :version_number, presence: true, numericality: { greater_than: 0 }
    validates :version_number, uniqueness: { scope: :document_id }
    validates :file_name, presence: true, length: { maximum: 255 }
    validates :content_type, presence: true
    validates :checksum, presence: true

    # Callbacks
    before_validation :set_version_number, on: :create
    before_validation :calculate_checksum, on: :create
    after_create :log_version_created

    # Immutability enforcement
    def save(*)
      return super if new_record?

      raise ImmutableRecordError, "DocumentVersion records cannot be modified after creation"
    end

    def update(*)
      raise ImmutableRecordError, "DocumentVersion records cannot be modified after creation"
    end

    def update!(*)
      raise ImmutableRecordError, "DocumentVersion records cannot be modified after creation"
    end

    def delete
      raise ImmutableRecordError, "DocumentVersion records cannot be deleted"
    end

    def destroy
      raise ImmutableRecordError, "DocumentVersion records cannot be deleted"
    end

    # Instance methods
    def previous_version
      return nil if version_number == 1

      document.versions.where(version_number: version_number - 1).first
    end

    def next_version
      document.versions.where(version_number: version_number + 1).first
    end

    def latest?
      document.current_version_id == id
    end

    def content_changed_from_previous?
      return true if version_number == 1

      prev = previous_version
      prev.nil? || prev.checksum != checksum
    end

    # Audit methods for tracking access (these don't modify the version, just log)

    # Log a download event for this version
    def log_download!(user = nil)
      user ||= Current.user
      Audit::AuditEvent.log_version_action(
        action: Audit::AuditEvent::DOCUMENT_ACTIONS[:version_downloaded],
        version: self,
        actor: user,
        metadata: {
          download_timestamp: Time.current.iso8601,
          user_ip: Current.ip_address,
          user_agent: Current.user_agent
        }
      )
    end

    # Log a view event for this version
    def log_view!(user = nil)
      user ||= Current.user
      Audit::AuditEvent.log_version_action(
        action: Audit::AuditEvent::DOCUMENT_ACTIONS[:version_viewed],
        version: self,
        actor: user,
        metadata: {
          view_timestamp: Time.current.iso8601
        }
      )
    end

    # Get download count from audit trail
    def download_count
      Audit::AuditEvent.where(
        target_type: "Content::DocumentVersion",
        target_id: id,
        action: Audit::AuditEvent::DOCUMENT_ACTIONS[:version_downloaded]
      ).count
    end

    # Get view count from audit trail
    def view_count
      Audit::AuditEvent.where(
        target_type: "Content::DocumentVersion",
        target_id: id,
        action: Audit::AuditEvent::DOCUMENT_ACTIONS[:version_viewed]
      ).count
    end

    # Get complete audit trail for this version
    def audit_trail
      Audit::AuditEvent.for_version(self)
    end

    private

    def set_version_number
      return if version_number.present?

      max_version = document&.versions&.max(:version_number) || 0
      self.version_number = max_version + 1
    end

    def calculate_checksum
      return if checksum.present?
      return if content.blank? && storage_key.blank?

      content_to_hash = content || storage_key
      self.checksum = Digest::SHA256.hexdigest(content_to_hash)
    end

    def log_version_created
      Audit::AuditEvent.log_version_action(
        action: Audit::AuditEvent::DOCUMENT_ACTIONS[:version_created],
        version: self,
        actor: created_by || Current.user,
        metadata: {
          change_summary: change_summary,
          content_changed: content_changed_from_previous?
        }
      )
    end

    class ImmutableRecordError < StandardError; end
  end
end
