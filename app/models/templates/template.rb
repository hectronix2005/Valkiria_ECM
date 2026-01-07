# frozen_string_literal: true

module Templates
  class Template
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "templates"

    # Modules (which system module this template belongs to)
    MODULES = {
      "hr" => { label: "Recursos Humanos", icon: "users" },
      "legal" => { label: "Gestión Legal", icon: "scale" },
      "admin" => { label: "Administración", icon: "settings" }
    }.freeze

    # Mapping from main_category to default module
    CATEGORY_TO_MODULE = {
      "laboral" => "hr",
      "comercial" => "legal",
      "administrativo" => "admin"
    }.freeze

    # Main categories (top level)
    MAIN_CATEGORIES = {
      "laboral" => "Laboral",
      "comercial" => "Comercial",
      "administrativo" => "Administrativo"
    }.freeze

    # Subcategories for templates (grouped by main category)
    SUBCATEGORIES = {
      "certification" => { label: "Certificaciones", main: "laboral" },
      "vacation" => { label: "Vacaciones", main: "laboral" },
      "contract" => { label: "Contratos", main: "laboral" },
      "termination" => { label: "Terminación", main: "laboral" },
      "memo" => { label: "Memorandos", main: "administrativo" },
      "letter" => { label: "Cartas", main: "administrativo" },
      "policy" => { label: "Políticas", main: "administrativo" },
      "commercial_contract" => { label: "Contratos Comerciales", main: "comercial" },
      "proposal" => { label: "Propuestas", main: "comercial" },
      "agreement" => { label: "Acuerdos", main: "comercial" },
      "nda" => { label: "NDA/Confidencialidad", main: "comercial" },
      "other" => { label: "Otros", main: "administrativo" }
    }.freeze

    # Legacy alias for backward compatibility
    CATEGORIES = SUBCATEGORIES.transform_values { |v| v[:label] }.freeze

    # Status values
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    STATUSES = [DRAFT, ACTIVE, ARCHIVED].freeze

    # Fields
    field :name, type: String
    field :description, type: String
    field :module_type, type: String, default: "hr" # hr, legal, admin
    field :main_category, type: String, default: "laboral"
    field :category, type: String, default: "other" # This is now the subcategory
    field :status, type: String, default: DRAFT
    field :version, type: Integer, default: 1

    # File storage (GridFS file ID)
    field :file_id, type: BSON::ObjectId
    field :file_name, type: String
    field :file_content_type, type: String
    field :file_size, type: Integer

    # Extracted variables from template
    field :variables, type: Array, default: []

    # Variable mappings: { "Nombre Empleado" => "employee.full_name", ... }
    field :variable_mappings, type: Hash, default: {}

    # Associations
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :created_by, class_name: "Identity::User", optional: true
    has_many :signatories, class_name: "Templates::TemplateSignatory", dependent: :destroy
    has_many :generated_documents, class_name: "Templates::GeneratedDocument", dependent: :nullify

    # Indexes
    index({ organization_id: 1 })
    index({ module_type: 1 })
    index({ main_category: 1 })
    index({ category: 1 })
    index({ status: 1 })
    index({ name: 1 })
    index({ organization_id: 1, module_type: 1, main_category: 1, category: 1, status: 1 })

    # Validations
    validates :name, presence: true, length: { maximum: 200 }
    validates :module_type, presence: true, inclusion: { in: MODULES.keys }
    validates :main_category, presence: true, inclusion: { in: MAIN_CATEGORIES.keys }
    validates :category, presence: true, inclusion: { in: SUBCATEGORIES.keys }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :file_id, presence: true, if: -> { active? }

    # Callbacks
    before_validation :infer_module_from_category, if: -> { main_category_changed? && module_type.blank? }

    # Scopes
    scope :draft, -> { where(status: DRAFT) }
    scope :active, -> { where(status: ACTIVE) }
    scope :archived, -> { where(status: ARCHIVED) }
    scope :by_module, ->(mod) { where(module_type: mod) }
    scope :for_hr, -> { where(module_type: "hr") }
    scope :for_legal, -> { where(module_type: "legal") }
    scope :for_admin, -> { where(module_type: "admin") }
    scope :by_main_category, ->(main_cat) { where(main_category: main_cat) }
    scope :by_category, ->(category) { where(category: category) }
    scope :by_subcategory, ->(subcategory) { where(category: subcategory) }
    scope :for_organization, ->(org) { where(organization_id: org.id) }

    # Instance methods
    def draft?
      status == DRAFT
    end

    def active?
      status == ACTIVE
    end

    def archived?
      status == ARCHIVED
    end

    def activate!
      raise InvalidStateError, "Template debe tener archivo adjunto para activar" unless file_id

      update!(status: ACTIVE)
    end

    def archive!
      update!(status: ARCHIVED)
    end

    def reactivate!
      update!(status: ACTIVE)
    end

    def duplicate!
      dup.tap do |new_template|
        new_template.name = "#{name} (copia)"
        new_template.status = DRAFT
        new_template.version = 1
        new_template.uuid = nil
        new_template.save!

        # Duplicate signatories
        signatories.each do |sig|
          new_sig = sig.dup
          new_sig.template = new_template
          new_sig.uuid = nil
          new_sig.save!
        end
      end
    end

    def module_type_label
      MODULES.dig(module_type, :label) || module_type
    end

    def module_type_icon
      MODULES.dig(module_type, :icon) || "file"
    end

    def main_category_label
      MAIN_CATEGORIES[main_category] || main_category
    end

    def category_label
      SUBCATEGORIES.dig(category, :label) || category
    end

    # Alias for clarity
    def subcategory_label
      category_label
    end

    # Infer module_type from main_category
    def infer_module_from_category
      self.module_type = CATEGORY_TO_MODULE[main_category] || "admin"
    end

    # Infer main_category from subcategory if not set
    def infer_main_category!
      return if main_category.present?
      self.main_category = SUBCATEGORIES.dig(category, :main) || "administrativo"
    end

    def required_signatories
      signatories.required
    end

    def optional_signatories
      signatories.optional
    end

    # File handling with GridFS
    def attach_file(io, filename:, content_type:)
      # Ensure we read the IO content
      io.rewind if io.respond_to?(:rewind)
      content = io.read
      io.rewind if io.respond_to?(:rewind)

      # Store in GridFS
      file = Mongoid::GridFs.put(
        StringIO.new(content),
        filename: filename,
        content_type: content_type
      )

      self.file_id = file.id
      self.file_name = filename
      self.file_content_type = content_type
      self.file_size = content.bytesize

      # Extract variables from the uploaded document
      extract_variables! if file_name&.end_with?(".docx")

      save!
    end

    def file_content
      return nil unless file_id

      file = Mongoid::GridFs.get(file_id)
      file.data
    rescue StandardError => e
      Rails.logger.error "Error reading file from GridFS: #{e.message}"
      nil
    end

    def extract_variables!
      return unless file_id

      content = file_content
      return unless content

      # Use TemplateParserService to extract variables
      self.variables = TemplateParserService.new(content).extract_variables

      # Auto-assign mappings from system variables
      auto_assign_mappings!
    end

    # Auto-assign template variables to system mappings based on name equivalence
    def auto_assign_mappings!
      return if variables.blank?

      # Get all available mappings for this organization
      available_mappings = VariableMapping.for_organization(organization).active.to_a

      variables.each do |variable|
        # Skip if already mapped
        next if variable_mappings[variable].present?

        # Find matching system mapping using VariableNormalizer.equivalent?
        matching_mapping = available_mappings.find do |vm|
          VariableNormalizer.equivalent?(variable, vm.name)
        end

        if matching_mapping
          variable_mappings[variable] = matching_mapping.key
        end
      end

      save if changed?
    end

    # Re-assign all mappings (even existing ones) from system variables
    def reassign_all_mappings!
      return if variables.blank?

      available_mappings = VariableMapping.for_organization(organization).active.to_a
      new_mappings = {}

      variables.each do |variable|
        matching_mapping = available_mappings.find do |vm|
          VariableNormalizer.equivalent?(variable, vm.name)
        end

        if matching_mapping
          new_mappings[variable] = matching_mapping.key
        elsif variable_mappings[variable].present?
          # Keep existing custom mapping
          new_mappings[variable] = variable_mappings[variable]
        end
      end

      update!(variable_mappings: new_mappings)
    end

    # Get available variable mappings from database
    def self.available_variable_mappings(organization = nil)
      VariableMapping.to_mapping_hash(organization)
    end

    # Get grouped mappings for UI
    def self.grouped_variable_mappings(organization = nil)
      VariableMapping.grouped_for(organization)
    end

    class InvalidStateError < StandardError; end
  end
end
