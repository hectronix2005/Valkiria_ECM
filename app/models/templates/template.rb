# frozen_string_literal: true

module Templates
  class Template
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "templates"

    # Categories for templates
    CATEGORIES = {
      "certification" => "Certificaciones",
      "vacation" => "Vacaciones",
      "contract" => "Contratos",
      "memo" => "Memorandos",
      "letter" => "Cartas",
      "other" => "Otros"
    }.freeze

    # Status values
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    STATUSES = [DRAFT, ACTIVE, ARCHIVED].freeze

    # Fields
    field :name, type: String
    field :description, type: String
    field :category, type: String, default: "other"
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
    index({ category: 1 })
    index({ status: 1 })
    index({ name: 1 })
    index({ organization_id: 1, category: 1, status: 1 })

    # Validations
    validates :name, presence: true, length: { maximum: 200 }
    validates :category, presence: true, inclusion: { in: CATEGORIES.keys }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :file_id, presence: true, if: -> { active? }

    # Scopes
    scope :draft, -> { where(status: DRAFT) }
    scope :active, -> { where(status: ACTIVE) }
    scope :archived, -> { where(status: ARCHIVED) }
    scope :by_category, ->(category) { where(category: category) }
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

    def category_label
      CATEGORIES[category] || category
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
