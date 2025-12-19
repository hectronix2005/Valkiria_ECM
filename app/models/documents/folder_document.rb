# frozen_string_literal: true

module Documents
  class FolderDocument
    include Mongoid::Document
    include Mongoid::Timestamps

    # Associations
    belongs_to :folder, class_name: "Documents::Folder"
    belongs_to :document, class_name: "Templates::GeneratedDocument"
    belongs_to :added_by, class_name: "Identity::User"

    # Validations
    validates :document_id, uniqueness: { scope: :folder_id, message: "ya está en esta carpeta" }

    # Indexes
    index({ folder_id: 1, document_id: 1 }, { unique: true })
    index({ document_id: 1 })

    # Callbacks
    after_create :increment_folder_count
    after_destroy :decrement_folder_count

    private

    def increment_folder_count
      folder.inc(documents_count: 1)
    end

    def decrement_folder_count
      folder.inc(documents_count: -1)
    end
  end
end
