# frozen_string_literal: true

module Documents
  class Folder
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    # Fields
    field :name, type: String
    field :description, type: String
    field :color, type: String, default: "#6366f1" # Primary color
    field :icon, type: String, default: "folder"
    field :is_system, type: Boolean, default: false
    field :documents_count, type: Integer, default: 0

    # Associations
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :created_by, class_name: "Identity::User"
    belongs_to :parent, class_name: "Documents::Folder", optional: true
    has_many :subfolders, class_name: "Documents::Folder", inverse_of: :parent, dependent: :destroy
    has_many :folder_documents, class_name: "Documents::FolderDocument", dependent: :destroy

    # Validations
    validates :name, presence: true, length: { maximum: 100 }
    validates :name, uniqueness: { scope: [:organization_id, :parent_id] }
    validates :color, format: { with: /\A#[0-9A-Fa-f]{6}\z/, message: "debe ser un color hexadecimal válido" }, allow_blank: true

    # Indexes
    index({ organization_id: 1, parent_id: 1, name: 1 }, { unique: true })
    index({ organization_id: 1, created_at: -1 })

    # Scopes
    scope :for_organization, ->(org) { where(organization_id: org.id) }
    scope :root_folders, -> { where(parent_id: nil) }
    scope :ordered, -> { order(name: :asc) }

    # Callbacks
    before_destroy :prevent_system_folder_deletion

    # Get full path of folder
    def full_path
      ancestors = []
      current = self
      while current
        ancestors.unshift(current.name)
        current = current.parent
      end
      ancestors.join(" / ")
    end

    # Get all ancestor folders
    def ancestors
      result = []
      current = parent
      while current
        result.unshift(current)
        current = current.parent
      end
      result
    end

    # Get documents in this folder
    def documents
      folder_documents.includes(:document).map(&:document).compact
    end

    # Update documents count
    def update_documents_count!
      update!(documents_count: folder_documents.count)
    end

    private

    def prevent_system_folder_deletion
      if is_system
        errors.add(:base, "No se puede eliminar una carpeta del sistema")
        throw(:abort)
      end
    end
  end
end
