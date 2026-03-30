# frozen_string_literal: true

module Templates
  class Template
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable
    include AuditTrackable

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

    # Paragraph context for each variable: { "Nombre Empleado" => ["...paragraph text..."] }
    field :variable_contexts, type: Hash, default: {}

    # Default third party type for this template (provider, client, contractor, partner, other)
    field :default_third_party_type, type: String

    # For certification templates: which certification type this template is for
    # Maps to Hr::EmploymentCertificationRequest::CERTIFICATION_TYPES
    # (employment, salary, position, full, custom)
    field :certification_type, type: String

    # Custom label for certification type (overrides default)
    field :certification_type_label, type: String

    # Company association (stores company UUID)
    field :company_id, type: String

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

    # Versioning: links a new version to the root (v1) template of the family
    field :parent_template_id, type: BSON::ObjectId

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
    index({ parent_template_id: 1 })

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

      if variables.present?
        unassigned = variables.reject { |v| variable_mappings[v].present? }
        if unassigned.any?
          raise InvalidStateError,
            "No se puede activar: #{unassigned.size} variable(s) sin asignar: #{unassigned.join(', ')}"
        end
      end

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
        new_template.parent_template_id = nil
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

    # Creates a new draft version of this template (v+1).
    # The new version shares the same name and copies signatories from the latest
    # version in the family. Original signed documents continue referencing old versions.
    def new_version!
      family_root_id = parent_template_id || id
      latest = ::Templates::Template
        .where(:organization_id => organization_id)
        .any_of({ _id: family_root_id }, { parent_template_id: family_root_id })
        .order(version: :desc)
        .first || self

      next_version = latest.version + 1

      latest.dup.tap do |t|
        t.status = DRAFT
        t.version = next_version
        t.parent_template_id = family_root_id
        t.uuid = nil
        t.file_id = nil
        t.file_name = nil
        t.file_content_type = nil
        t.file_size = nil
        t.preview_file_id = nil
        t.variables = []
        t.variable_mappings = {}
        t.save!

        latest.signatories.each do |sig|
          new_sig = sig.dup
          new_sig.template = t
          new_sig.uuid = nil
          new_sig.save!
        end
      end
    end

    # Returns all templates in the same version family, ordered by version
    def version_family
      family_root_id = parent_template_id || id
      ::Templates::Template
        .where(:organization_id => organization_id)
        .any_of({ _id: family_root_id }, { parent_template_id: family_root_id })
        .order(version: :asc)
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

      result = TemplateParserService.new(content).extract_with_context
      self.variables = result[:variables]
      self.variable_contexts = result[:contexts]

      auto_assign_mappings!
    end

    def extract_pdf_dimensions!
      return unless file_id

      begin
        content = file_content
        return unless content

        if file_name&.end_with?(".docx")
          # Extract dimensions directly from DOCX XML (no conversion needed)
          extract_dimensions_from_docx(content)

          # Only generate PDF preview on Heroku (not on macOS dev where docx-preview is used)
          unless RUBY_PLATFORM.include?("darwin")
            pdf_content = convert_docx_to_pdf_for_dimensions(content)
            store_pdf_preview!(pdf_content) if pdf_content
          end
        elsif file_name&.end_with?(".pdf")
          extract_dimensions_from_pdf(content)
        end

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

    # Extract page dimensions directly from DOCX XML without any conversion
    # Reads the w:pgSz element which contains width/height in TWIPs (1/20th of a point)
    def extract_dimensions_from_docx(docx_content)
      require "zip"
      require "nokogiri"

      io = StringIO.new(docx_content)
      Zip::File.open_buffer(io) do |zipfile|
        doc_entry = zipfile.find_entry("word/document.xml")
        return set_default_dimensions! unless doc_entry

        xml = Nokogiri::XML(doc_entry.get_input_stream.read)
        ns = { "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main" }

        # w:pgSz contains page dimensions in TWIPs (1/20th of a point)
        pg_sz = xml.at_xpath("//w:pgSz", ns)
        if pg_sz
          twips_w = pg_sz["w:w"]&.to_f || 12_240 # Letter default
          twips_h = pg_sz["w:h"]&.to_f || 15_840
          self.pdf_width = (twips_w / 20.0).round(1)
          self.pdf_height = (twips_h / 20.0).round(1)
        else
          set_default_dimensions!
        end

        # Count page breaks for page count estimate
        page_breaks = xml.xpath("//w:br[@w:type='page']", ns).count
        # Also count section breaks (each section can start a new page)
        section_breaks = xml.xpath("//w:sectPr", ns).count
        self.pdf_page_count = [page_breaks + 1, section_breaks].max.clamp(1, 100)

        self.preview_page_height = pdf_height.to_i if pdf_height.present?
      end
    rescue StandardError => e
      Rails.logger.warn "Could not extract DOCX dimensions: #{e.message}"
      set_default_dimensions!
    end

    def extract_dimensions_from_pdf(pdf_content)
      require "combine_pdf"
      pdf = CombinePDF.parse(pdf_content)
      return set_default_dimensions! if pdf.pages.empty?

      first_page = pdf.pages.first
      mediabox = first_page.mediabox
      self.pdf_width = mediabox[2].to_f
      self.pdf_height = mediabox[3].to_f
      self.pdf_page_count = pdf.pages.count
      self.preview_page_height = pdf_height.to_i if pdf_height.present?
    end

    def set_default_dimensions!
      self.pdf_width ||= 612.0
      self.pdf_height ||= 792.0
      self.pdf_page_count ||= 1
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

      docx_temp = Tempfile.new(["template", ".docx"])
      docx_temp.binmode
      docx_temp.write(docx_content)
      docx_temp.close

      begin
        # Priority 1: LibreOffice (best quality, works locally)
        result = convert_dimensions_with_libreoffice(docx_temp.path)
        return result if result

        # Priority 2: Pandoc + wkhtmltopdf (works on Heroku)
        result = convert_dimensions_with_pandoc(docx_temp.path)
        return result if result

        Rails.logger.warn "No PDF conversion method available for dimensions extraction"
        nil
      ensure
        docx_temp.unlink
      end
    end

    def convert_dimensions_with_libreoffice(docx_path)
      soffice_path = find_libreoffice_path
      return nil unless soffice_path

      temp_dir = Dir.mktmpdir
      user_profile = Dir.mktmpdir("lo_profile")

      begin
        env_vars = {
          "HOME" => "/tmp",
          "SAL_DISABLE_SYNCHRONOUS_PRINTER_DETECTION" => "1",
          "SAL_DISABLE_COMPONENTITHREADING" => "1",
          "SAL_USE_VCLPLUGIN" => "svp",
          "DISPLAY" => ""
        }

        # Add Heroku-specific library paths if on Heroku
        if File.exist?("/app/.apt/usr/lib/libreoffice")
          lib_path = "/app/.apt/usr/lib/libreoffice/program:/app/.apt/usr/lib/x86_64-linux-gnu"
          env_vars["LD_LIBRARY_PATH"] = "#{lib_path}:#{ENV['LD_LIBRARY_PATH']}"
          env_vars["URE_BOOTSTRAP"] = "file:///app/.apt/usr/lib/libreoffice/program/fundamentalrc"
          env_vars["FONTCONFIG_PATH"] = "/etc/fonts"
        end

        user_install = "-env:UserInstallation=file://#{user_profile}"
        success = system(env_vars, soffice_path, "--headless", "--nologo",
                         "--nofirststartwizard", "--norestore", user_install,
                         "--convert-to", "pdf", "--outdir", temp_dir, docx_path)

        pdf_files = Dir.glob(File.join(temp_dir, "*.pdf"))
        if success && pdf_files.any?
          Rails.logger.info "LibreOffice conversion successful for dimensions"
          return File.binread(pdf_files.first)
        end

        Rails.logger.warn "LibreOffice conversion failed or produced no output"
        nil
      rescue StandardError => e
        Rails.logger.warn "LibreOffice conversion error: #{e.message}"
        nil
      ensure
        FileUtils.rm_rf(temp_dir)
        FileUtils.rm_rf(user_profile)
      end
    end

    def convert_dimensions_with_pandoc(docx_path)
      pandoc_path = `which pandoc 2>/dev/null`.strip.presence
      return nil unless pandoc_path

      html_file = Tempfile.new(["dimensions", ".html"])
      html_file.close
      media_dir = Dir.mktmpdir("pandoc_media")

      begin
        system(pandoc_path, "-f", "docx", "-t", "html5", "--standalone",
               "--extract-media=#{media_dir}", docx_path, "-o", html_file.path)

        html_content = File.read(html_file.path)
        return nil if html_content.empty?

        # Fix image paths for wkhtmltopdf
        html_content.gsub!(%r{src="#{Regexp.escape(media_dir)}/}, "src=\"file://#{media_dir}/")
        html_content.gsub!(/src="media\//, "src=\"file://#{media_dir}/media/")

        # Strip Pandoc's default CSS and apply document-appropriate styles
        html_content.gsub!(%r{<style>\s*html\s*\{.*?</style>}m, "")

        doc_styles = <<~CSS
          <style>
            html { font-size: 12pt; color: #000; }
            body { margin: 0; padding: 0; max-width: 100%; font-family: 'Arial', 'Helvetica Neue', sans-serif; line-height: 1.4; }
            p { margin: 0.4em 0; }
            strong { font-weight: bold; }
            table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
            td, th { border: 1px solid #999; padding: 5px; }
            th { background-color: #f5f5f5; }
            img { max-width: 100%; height: auto; }
          </style>
        CSS

        styled_html = if html_content.include?("</head>")
                        html_content.sub("</head>", "#{doc_styles}</head>")
                      else
                        "<html><head>#{doc_styles}</head><body>#{html_content}</body></html>"
                      end

        pdf_content = WickedPdf.new.pdf_from_string(
          styled_html,
          page_size: "Letter",
          margin: { top: 15, bottom: 15, left: 20, right: 20 },
          encoding: "UTF-8",
          enable_local_file_access: true
        )

        Rails.logger.info "Pandoc+wkhtmltopdf conversion successful for dimensions (#{pdf_content.bytesize} bytes)"
        pdf_content
      rescue StandardError => e
        Rails.logger.warn "Pandoc conversion error for dimensions: #{e.message}"
        nil
      ensure
        html_file.unlink
        FileUtils.rm_rf(media_dir)
      end
    end

    def find_libreoffice_path
      paths = [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/opt/homebrew/bin/soffice",
        "/usr/local/bin/soffice",
        "/usr/bin/soffice",
        "/app/.apt/usr/bin/soffice"
      ]
      found = paths.find { |p| File.exist?(p) }
      found || `which soffice 2>/dev/null`.strip.presence
    end

    # Auto-assign template variables to system mappings based on name equivalence
    def auto_assign_mappings!
      return if variables.blank?

      # Get all available mappings for this organization
      available_mappings = VariableMapping.for_organization(organization).active.to_a

      variables.each do |variable|
        # Skip if already mapped
        next if variable_mappings[variable].present?

        # Find matching mapping by primary name OR any alias
        matching_mapping = available_mappings.find { |vm| vm.matches_name?(variable) }

        variable_mappings[variable] = matching_mapping.key if matching_mapping
      end

      save if changed?
    end

    # Re-assign all mappings (even existing ones) from system variables.
    # Uses primary name AND aliases for matching. Returns stats hash.
    def reassign_all_mappings!
      return { matched: 0, unmatched: [] } if variables.blank?

      available_mappings = VariableMapping.for_organization(organization).active.to_a
      new_mappings = {}
      unmatched = []

      variables.each do |variable|
        # Match by primary name or any registered alias
        matching_mapping = available_mappings.find { |vm| vm.matches_name?(variable) }

        if matching_mapping
          new_mappings[variable] = matching_mapping.key
        elsif variable_mappings[variable].present?
          # Keep existing custom mapping
          new_mappings[variable] = variable_mappings[variable]
        else
          unmatched << variable
        end
      end

      update!(variable_mappings: new_mappings)
      { matched: variables.length - unmatched.length, unmatched: unmatched }
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
