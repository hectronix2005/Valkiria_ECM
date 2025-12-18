# frozen_string_literal: true

module Content
  # rubocop:disable Metrics/ClassLength
  class Folder
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable
    include SoftDeletable
    include AuditTrackable

    store_in collection: "folders"

    # Fields
    field :name, type: String
    field :description, type: String
    field :path, type: String
    field :depth, type: Integer, default: 0
    field :metadata, type: Hash, default: {}

    # Indexes
    index({ uuid: 1 }, { unique: true })
    index({ name: 1 })
    index({ path: 1 }, { unique: true })
    index({ parent_id: 1 })
    index({ organization_id: 1 })
    index({ depth: 1 })
    index({ created_by_id: 1 })

    # Associations
    belongs_to :parent, class_name: "Content::Folder", optional: true, inverse_of: :children
    has_many :children, class_name: "Content::Folder", inverse_of: :parent, dependent: :restrict_with_error
    has_many :documents, class_name: "Content::Document", inverse_of: :folder, dependent: :restrict_with_error
    belongs_to :organization, class_name: "Identity::Organization", optional: true
    belongs_to :created_by, class_name: "Identity::User", optional: true

    # Validations
    validates :name, presence: true, length: { minimum: 1, maximum: 255 }
    validates :name, format: { with: %r{\A[^/\\]+\z}, message: "cannot contain slashes" }
    validates :path, presence: true, uniqueness: { scope: :organization_id }
    validate :parent_not_self
    validate :parent_depth_limit

    # Callbacks
    before_validation :build_path, on: :create
    before_validation :update_path, on: :update, if: :parent_id_changed?
    # Audit callbacks
    after_create :audit_folder_created
    after_update :audit_folder_updated
    before_destroy :prevent_hard_delete
    after_save :update_children_paths, if: :saved_change_to_path?

    # Constants
    MAX_DEPTH = 10

    # Scopes
    scope :root_folders, -> { where(parent_id: nil) }
    scope :by_organization, ->(org_id) { where(organization_id: org_id) }
    scope :by_parent, ->(parent_id) { where(parent_id: parent_id) }
    scope :alphabetical, -> { order(name: :asc) }

    def root?
      parent_id.nil?
    end

    def ancestors
      return [] if root?

      ancestors_list = []
      current = parent
      while current
        ancestors_list.unshift(current)
        current = current.parent
      end
      ancestors_list
    end

    def ancestor_ids
      ancestors.map(&:id)
    end

    def descendants
      all_descendants = []
      children.each do |child|
        all_descendants << child
        all_descendants.concat(child.descendants)
      end
      all_descendants
    end

    def descendant_ids
      descendants.map(&:id)
    end

    def full_path
      path
    end

    # rubocop:disable Metrics/MethodLength, Metrics/PerceivedComplexity, Naming/PredicateMethod
    def move_to(new_parent)
      return false if new_parent == self
      return false if new_parent && descendant_ids.include?(new_parent.id)

      old_parent_id = parent_id
      old_path = path
      self.parent = new_parent

      if save
        Audit::AuditEvent.log_folder_action(
          action: Audit::AuditEvent::FOLDER_ACTIONS[:folder_moved],
          folder: self,
          change_data: {
            parent_id: [old_parent_id&.to_s, new_parent&.id&.to_s],
            path: [old_path, path]
          },
          metadata: {
            old_parent_path: old_parent_id ? Content::Folder.find(old_parent_id)&.path : nil,
            new_parent_path: new_parent&.path
          }
        )
        true
      else
        false
      end
    end
    # rubocop:enable Metrics/MethodLength, Metrics/PerceivedComplexity, Naming/PredicateMethod

    def document_count(include_descendants: false)
      count = documents.count
      if include_descendants
        children.each do |child|
          count += child.document_count(include_descendants: true)
        end
      end
      count
    end

    # Soft delete with audit trail
    def soft_delete_with_audit!(user = nil)
      user ||= Current.user
      result = soft_delete(user)

      if result
        Audit::AuditEvent.log_folder_action(
          action: Audit::AuditEvent::FOLDER_ACTIONS[:folder_deleted],
          folder: self,
          actor: user,
          change_data: { deleted_at: [nil, deleted_at&.iso8601] },
          metadata: { soft_delete: true }
        )
      end

      result
    end

    # Get complete audit trail for this folder
    def audit_trail
      Audit::AuditEvent.for_folder(self)
    end

    private

    def build_path
      self.path = if parent
                    "#{parent.path}/#{name}"
                  else
                    "/#{name}"
                  end
      self.depth = parent ? parent.depth + 1 : 0
    end

    def update_path
      build_path
    end

    def update_children_paths
      children.each do |child|
        child.send(:build_path)
        child.save!
      end
    end

    def parent_not_self
      return unless parent_id.present? && parent_id == id

      errors.add(:parent_id, "cannot be self")
    end

    def parent_depth_limit
      # MAX_DEPTH is the maximum allowed depth value (0-based)
      # A folder at depth MAX_DEPTH-1 cannot have children
      return unless parent && parent.depth >= MAX_DEPTH - 1

      errors.add(:parent_id, "maximum folder depth (#{MAX_DEPTH}) exceeded")
    end

    def prevent_hard_delete
      raise HardDeleteNotAllowedError, "Folders cannot be hard deleted. Use soft_delete_with_audit! instead."
    end

    def audit_folder_created
      Audit::AuditEvent.log_folder_action(
        action: Audit::AuditEvent::FOLDER_ACTIONS[:folder_created],
        folder: self,
        change_data: attributes.except("_id", "updated_at", "created_at"),
        metadata: { initial_depth: depth }
      )
    end

    def audit_folder_updated
      relevant_changes = previous_changes.except("updated_at", "created_at")
      return if relevant_changes.empty?

      Audit::AuditEvent.log_folder_action(
        action: Audit::AuditEvent::FOLDER_ACTIONS[:folder_updated],
        folder: self,
        change_data: relevant_changes,
        metadata: {
          name_changed: relevant_changes.key?("name"),
          path_changed: relevant_changes.key?("path")
        }
      )
    end

    class HardDeleteNotAllowedError < StandardError; end
  end
  # rubocop:enable Metrics/ClassLength
end
