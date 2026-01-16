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

    # PDF preview file (generated from Word for preview on servers without LibreOffice)
    field :preview_file_id, type: BSON::ObjectId

    # Extracted variables from template
    field :variables, type: Array, default: []

    # Variable mappings: { "Nombre Empleado" => "employee.full_name", ... }
    field :variable_mappings, type: Hash, default: {}

    # Default third party type for this template (provider, client, contractor, partner, other)
    field :default_third_party_type, type: String

    # For certification templates: which certification type this template is for
    # Maps to Hr::EmploymentCertificationRequest::CERTIFICATION_TYPES
    # (employment, salary, position, full, custom)
    field :certification_type, type: String

    # Preview settings for signature positioning
    field :preview_scale, type: Float, default: 0.7
    field :preview_page_height, type: Integer, default: 792  # Letter size height

    # Actual PDF dimensions (extracted from uploaded file)
    field :pdf_width, type: Float
    field :pdf_height, type: Float
    field :pdf_page_count, type: Integer, default: 1

    # Signature workflow options
    # When true, signatories must sign in order (by position)
    # Each signatory can only sign after all previous signatories have signed
    field :sequential_signing, type: Boolean, default: true

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
    index({ organization_id: 1, category: 1, certification_type: 1, status: 1 })

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
    scope :for_certification_type, ->(cert_type) { where(certification_type: cert_type) }

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

      # Extract PDF dimensions after saving (need to convert docx to PDF first if needed)
      extract_pdf_dimensions!

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

    def extract_pdf_dimensions!
      return unless file_id

      begin
        content = file_content
        return unless content

        # Get PDF content - either directly or by converting docx
        pdf_content = if file_name&.end_with?(".pdf")
                        content
                      elsif file_name&.end_with?(".docx")
                        convert_docx_to_pdf_for_dimensions(content)
                      end

        return unless pdf_content

        # Store the PDF preview in GridFS for servers without LibreOffice
        if file_name&.end_with?(".docx")
          store_pdf_preview!(pdf_content)
        end

        require "combine_pdf"
        pdf = CombinePDF.parse(pdf_content)
        return if pdf.pages.empty?

        first_page = pdf.pages.first
        mediabox = first_page.mediabox

        self.pdf_width = mediabox[2].to_f
        self.pdf_height = mediabox[3].to_f
        self.pdf_page_count = pdf.pages.count

        # Also update preview_page_height to match actual PDF
        self.preview_page_height = pdf_height.to_i if pdf_height.present?

        Rails.logger.info "Extracted PDF dimensions: #{pdf_width}x#{pdf_height}, #{pdf_page_count} pages"
      rescue StandardError => e
        Rails.logger.warn "Could not extract PDF dimensions: #{e.message}"
        Rails.logger.warn e.backtrace.first(3).join("\n")
        # Set default Letter size if extraction fails
        self.pdf_width ||= 612.0
        self.pdf_height ||= 792.0
        self.pdf_page_count ||= 1
      end
    end

    def store_pdf_preview!(pdf_content)
      return unless pdf_content

      # Delete old preview if exists
      if preview_file_id
        begin
          Mongoid::GridFs.delete(preview_file_id)
        rescue StandardError
          nil
        end
      end

      # Store new PDF preview
      preview_filename = file_name&.sub(/\.docx$/i, ".pdf") || "preview.pdf"
      file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: preview_filename,
        content_type: "application/pdf"
      )

      self.preview_file_id = file.id
      Rails.logger.info "Stored PDF preview: #{preview_filename} (#{pdf_content.bytesize} bytes)"
    end

    def preview_content
      return nil unless preview_file_id

      file = Mongoid::GridFs.get(preview_file_id)
      file.data
    rescue Mongoid::Errors::DocumentNotFound
      nil
    end

    def convert_docx_to_pdf_for_dimensions(docx_content)
      require "tempfile"
      require "fileutils"

      # Write DOCX to temp file
      docx_temp = Tempfile.new(["template", ".docx"])
      docx_temp.binmode
      docx_temp.write(docx_content)
      docx_temp.close

      temp_dir = Dir.mktmpdir

      begin
        # Find LibreOffice
        soffice_path = `which soffice`.strip
        soffice_path = "/opt/homebrew/bin/soffice" if soffice_path.empty? && File.exist?("/opt/homebrew/bin/soffice")
        soffice_path = "/usr/bin/soffice" if soffice_path.empty? && File.exist?("/usr/bin/soffice")

        unless File.exist?(soffice_path.to_s)
          Rails.logger.warn "LibreOffice not found for PDF conversion"
          return nil
        end

        # Convert to PDF
        system(soffice_path, "--headless", "--convert-to", "pdf", "--outdir", temp_dir, docx_temp.path)

        pdf_path = File.join(temp_dir, File.basename(docx_temp.path).sub(".docx", ".pdf"))

        return nil unless File.exist?(pdf_path)

        File.binread(pdf_path)
      ensure
        docx_temp.unlink
        FileUtils.rm_rf(temp_dir)
      end
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

    # Get required third party fields based on template variables
    # Returns array of field info: [{ key: "business_name", label: "Razón Social", required: true }, ...]
    def required_third_party_fields
      return [] if variables.blank?

      # Map of variable keys to third party fields
      variable_to_field_map = {
        "third_party.display_name" => { field: "business_name", label: "Razón Social/Nombre", person_type: nil },
        "third_party.business_name" => { field: "business_name", label: "Razón Social", person_type: "juridical" },
        "third_party.trade_name" => { field: "trade_name", label: "Nombre Comercial", person_type: nil },
        "third_party.first_name" => { field: "first_name", label: "Nombre", person_type: "natural" },
        "third_party.last_name" => { field: "last_name", label: "Apellido", person_type: "natural" },
        "third_party.identification_number" => { field: "identification_number", label: "Número de Identificación", person_type: nil },
        "third_party.identification_type" => { field: "identification_type", label: "Tipo de Identificación", person_type: nil },
        "third_party.full_identification" => { field: "identification_number", label: "Identificación Completa", person_type: nil },
        "third_party.verification_digit" => { field: "verification_digit", label: "Dígito de Verificación", person_type: "juridical" },
        "third_party.email" => { field: "email", label: "Correo Electrónico", person_type: nil },
        "third_party.phone" => { field: "phone", label: "Teléfono", person_type: nil },
        "third_party.mobile" => { field: "mobile", label: "Celular", person_type: nil },
        "third_party.address" => { field: "address", label: "Dirección", person_type: nil },
        "third_party.city" => { field: "city", label: "Ciudad", person_type: nil },
        "third_party.state" => { field: "state", label: "Departamento/Estado", person_type: nil },
        "third_party.country" => { field: "country", label: "País", person_type: nil },
        "third_party.legal_rep_name" => { field: "legal_rep_name", label: "Nombre Representante Legal", person_type: "juridical" },
        "third_party.legal_rep_id" => { field: "legal_rep_id_number", label: "Cédula Representante Legal", person_type: "juridical" },
        "third_party.legal_rep_id_number" => { field: "legal_rep_id_number", label: "Cédula Representante Legal", person_type: "juridical" },
        "third_party.legal_rep_id_type" => { field: "legal_rep_id_type", label: "Tipo ID Representante Legal", person_type: "juridical" },
        "third_party.legal_rep_id_city" => { field: "legal_rep_id_city", label: "Ciudad Expedición Cédula Rep. Legal", person_type: "juridical" },
        "third_party.legal_rep_email" => { field: "legal_rep_email", label: "Email Representante Legal", person_type: "juridical" },
        "third_party.legal_rep_phone" => { field: "legal_rep_phone", label: "Teléfono Representante Legal", person_type: "juridical" },
        "third_party.bank_name" => { field: "bank_name", label: "Banco", person_type: nil },
        "third_party.bank_account_type" => { field: "bank_account_type", label: "Tipo de Cuenta", person_type: nil },
        "third_party.bank_account_number" => { field: "bank_account_number", label: "Número de Cuenta", person_type: nil },
        "third_party.tax_regime" => { field: "tax_regime", label: "Régimen Tributario", person_type: nil },
        "third_party.industry" => { field: "industry", label: "Industria/Sector", person_type: nil },
        "third_party.website" => { field: "website", label: "Sitio Web", person_type: nil }
      }

      required_fields = []
      variables.each do |variable|
        mapping_key = variable_mappings[variable]
        next unless mapping_key&.start_with?("third_party.")

        field_info = variable_to_field_map[mapping_key]
        next unless field_info

        # Avoid duplicates
        next if required_fields.any? { |f| f[:field] == field_info[:field] }

        required_fields << {
          field: field_info[:field],
          label: field_info[:label],
          variable: variable,
          person_type: field_info[:person_type],
          required: true
        }
      end

      required_fields
    end

    # Check if template uses third party variables
    def uses_third_party_variables?
      return false if variable_mappings.blank?
      variable_mappings.values.any? { |v| v&.start_with?("third_party.") }
    end

    # Get suggested person_type based on required fields
    def suggested_person_type
      fields = required_third_party_fields
      has_juridical = fields.any? { |f| f[:person_type] == "juridical" }
      has_natural = fields.any? { |f| f[:person_type] == "natural" }

      return "juridical" if has_juridical && !has_natural
      return "natural" if has_natural && !has_juridical
      nil # Both or neither - let user choose
    end

    class InvalidStateError < StandardError; end
  end
end
