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
    def generate!
      validate_template!
      resolve_variables!
      log_variables_to_replace
      generate_document!
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

    def log_variables_to_replace
      Rails.logger.info "=== Document Generation: Variables to Replace ==="
      variable_values.each do |name, value|
        Rails.logger.info "  {{#{name}}} => #{value.inspect}"
      end
      Rails.logger.info "================================================="
    end

    def generate_document!
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
        # Process the DOCX file
        process_docx(input_file.path, output_file.path)

        # Log replacement results
        log_replacement_results

        # Convert to PDF
        pdf_content = convert_to_pdf(output_file.path)

        # Create GeneratedDocument record
        create_generated_document(pdf_content)
      ensure
        input_file.unlink
        output_file.unlink
      end
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
      doc = Nokogiri::XML(xml_content)

      # Process all paragraphs
      doc.xpath("//w:p", "w" => WORD_NAMESPACE).each do |paragraph|
        process_paragraph(paragraph)
      end

      # Write back
      zipfile.get_output_stream(entry_name) { |f| f.write(doc.to_xml) }
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
      str.to_s
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
          node_end = entry[:end]

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
      if libreoffice_available?
        convert_with_libreoffice(docx_path)
      else
        Rails.logger.warn "LibreOffice not available. PDF will have limited formatting."
        Rails.logger.warn "Install LibreOffice: brew install --cask libreoffice"
        convert_with_prawn(docx_path)
      end
    end

    def libreoffice_available?
      # Check common LibreOffice paths on macOS
      paths_to_check = [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/usr/local/bin/soffice",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice"
      ]

      @libreoffice_path = paths_to_check.find { |p| File.exist?(p) }
      @libreoffice_path ||= `which soffice 2>/dev/null`.strip.presence
      @libreoffice_path ||= `which libreoffice 2>/dev/null`.strip.presence

      @libreoffice_path.present?
    end

    def convert_with_libreoffice(docx_path)
      output_dir = Dir.mktmpdir
      begin
        cmd = "\"#{@libreoffice_path}\" --headless --convert-to pdf --outdir \"#{output_dir}\" \"#{docx_path}\" 2>&1"
        result = `#{cmd}`
        Rails.logger.info "LibreOffice conversion: #{result}"

        pdf_files = Dir.glob(File.join(output_dir, "*.pdf"))
        raise GenerationError, "Conversión a PDF falló: #{result}" if pdf_files.empty?

        File.binread(pdf_files.first)
      ensure
        FileUtils.rm_rf(output_dir)
      end
    end

    def convert_with_prawn(docx_path)
      # Enhanced Prawn fallback with better formatting
      doc = Docx::Document.open(docx_path)

      Prawn::Document.new(page_size: "LETTER", margin: 50) do |pdf|
        setup_fonts(pdf)

        doc.paragraphs.each do |para|
          text = para.text.strip
          next if text.empty?

          render_paragraph(pdf, para, text)
        end

        doc.tables.each do |table|
          render_table(pdf, table)
        end
      end.render
    end

    def setup_fonts(pdf)
      # Try to use system fonts or fallback
      font_path = Rails.root.join("app/assets/fonts")

      if File.exist?(font_path.join("DejaVuSans.ttf"))
        pdf.font_families.update(
          "DejaVu" => {
            normal: font_path.join("DejaVuSans.ttf").to_s,
            bold: font_path.join("DejaVuSans-Bold.ttf").to_s,
            italic: font_path.join("DejaVuSans-Oblique.ttf").to_s
          }
        )
        pdf.font("DejaVu")
      end
    rescue StandardError => e
      Rails.logger.warn "Could not load custom fonts: #{e.message}"
    end

    def render_paragraph(pdf, para, text)
      # Detect heading style
      style_name = para.node.at_xpath(".//w:pStyle/@w:val", "w" => WORD_NAMESPACE)&.value || ""

      options = { size: 11, leading: 4 }

      if style_name.downcase.include?("heading") || style_name.downcase.include?("titulo")
        options[:size] = 14
        options[:style] = :bold
        pdf.move_down 10
      elsif style_name.downcase.include?("title")
        options[:size] = 18
        options[:style] = :bold
        pdf.move_down 15
      end

      pdf.text text, options
      pdf.move_down 6
    rescue Prawn::Errors::IncompatibleStringEncoding
      # Handle encoding issues
      pdf.text text.encode("UTF-8", invalid: :replace, undef: :replace), options
      pdf.move_down 6
    end

    def render_table(pdf, table)
      table_data = table.rows.map do |row|
        row.cells.map do |cell|
          cell.paragraphs.map(&:text).join("\n")
        end
      end

      return if table_data.empty? || table_data.all?(&:empty?)

      pdf.move_down 10
      pdf.table(table_data, width: pdf.bounds.width) do
        cells.padding = 8
        cells.border_width = 0.5
        cells.border_color = "666666"
        row(0).font_style = :bold
        row(0).background_color = "EEEEEE"
      end
      pdf.move_down 10
    rescue StandardError => e
      Rails.logger.warn "Error rendering table: #{e.message}"
    end

    def create_generated_document(pdf_content)
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
        employee: context[:employee]
      )

      generated_doc.initialize_signatures!
      generated_doc
    end

    class GenerationError < StandardError; end
  end
end
