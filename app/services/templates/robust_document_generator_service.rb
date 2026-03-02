# frozen_string_literal: true

require "zip"
require "nokogiri"

module Templates
  # Robust document generator that handles fragmented Word XML runs
  # and preserves formatting when replacing variables
  class RobustDocumentGeneratorService
    attr_reader :template, :context, :variable_values, :replacement_log

    WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    VARIABLE_PATTERN = /\{\{([^}]+)\}\}/

    def initialize(template, context)
      @template = template
      @context = context
      @variable_values = {}
      @replacement_log = []
    end

    # Generate a document from template
    # @param skip_pdf [Boolean] when true, skip synchronous PDF conversion and enqueue background job instead
    def generate!(skip_pdf: false)
      validate_template!
      resolve_variables!
      validate_required_variables!
      log_variables_to_replace
      generate_document!(skip_pdf: skip_pdf)
    end

    # Validate variables without generating - returns hash with missing info
    def validate_variables
      validate_template!
      resolve_variables!
      find_missing_variables
    end

    private

    def validate_template!
      raise GenerationError, "Template no activo" unless template.active?
      raise GenerationError, "Template sin archivo" unless template.file_id
    end

    def resolve_variables!
      resolver = VariableResolverService.new(context)
      @variable_values = resolver.resolve_for_template(template)
    end

    def validate_required_variables!
      missing = find_missing_variables
      return if missing[:variables].empty?

      error_message = build_missing_variables_error(missing)
      raise MissingVariablesError.new(error_message, missing)
    end

    def find_missing_variables
      missing_vars = []

      template.variables.each do |var_name|
        path = template.variable_mappings[var_name]
        value = @variable_values[var_name]

        # Variable sin mapeo
        if path.nil? || path.empty?
          missing_vars << {
            variable: var_name,
            path: nil,
            reason: "sin_mapeo",
            source: nil,
            field: nil
          }
          next
        end

        # Variable con valor vacío o nulo
        if value.nil? || value.to_s.strip.empty?
          parts = path.split(".")
          source = parts.first
          field = parts[1..].join(".")

          missing_vars << {
            variable: var_name,
            path: path,
            reason: "sin_valor",
            source: source,
            field: field,
            field_label: humanize_field(field)
          }
        end
      end

      {
        variables: missing_vars,
        by_source: group_by_source(missing_vars),
        employee_id: context[:employee]&.uuid,
        employee_name: context[:employee]&.full_name
      }
    end

    def group_by_source(missing_vars)
      missing_vars.group_by { |v| v[:source] }.transform_values do |vars|
        vars.map { |v| { variable: v[:variable], field: v[:field], field_label: v[:field_label] } }
      end
    end

    def humanize_field(field)
      translations = {
        "full_name" => "Nombre Completo",
        "identification_number" => "Número de Identificación",
        "identification_type" => "Tipo de Documento",
        "job_title" => "Cargo",
        "department" => "Departamento",
        "hire_date" => "Fecha de Ingreso",
        "salary" => "Salario",
        "food_allowance" => "Auxilio de Alimentación",
        "transport_allowance" => "Auxilio de Transporte",
        "contract_type" => "Tipo de Contrato",
        "contract_start_date" => "Fecha Inicio Contrato",
        "contract_end_date" => "Fecha Fin Contrato",
        "address" => "Dirección",
        "phone" => "Teléfono",
        "email" => "Correo Electrónico",
        "place_of_birth" => "Lugar de Nacimiento",
        "nationality" => "Nacionalidad",
        "date_of_birth" => "Fecha de Nacimiento",
        "name" => "Nombre",
        "tax_id" => "NIT",
        "nit" => "NIT",
        "city" => "Ciudad"
      }
      translations[field] || field.humanize
    end

    def build_missing_variables_error(missing)
      vars = missing[:variables]

      by_source = vars.group_by { |v| v[:source] }

      messages = []

      if by_source["employee"]&.any?
        fields = by_source["employee"].map { |v| v[:field_label] || v[:field] }.join(", ")
        messages << "Datos del empleado faltantes: #{fields}"
      end

      if by_source["organization"]&.any?
        fields = by_source["organization"].map { |v| v[:field_label] || v[:field] }.join(", ")
        messages << "Datos de la organización faltantes: #{fields}"
      end

      if by_source["third_party"]&.any?
        fields = by_source["third_party"].map { |v| v[:field_label] || v[:field] }.join(", ")
        messages << "Datos del tercero faltantes: #{fields}"
      end

      if by_source["contract"]&.any?
        fields = by_source["contract"].map { |v| v[:field_label] || v[:field] }.join(", ")
        messages << "Datos del contrato faltantes: #{fields}"
      end

      if by_source[nil]&.any?
        vars_list = by_source[nil].map { |v| v[:variable] }.join(", ")
        messages << "Variables sin mapeo: #{vars_list}"
      end

      if by_source["custom"]&.any?
        vars_list = by_source["custom"].map { |v| v[:variable] }.join(", ")
        messages << "Variables personalizadas sin valor: #{vars_list}"
      end

      messages.join(". ")
    end

    def log_variables_to_replace
      Rails.logger.info "=== Document Generation: Variables to Replace ==="
      variable_values.each do |name, value|
        Rails.logger.info "  {{#{name}}} => #{value.inspect}"
      end
      Rails.logger.info "================================================="
    end

    def generate_document!(skip_pdf: false)
      template_content = template.file_content
      raise GenerationError, "No se pudo leer el archivo del template" unless template_content

      # Create temp files
      input_file = Tempfile.new(["template", ".docx"])
      input_file.binmode
      input_file.write(template_content)
      input_file.close

      output_file = Tempfile.new(["output", ".docx"])
      output_file.close

      begin
        # Process the DOCX file (replace variables)
        process_docx(input_file.path, output_file.path)

        # Log replacement results
        log_replacement_results

        # Read the processed DOCX content
        docx_content = File.binread(output_file.path)

        # Validate processed DOCX is not empty (can happen with ZIP processing issues)
        if docx_content.blank?
          ErrorLoggingService.log_service_event(
            "Processed DOCX is empty - possible template processing error",
            service: "Templates::RobustDocumentGeneratorService",
            severity: "error",
            metadata: { template_id: template&.id&.to_s }
          )
          raise GenerationError, "El DOCX procesado está vacío. Posible error en el procesamiento del template."
        end

        # DOCX-first strategy: save the DOCX immediately so the document is available
        # even if PDF conversion fails or times out (Gotenberg cold start, Heroku H12).
        # The frontend renders DOCX files via docx-preview when PDF isn't available.
        generated_doc = create_generated_document_docx(docx_content)

        # When skip_pdf is true, skip synchronous PDF conversion entirely.
        # The DOCX is already saved and viewable; enqueue a background job for PDF.
        if skip_pdf
          Rails.logger.info "skip_pdf: true — skipping synchronous PDF conversion, enqueuing background job"
          enqueue_pdf_retry(generated_doc)
          return generated_doc
        end

        # Try to convert to PDF (may be slow due to Gotenberg cold start)
        conversion_result = convert_to_pdf(output_file.path)

        if conversion_result.is_a?(Hash) && conversion_result[:format] == :docx
          # macOS development: DOCX is already stored, nothing more to do
          generated_doc
        elsif conversion_result
          # PDF conversion successful - upgrade the document from DOCX to PDF
          upgrade_document_to_pdf!(generated_doc, conversion_result)
        else
          # PDF conversion failed - DOCX is already available for viewing.
          # Enqueue background retry for PDF generation.
          Rails.logger.warn "PDF conversion failed. DOCX already stored for immediate viewing."
          enqueue_pdf_retry(generated_doc)
          generated_doc
        end
      ensure
        input_file.unlink
        output_file.unlink
      end
    end

    # Upgrade an existing DOCX document to PDF after successful Gotenberg conversion
    def upgrade_document_to_pdf!(generated_doc, pdf_content)
      file_name = generated_doc.file_name.to_s.sub(/\.docx\z/i, ".pdf")

      pdf_file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: file_name,
        content_type: "application/pdf"
      )

      generated_doc.update!(
        draft_file_id: pdf_file.id,
        original_draft_file_id: pdf_file.id,
        file_name: file_name,
        name: file_name,
        pdf_generation_status: "completed"
      )

      generated_doc
    end

    def enqueue_pdf_retry(generated_doc)
      # Ensure the DOCX is also stored in docx_file_id for the retry job
      unless generated_doc.docx_file_id.present?
        generated_doc.update!(docx_file_id: generated_doc.draft_file_id)
      end
      generated_doc.update!(pdf_generation_status: "pending") unless generated_doc.pdf_generation_status == "pending"

      GotenbergPdfRetryJob.perform_later(generated_doc.id.to_s)
      Rails.logger.info "Enqueued GotenbergPdfRetryJob for document #{generated_doc.uuid}"
    rescue StandardError => e
      Rails.logger.warn "Could not enqueue GotenbergPdfRetryJob: #{e.class} - #{e.message}"
    end

    def process_docx(input_path, output_path)
      # Copy input to output first
      FileUtils.cp(input_path, output_path)

      Zip::File.open(output_path) do |zipfile|
        # Process main document
        process_xml_part(zipfile, "word/document.xml")

        # Process headers
        zipfile.glob("word/header*.xml").each do |entry|
          process_xml_part(zipfile, entry.name)
        end

        # Process footers
        zipfile.glob("word/footer*.xml").each do |entry|
          process_xml_part(zipfile, entry.name)
        end
      end
    end

    def process_xml_part(zipfile, entry_name)
      entry = zipfile.find_entry(entry_name)
      return unless entry

      xml_content = entry.get_input_stream.read
      xml_content = xml_content.force_encoding("UTF-8") unless xml_content.encoding == Encoding::UTF_8

      # Strategy 1: Try raw string replacement first (preserves 100% of formatting)
      modified_content = try_raw_string_replacement(xml_content)

      if modified_content
        # Raw replacement succeeded for all variables - write back without any XML parsing
        zipfile.get_output_stream(entry_name) { |f| f.write(modified_content) }
      else
        # Strategy 2: Fall back to Nokogiri for fragmented variables spanning multiple runs
        # Clear partial log entries from the raw attempt since Nokogiri will re-process everything
        @replacement_log.clear
        doc = Nokogiri::XML(xml_content)

        doc.xpath("//w:p", "w" => WORD_NAMESPACE).each do |paragraph|
          process_paragraph(paragraph)
        end

        # Remove empty <w:r> elements left by fragmented variable replacement.
        # These have formatting properties but no text, and docx-preview may render
        # them as extra whitespace.
        remove_empty_runs(doc)

        # Serialize back to XML, preserving the original XML declaration
        serialized = doc.to_xml(save_with: Nokogiri::XML::Node::SaveOptions::AS_XML |
                                           Nokogiri::XML::Node::SaveOptions::NO_DECLARATION)
        # Preserve original XML declaration (Nokogiri may alter standalone="yes" etc.)
        original_declaration = xml_content[/\A<\?xml[^?]*\?>\s*/]
        output = original_declaration ? "#{original_declaration.rstrip}\n#{serialized}" : serialized

        zipfile.get_output_stream(entry_name) { |f| f.write(output) }
      end
    end

    # Try to replace all variables using raw string operations (no XML parsing)
    # Returns modified content if all variables were replaced, nil if fragmented variables exist
    def try_raw_string_replacement(xml_content)
      content = xml_content.dup

      # Find all variables present in the raw XML
      variables_in_xml = content.scan(VARIABLE_PATTERN).flatten
      return content if variables_in_xml.empty? # No variables, return as-is

      # Check if all variables appear as complete strings (not fragmented across XML tags)
      has_fragmented = false
      variables_in_xml.uniq.each do |var_name|
        pattern = "{{#{var_name}}}"
        replacement = find_variable_value(var_name)

        if replacement.nil?
          # If the captured "variable name" contains XML tags, it's a fragmented variable
          # spanning multiple Word runs — fall back to Nokogiri which handles cross-run replacement
          if var_name.include?("</w:t>") || var_name.include?("<w:r")
            has_fragmented = true
            break
          end
          @replacement_log << { variable: var_name, status: "not_found", reason: "No mapping found" }
          next
        end

        # Check if the variable appears inside a single <w:t> tag (not fragmented)
        # A fragmented variable would have XML tags breaking it up: {{Var</w:t>...</w:t>iable}}
        if content.include?(pattern)
          # Escape XML special characters in the replacement value
          safe_replacement = replacement.to_s
                                        .gsub("&", "&amp;")
                                        .gsub("<", "&lt;")
                                        .gsub(">", "&gt;")
          content = content.gsub(pattern, safe_replacement)
          @replacement_log << { variable: var_name, status: "replaced", value: replacement.to_s }
        else
          # Variable is fragmented across multiple runs - need Nokogiri
          has_fragmented = true
          break
        end
      end

      has_fragmented ? nil : content
    end

    def process_paragraph(paragraph)
      # Get all text runs in this paragraph
      runs = paragraph.xpath(".//w:r", "w" => WORD_NAMESPACE)
      return if runs.empty?

      # Collect all text content to find variables
      full_text = runs.map { |r| get_run_text(r) }.join

      # Find all variables in the combined text
      variables_found = full_text.scan(VARIABLE_PATTERN).flatten

      return if variables_found.empty?

      # For each variable found, we need to handle the replacement
      # This is complex because the variable might span multiple runs
      variables_found.each do |var_name|
        pattern = "{{#{var_name}}}"

        # Find the matching variable in variable_values using normalized comparison
        replacement = find_variable_value(var_name)

        if replacement.nil?
          @replacement_log << { variable: var_name, status: "not_found", reason: "No mapping found" }
          next
        end

        # Try to replace in the consolidated text of the paragraph
        replace_variable_in_paragraph(paragraph, pattern, replacement.to_s)
        @replacement_log << { variable: var_name, status: "replaced", value: replacement.to_s }
      end
    end

    # Find variable value using normalized comparison
    # This allows matching "NOMBRE DEL TRABAJADOR" with "Nombre del Trabajador"
    def find_variable_value(var_name)
      # First try exact match
      return variable_values[var_name] if variable_values.key?(var_name)

      # Then try normalized comparison
      normalized_var = normalize_for_comparison(var_name)

      variable_values.each do |key, value|
        return value if normalize_for_comparison(key) == normalized_var
      end

      nil
    end

    # Normalize a string for comparison (lowercase, no accents)
    def normalize_for_comparison(str)
      # Remove accents and convert to lowercase
      # Force UTF-8 encoding since DOCX XML content may be read as ASCII-8BIT
      str.to_s
         .encode("UTF-8", invalid: :replace, undef: :replace, replace: "")
         .unicode_normalize(:nfd)
         .gsub(/[\u0300-\u036f]/, "")
         .downcase
         .strip
    end

    def get_run_text(run)
      run.xpath(".//w:t", "w" => WORD_NAMESPACE).map(&:text).join
    end

    def replace_variable_in_paragraph(paragraph, pattern, replacement)
      runs = paragraph.xpath(".//w:r", "w" => WORD_NAMESPACE)
      return if runs.empty?

      # Strategy 1: Try simple replacement in each run
      runs.each do |run|
        text_nodes = run.xpath(".//w:t", "w" => WORD_NAMESPACE)
        text_nodes.each do |text_node|
          if text_node.text.include?(pattern)
            text_node.content = text_node.text.gsub(pattern, replacement)
            return true
          end
        end
      end

      # Strategy 2: Handle fragmented variables across runs
      # Collect text from all runs and find the variable position
      full_text = ""
      run_map = [] # [{run:, text_node:, start:, end:}]

      runs.each do |run|
        text_nodes = run.xpath(".//w:t", "w" => WORD_NAMESPACE)
        text_nodes.each do |text_node|
          start_pos = full_text.length
          full_text += text_node.text
          end_pos = full_text.length
          run_map << { run: run, text_node: text_node, start: start_pos, end: end_pos }
        end
      end

      # Find the variable in the full text
      var_start = full_text.index(pattern)
      return false unless var_start

      var_end = var_start + pattern.length

      # Find which runs contain the variable
      affected_nodes = run_map.select do |entry|
        # Node overlaps with variable position
        entry[:start] < var_end && entry[:end] > var_start
      end

      return false if affected_nodes.empty?

      if affected_nodes.length == 1
        # Variable is in a single node - simple replacement
        node = affected_nodes.first[:text_node]
        node.content = node.text.gsub(pattern, replacement)
      else
        # Variable spans multiple nodes
        # Put the replacement in the first node and clear the rest
        first_node = affected_nodes.first
        first_node_text = first_node[:text_node].text

        # Calculate what part of the pattern is in the first node
        pattern_start_in_node = [var_start - first_node[:start], 0].max
        pattern_end_in_node = [var_end - first_node[:start], first_node_text.length].min

        # Replace in first node
        new_text = first_node_text[0...pattern_start_in_node] + replacement
        remaining_text = first_node_text[pattern_end_in_node..]
        first_node[:text_node].content = new_text + (remaining_text || "")

        # Clear the parts of the variable from subsequent nodes
        affected_nodes[1..].each do |entry|
          node_text = entry[:text_node].text
          node_start = entry[:start]

          # Calculate what part of this node is part of the variable
          clear_start = [var_start - node_start, 0].max
          clear_end = [var_end - node_start, node_text.length].min

          # Keep text before and after the variable part
          new_content = node_text[0...clear_start].to_s + node_text[clear_end..].to_s
          entry[:text_node].content = new_content
        end
      end

      true
    end

    # Remove <w:r> elements whose text content is completely empty after variable replacement.
    # Fragmented variable replacement clears subsequent runs' text but leaves the <w:r> elements
    # with formatting properties (bold, font, size, etc.) and empty <w:t/> tags. docx-preview
    # may render these as extra whitespace or spacing artifacts.
    def remove_empty_runs(doc)
      doc.xpath("//w:r", "w" => WORD_NAMESPACE).each do |run|
        text_nodes = run.xpath(".//w:t", "w" => WORD_NAMESPACE)
        # Only remove runs that have text nodes but all are empty
        next if text_nodes.empty?
        next if text_nodes.any? { |t| !t.text.empty? }

        # Don't remove runs that contain non-text elements (images, breaks, etc.)
        has_non_text = run.children.any? do |child|
          child.element? && child.name != "rPr" && child.name != "t"
        end
        next if has_non_text

        run.remove
      end
    end

    def log_replacement_results
      Rails.logger.info "=== Document Generation: Replacement Results ==="
      @replacement_log.each do |log|
        if log[:status] == "replaced"
          Rails.logger.info "  ✓ {{#{log[:variable]}}} => #{log[:value]}"
        else
          Rails.logger.warn "  ✗ {{#{log[:variable]}}} - #{log[:reason]}"
        end
      end
      Rails.logger.info "================================================"
    end

    def convert_to_pdf(docx_path)
      # In macOS development, skip PDF conversion — serve DOCX directly
      # Frontend renders it with docx-preview for 100% original formatting
      if Rails.env.development? && RbConfig::CONFIG["host_os"] =~ /darwin/i
        Rails.logger.info "macOS development: skipping PDF conversion, serving DOCX directly"
        return { content: File.binread(docx_path), format: :docx }
      end

      # Gotenberg is the only converter. If it fails, return nil
      # so the caller creates a "pending" doc and enqueues a retry job.
      result = Templates::GotenbergConversionService.convert(docx_path)
      return result if result

      Rails.logger.warn "Gotenberg unavailable — document will be created with pending PDF"
      ErrorLoggingService.log_service_event(
        "Gotenberg conversion failed — enqueuing retry job",
        service: "Templates::RobustDocumentGeneratorService",
        severity: "warning",
        metadata: { template_id: template&.id&.to_s }
      )
      nil
    end

    def create_generated_document(pdf_content, docx_content: nil)
      file_name = "#{template.name.parameterize}-#{Time.current.strftime('%Y%m%d%H%M%S')}.pdf"

      pdf_file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: file_name,
        content_type: "application/pdf"
      )

      generated_doc = GeneratedDocument.create!(
        name: file_name,
        template: template,
        organization: context[:organization],
        requested_by: context[:user],
        draft_file_id: pdf_file.id,
        file_name: file_name,
        variable_values: variable_values,
        source: context[:request],
        employee: context[:employee],
        pdf_generation_status: "completed"
      )

      generated_doc.initialize_signatures!
      generated_doc
    end

    def create_generated_document_docx(docx_content)
      file_name = "#{template.name.parameterize}-#{Time.current.strftime('%Y%m%d%H%M%S')}.docx"

      docx_file = Mongoid::GridFs.put(
        StringIO.new(docx_content),
        filename: file_name,
        content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )

      generated_doc = GeneratedDocument.create!(
        name: file_name,
        template: template,
        organization: context[:organization],
        requested_by: context[:user],
        draft_file_id: docx_file.id,
        docx_file_id: docx_file.id,
        file_name: file_name,
        variable_values: variable_values,
        source: context[:request],
        employee: context[:employee],
        pdf_generation_status: "completed"
      )

      generated_doc.initialize_signatures!
      generated_doc
    end

    def create_generated_document_pending_pdf(docx_content)
      file_name = "#{template.name.parameterize}-#{Time.current.strftime('%Y%m%d%H%M%S')}"

      # Store DOCX in GridFS for later PDF conversion AND immediate viewing.
      # The DOCX is served directly to the frontend (rendered by docx-preview)
      # while the background job retries PDF conversion via Gotenberg.
      docx_file = Mongoid::GridFs.put(
        StringIO.new(docx_content),
        filename: "#{file_name}.docx",
        content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )

      generated_doc = GeneratedDocument.create!(
        name: "#{file_name}.docx",
        template: template,
        organization: context[:organization],
        requested_by: context[:user],
        draft_file_id: docx_file.id,
        docx_file_id: docx_file.id,
        file_name: "#{file_name}.docx",
        variable_values: variable_values,
        source: context[:request],
        employee: context[:employee],
        pdf_generation_status: "pending"
      )

      generated_doc.initialize_signatures!
      Rails.logger.info "Document created with DOCX for immediate viewing, PDF pending: #{generated_doc.uuid}"

      # Enqueue async retry job to generate the PDF via Gotenberg
      begin
        GotenbergPdfRetryJob.perform_later(generated_doc.id.to_s)
        Rails.logger.info "Enqueued GotenbergPdfRetryJob for document #{generated_doc.uuid}"
      rescue StandardError => e
        Rails.logger.warn "Could not enqueue GotenbergPdfRetryJob: #{e.class} - #{e.message}"
      end

      generated_doc
    end

    class GenerationError < StandardError; end

    # Custom error for missing variables with detailed info
    class MissingVariablesError < StandardError
      attr_reader :missing_data

      def initialize(message, missing_data)
        super(message)
        @missing_data = missing_data
      end
    end
  end
end
