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
      validate_required_variables!
      log_variables_to_replace
      generate_document!
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
        # Process the DOCX file (replace variables)
        process_docx(input_file.path, output_file.path)

        # Log replacement results
        log_replacement_results

        # Read the processed DOCX content
        docx_content = File.binread(output_file.path)

        # Validate processed DOCX is not empty (can happen with ZIP processing issues)
        if docx_content.blank?
          raise GenerationError, "El DOCX procesado está vacío. Posible error en el procesamiento del template."
        end

        # Try to convert to PDF
        pdf_content = convert_to_pdf(output_file.path)

        if pdf_content
          # PDF conversion successful - create complete document
          create_generated_document(pdf_content, docx_content: nil)
        else
          # PDF conversion failed - store DOCX for local sync
          Rails.logger.warn "PDF conversion failed. Storing DOCX for local sync workflow."
          create_generated_document_pending_pdf(docx_content)
        end
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
      # Priority 1: LibreOffice (local, best quality)
      if libreoffice_available?
        result = convert_with_libreoffice(docx_path)
        return result if result
      end

      # Priority 2: Gotenberg API (LibreOffice via HTTP, preserves formatting)
      if gotenberg_available?
        result = convert_with_gotenberg(docx_path)
        return result if result
      end

      # Priority 3: Local PDF sync workflow (for Heroku deployment)
      # When LibreOffice and Gotenberg are unavailable, store DOCX for local conversion
      # This preserves formatting by generating PDF locally with LibreOffice
      # Use: rake db:sync:generate_pending_pdfs
      Rails.logger.info "LibreOffice/Gotenberg unavailable - using local PDF sync workflow"
      Rails.logger.info "Document will be created with 'pending' status. Run 'rake db:sync:generate_pending_pdfs' locally to generate PDF with proper formatting."
      nil
    end

    def gotenberg_available?
      ENV["GOTENBERG_URL"].present?
    end

    def convert_with_gotenberg(docx_path)
      Rails.logger.info "Converting DOCX to PDF using Gotenberg API..."

      begin
        require "net/http"
        require "uri"

        gotenberg_url = ENV["GOTENBERG_URL"].chomp("/")
        uri = URI.parse("#{gotenberg_url}/forms/libreoffice/convert")

        # Prepare multipart form data
        boundary = "----GotenbergBoundary#{SecureRandom.hex(8)}"
        file_content = File.binread(docx_path)
        file_name = File.basename(docx_path)

        body = build_multipart_body(boundary, file_name, file_content)

        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = uri.scheme == "https"
        http.read_timeout = 60
        http.open_timeout = 30

        request = Net::HTTP::Post.new(uri.request_uri)
        request["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
        request.body = body

        response = http.request(request)

        if response.code == "200"
          Rails.logger.info "Gotenberg conversion successful (#{response.body.bytesize} bytes)"
          response.body
        else
          Rails.logger.error "Gotenberg conversion failed: #{response.code} - #{response.body}"
          nil
        end
      rescue StandardError => e
        Rails.logger.error "Gotenberg conversion error: #{e.message}"
        Rails.logger.error e.backtrace.first(3).join("\n")
        nil
      end
    end

    def build_multipart_body(boundary, file_name, file_content)
      body = ""
      body << "--#{boundary}\r\n"
      body << "Content-Disposition: form-data; name=\"files\"; filename=\"#{file_name}\"\r\n"
      body << "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n"
      body << "\r\n"
      body << file_content
      body << "\r\n"
      body << "--#{boundary}--\r\n"
      body
    end

    def pandoc_available?
      @pandoc_path ||= `which pandoc 2>/dev/null`.strip.presence
      @pandoc_path ||= "/app/vendor/pandoc/bin/pandoc" if File.exist?("/app/vendor/pandoc/bin/pandoc")
      @pandoc_path.present?
    end

    def convert_with_pandoc_wkhtmltopdf(docx_path)
      Rails.logger.info "Converting DOCX to PDF using Pandoc + wkhtmltopdf..."

      begin
        # Step 1: Convert DOCX to HTML using Pandoc (using shell command directly)
        html_output = Tempfile.new(["pandoc_output", ".html"])
        html_output.close

        pandoc_cmd = "pandoc -f docx -t html5 --standalone \"#{docx_path}\" -o \"#{html_output.path}\" 2>&1"
        Rails.logger.info "Running: #{pandoc_cmd}"
        result = `#{pandoc_cmd}`

        unless $?.success?
          Rails.logger.error "Pandoc failed: #{result}"
          html_output.unlink
          return nil
        end

        html_content = File.read(html_output.path)
        html_output.unlink
        Rails.logger.info "Pandoc DOCX->HTML conversion successful (#{html_content.bytesize} bytes)"

        # Inject additional styles into the pandoc-generated HTML
        styled_html = inject_pdf_styles(html_content)

        # Step 2: Convert HTML to PDF using wkhtmltopdf
        pdf_content = WickedPdf.new.pdf_from_string(
          styled_html,
          page_size: "Letter",
          margin: { top: 20, bottom: 20, left: 20, right: 20 },
          encoding: "UTF-8"
        )

        Rails.logger.info "wkhtmltopdf HTML->PDF conversion successful (#{pdf_content.bytesize} bytes)"
        pdf_content
      rescue StandardError => e
        Rails.logger.error "Pandoc + wkhtmltopdf conversion failed: #{e.message}"
        Rails.logger.error e.backtrace.first(5).join("\n")
        nil
      end
    end

    def inject_pdf_styles(html_content)
      # Inject additional CSS styles into pandoc-generated HTML
      additional_styles = <<~CSS
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #333;
            max-width: 100%;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #222;
            margin-top: 0.8em;
            margin-bottom: 0.4em;
          }
          p {
            margin: 0.4em 0;
            text-align: justify;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.8em 0;
          }
          th, td {
            border: 1px solid #999;
            padding: 6px;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
        </style>
      CSS

      # Insert styles before </head>
      if html_content.include?("</head>")
        html_content.sub("</head>", "#{additional_styles}</head>")
      else
        # If no head tag, wrap the content
        <<~HTML
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            #{additional_styles}
          </head>
          <body>
            #{html_content}
          </body>
          </html>
        HTML
      end
    end

    def libreoffice_available?
      # Check common LibreOffice paths on macOS, Linux, and Heroku
      paths_to_check = [
        "/app/.apt/usr/bin/soffice",  # Heroku apt buildpack path
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/usr/local/bin/soffice",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice"
      ]

      @libreoffice_path = paths_to_check.find { |p| File.exist?(p) }
      @libreoffice_path ||= `which soffice 2>/dev/null`.strip.presence
      @libreoffice_path ||= `which libreoffice 2>/dev/null`.strip.presence

      Rails.logger.info "LibreOffice path: #{@libreoffice_path || 'NOT FOUND'}"
      @libreoffice_path.present?
    end

    def convert_with_libreoffice(docx_path)
      output_dir = Dir.mktmpdir
      user_profile = Dir.mktmpdir("lo_profile")

      begin
        # Set environment for Heroku apt buildpack
        lib_path = "/app/.apt/usr/lib/libreoffice/program:/app/.apt/usr/lib/x86_64-linux-gnu"

        # Additional environment variables to fix LibreOffice issues on Heroku
        env_vars = {
          "LD_LIBRARY_PATH" => "#{lib_path}:#{ENV['LD_LIBRARY_PATH']}",
          "HOME" => "/tmp",
          "FONTCONFIG_PATH" => "/etc/fonts",
          "SAL_DISABLE_SYNCHRONOUS_PRINTER_DETECTION" => "1",
          "SAL_DISABLE_COMPONENTITHREADING" => "1",
          "SAL_USE_VCLPLUGIN" => "svp",
          "DISPLAY" => "",
          "URE_BOOTSTRAP" => "file:///app/.apt/usr/lib/libreoffice/program/fundamentalrc"
        }

        env_string = env_vars.map { |k, v| "#{k}=#{v}" }.join(" ")

        # Use -env:UserInstallation to avoid profile issues
        user_install = "-env:UserInstallation=file://#{user_profile}"

        cmd = "#{env_string} \"#{@libreoffice_path}\" --headless --nologo --nofirststartwizard --norestore #{user_install} --convert-to pdf --outdir \"#{output_dir}\" \"#{docx_path}\" 2>&1"
        Rails.logger.info "Running LibreOffice: #{cmd}"
        result = `#{cmd}`
        Rails.logger.info "LibreOffice conversion result: #{result}"

        pdf_files = Dir.glob(File.join(output_dir, "*.pdf"))
        if pdf_files.empty?
          Rails.logger.error "LibreOffice conversion failed"
          return nil
        end

        File.binread(pdf_files.first)
      ensure
        FileUtils.rm_rf(output_dir)
        FileUtils.rm_rf(user_profile)
      end
    end

    def convert_using_preview_with_overlay(_docx_path)
      require "hexapdf"
      require "combine_pdf"

      preview_content = template.preview_content
      return nil unless preview_content

      Rails.logger.info "Attempting PDF text replacement using HexaPDF..."

      begin
        # Try to replace variables directly in the PDF using HexaPDF's text search
        doc = HexaPDF::Document.new(io: StringIO.new(preview_content))
        replacements_made = 0

        variable_values.each do |var_name, value|
          # Try different placeholder formats
          placeholders = [
            "{{#{var_name}}}",
            "{{ #{var_name} }}",
            "{{#{var_name.upcase}}}",
            "{{#{var_name.downcase}}}"
          ]

          doc.pages.each do |page|
            # Get the page's content stream
            contents = page.contents
            next unless contents

            # Decode the content stream to get raw data
            data = contents.stream rescue nil
            next unless data

            data_str = data.to_s.force_encoding("UTF-8") rescue data.to_s

            placeholders.each do |placeholder|
              if data_str.include?(placeholder)
                data_str.gsub!(placeholder, value.to_s)
                replacements_made += 1
                Rails.logger.info "  Replaced '#{placeholder}' with '#{value}'"
              end
            end

            # Update the content stream if changes were made
            if replacements_made > 0
              contents.stream = data_str
            end
          end
        end

        if replacements_made > 0
          Rails.logger.info "HexaPDF: Made #{replacements_made} replacements successfully"
          output = StringIO.new
          doc.write(output)
          return output.string
        else
          Rails.logger.info "HexaPDF: No direct replacements possible, using data summary page"
        end
      rescue StandardError => e
        Rails.logger.warn "HexaPDF replacement failed: #{e.message}, falling back to data summary"
      end

      # Fallback: Use original preview with data summary page
      convert_using_stored_preview
    end

    def convert_using_stored_preview
      require "combine_pdf"

      # Get the stored PDF preview (has original formatting but with placeholders)
      preview_content = template.preview_content
      raise GenerationError, "No se pudo leer el PDF preview" unless preview_content

      # Parse the preview PDF
      base_pdf = CombinePDF.parse(preview_content)

      # Create a data summary page with all variable values
      data_page_pdf = create_data_summary_page(base_pdf)

      # Add data summary as the first page
      if data_page_pdf
        data_pages = CombinePDF.parse(data_page_pdf)
        combined = CombinePDF.new
        data_pages.pages.each { |page| combined << page }
        base_pdf.pages.each { |page| combined << page }
        return combined.to_pdf
      end

      base_pdf.to_pdf
    end

    def create_data_summary_page(base_pdf)
      return nil if variable_values.empty?

      # Get page dimensions from first page
      first_page = base_pdf.pages.first
      page_width = first_page.mediabox[2] || 612
      page_height = first_page.mediabox[3] || 792

      employee = context[:employee]
      org = context[:organization]

      Prawn::Document.new(
        page_size: [page_width, page_height],
        margin: 40
      ) do |pdf|
        # Header
        pdf.text "DATOS DEL DOCUMENTO", size: 16, style: :bold, align: :center
        pdf.move_down 5
        pdf.text "Generado: #{Time.current.strftime('%d/%m/%Y %H:%M')}", size: 9, align: :center, color: "666666"
        pdf.move_down 20

        # Employee info box
        if employee
          pdf.text "DATOS DEL EMPLEADO", size: 12, style: :bold
          pdf.stroke_horizontal_rule
          pdf.move_down 10

          employee_data = [
            ["Nombre:", employee.full_name],
            ["Identificacion:", "#{employee.identification_type} #{employee.identification_number}"],
            ["Cargo:", employee.job_title],
            ["Departamento:", employee.department],
            ["Fecha de Ingreso:", employee.hire_date&.strftime("%d/%m/%Y")],
            ["Tipo de Contrato:", format_contract_type(employee.contract_type)],
            ["Salario:", format_currency(employee.salary)]
          ].reject { |_, v| v.blank? }

          pdf.table(employee_data, width: pdf.bounds.width, cell_style: { size: 10, padding: 5 }) do |t|
            t.columns(0).font_style = :bold
            t.columns(0).width = 150
          end
          pdf.move_down 20
        end

        # Variable values
        pdf.text "VARIABLES DEL DOCUMENTO", size: 12, style: :bold
        pdf.stroke_horizontal_rule
        pdf.move_down 10

        var_data = variable_values.map { |name, value| [name, value.to_s] }
        unless var_data.empty?
          pdf.table(var_data, width: pdf.bounds.width, cell_style: { size: 9, padding: 4 }) do |t|
            t.columns(0).font_style = :bold
            t.columns(0).width = 180
          end
        end

        # Footer note
        pdf.move_down 30
        pdf.text "NOTA: Los datos anteriores corresponden a las variables reemplazadas en el documento.",
                 size: 8, color: "666666", align: :center
        pdf.text "El formato original del documento se muestra en las paginas siguientes.",
                 size: 8, color: "666666", align: :center
      end.render
    rescue => e
      Rails.logger.error "Error creating data summary page: #{e.message}"
      nil
    end

    def generate_basic_prawn_pdf(docx_path)
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

    def format_contract_type(type)
      return nil if type.blank?

      types = {
        "indefinite" => "Término Indefinido",
        "fixed_term" => "Término Fijo",
        "work_or_labor" => "Obra o Labor",
        "temporary" => "Temporal",
        "apprenticeship" => "Aprendizaje"
      }
      types[type.to_s] || type.to_s.humanize
    end

    def format_currency(amount)
      return nil if amount.blank?

      "$#{number_with_delimiter(amount.to_i)}"
    end

    def number_with_delimiter(number, delimiter: ".")
      number.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1' + delimiter).reverse
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

    def create_generated_document_pending_pdf(docx_content)
      file_name = "#{template.name.parameterize}-#{Time.current.strftime('%Y%m%d%H%M%S')}"

      # Store DOCX in GridFS for later local conversion
      docx_file = Mongoid::GridFs.put(
        StringIO.new(docx_content),
        filename: "#{file_name}.docx",
        content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )

      generated_doc = GeneratedDocument.create!(
        name: "#{file_name}.pdf",
        template: template,
        organization: context[:organization],
        requested_by: context[:user],
        docx_file_id: docx_file.id,
        file_name: "#{file_name}.pdf",
        variable_values: variable_values,
        source: context[:request],
        employee: context[:employee],
        pdf_generation_status: "pending"
      )

      generated_doc.initialize_signatures!
      Rails.logger.info "Document created with pending PDF generation: #{generated_doc.uuid}"
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
