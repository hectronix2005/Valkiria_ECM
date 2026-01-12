# frozen_string_literal: true

module Templates
  class DocumentGeneratorService
    attr_reader :template, :context, :variable_values

    def initialize(template, context)
      @template = template
      @context = context
      @variable_values = {}
    end

    # Generate a document from template
    def generate!
      validate_template!
      resolve_variables!
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

    def generate_document!
      # Get template content
      template_content = template.file_content
      raise GenerationError, "No se pudo leer el archivo del template" unless template_content

      # Create temp file for processing
      input_file = Tempfile.new(["template", ".docx"])
      input_file.binmode
      input_file.write(template_content)
      input_file.rewind

      begin
        # Replace variables in the document
        doc = Docx::Document.open(input_file.path)
        replace_variables_in_document!(doc)

        # Save modified document
        output_docx = Tempfile.new(["output", ".docx"])
        doc.save(output_docx.path)

        # Convert to PDF
        pdf_content = convert_to_pdf(output_docx.path)

        # Create GeneratedDocument record
        create_generated_document(pdf_content)
      ensure
        input_file.close
        input_file.unlink
        output_docx&.close
        output_docx&.unlink
      end
    end

    def replace_variables_in_document!(doc)
      # Replace in paragraphs
      doc.paragraphs.each do |para|
        replace_in_paragraph!(para)
      end

      # Replace in tables
      doc.tables.each do |table|
        table.rows.each do |row|
          row.cells.each do |cell|
            cell.paragraphs.each do |para|
              replace_in_paragraph!(para)
            end
          end
        end
      end
    end

    def replace_in_paragraph!(para)
      variable_values.each do |variable_name, value|
        pattern = "{{#{variable_name}}}"
        replacement = value.to_s

        # Handle paragraph text replacement
        para.each_text_run do |run|
          run.text = run.text.gsub(pattern, replacement) if run.text.include?(pattern)
        end
      end
    end

    def convert_to_pdf(docx_path)
      # Try using LibreOffice for conversion (if available)
      if libreoffice_available?
        convert_with_libreoffice(docx_path)
      else
        # Fallback to Prawn-based PDF generation
        convert_with_prawn(docx_path)
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

      @libreoffice_path.present?
    end

    def convert_with_libreoffice(docx_path)
      output_dir = Dir.mktmpdir
      user_profile = Dir.mktmpdir("lo_profile")

      begin
        # Set environment for Heroku apt buildpack
        lib_path = "/app/.apt/usr/lib/libreoffice/program:/app/.apt/usr/lib/x86_64-linux-gnu"
        env_vars = [
          "LD_LIBRARY_PATH=#{lib_path}:$LD_LIBRARY_PATH",
          "HOME=/tmp"
        ].join(" ")

        # Use -env:UserInstallation to avoid profile issues
        user_install = "-env:UserInstallation=file://#{user_profile}"

        cmd = "#{env_vars} \"#{@libreoffice_path}\" --headless #{user_install} --convert-to pdf --outdir \"#{output_dir}\" \"#{docx_path}\" 2>&1"
        Rails.logger.info "Running LibreOffice: #{cmd}"
        result = `#{cmd}`
        Rails.logger.info "LibreOffice conversion result: #{result}"

        # Find the generated PDF
        pdf_files = Dir.glob(File.join(output_dir, "*.pdf"))
        if pdf_files.empty?
          Rails.logger.error "LibreOffice conversion failed, falling back to Prawn"
          return convert_with_prawn(docx_path)
        end

        File.binread(pdf_files.first)
      ensure
        FileUtils.rm_rf(output_dir)
        FileUtils.rm_rf(user_profile)
      end
    end

    def convert_with_prawn(docx_path)
      # Fallback: Generate a basic PDF with Prawn
      doc = Docx::Document.open(docx_path)

      Prawn::Document.new do |pdf|
        pdf.font_families.update(
          "DejaVu" => {
            normal: Rails.root.join("app/assets/fonts/DejaVuSans.ttf").to_s,
            bold: Rails.root.join("app/assets/fonts/DejaVuSans-Bold.ttf").to_s,
            italic: Rails.root.join("app/assets/fonts/DejaVuSans-Oblique.ttf").to_s
          }
        ) if File.exist?(Rails.root.join("app/assets/fonts/DejaVuSans.ttf"))

        pdf.font("DejaVu") if pdf.font_families.key?("DejaVu")

        doc.paragraphs.each do |para|
          text = para.text.strip
          next if text.empty?

          # Basic styling
          if para.node["pStyle"]&.include?("Heading")
            pdf.text text, size: 16, style: :bold
            pdf.move_down 10
          else
            pdf.text text, size: 11
            pdf.move_down 5
          end
        end

        # Handle tables
        doc.tables.each do |table|
          table_data = table.rows.map do |row|
            row.cells.map { |cell| cell.paragraphs.map(&:text).join("\n") }
          end

          if table_data.any?
            pdf.table(table_data, width: pdf.bounds.width) do
              cells.padding = 5
              cells.border_width = 0.5
            end
            pdf.move_down 10
          end
        end
      end.render
    end

    def create_generated_document(pdf_content)
      # Store PDF in GridFS
      file_name = "#{template.name.parameterize}-#{Time.current.strftime('%Y%m%d%H%M%S')}.pdf"

      pdf_file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: file_name,
        content_type: "application/pdf"
      )

      # Create the GeneratedDocument record
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

      # Initialize signatures
      generated_doc.initialize_signatures!

      generated_doc
    end

    class GenerationError < StandardError; end
  end
end
