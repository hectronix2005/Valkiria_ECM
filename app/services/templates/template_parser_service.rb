# frozen_string_literal: true

module Templates
  class TemplateParserService
    VARIABLE_PATTERN = /\{\{([^}]+)\}\}/
    MAX_CONTEXT_LENGTH = 300

    def initialize(file_content)
      @file_content = file_content
    end

    # Extract all {{Variable}} patterns — returns sorted array of names
    def extract_variables
      parse_document[:variables]
    end

    # Returns { variables: [...], contexts: { "Var Name" => ["...paragraph..."] } }
    def extract_with_context
      parse_document
    end

    private

    def parse_document
      return { variables: [], contexts: {} } unless @file_content

      tempfile = Tempfile.new(["template", ".docx"])
      tempfile.binmode
      tempfile.write(@file_content)
      tempfile.rewind

      begin
        doc = Docx::Document.open(tempfile.path)
        variables = Set.new
        contexts = Hash.new { |h, k| h[k] = [] }

        doc.paragraphs.each do |para|
          collect_from_text(para.text, variables, contexts)
        end

        doc.tables.each do |table|
          table.rows.each do |row|
            row.cells.each do |cell|
              cell.paragraphs.each do |para|
                collect_from_text(para.text, variables, contexts)
              end
            end
          end
        end

        { variables: variables.to_a.sort, contexts: contexts }
      rescue StandardError => e
        Rails.logger.error "TemplateParser error: #{e.message}"
        ErrorLoggingService.capture_service_error(e,
          service: "Templates::TemplateParserService",
          severity: "warning",
          metadata: { content_size: @file_content&.bytesize }
        )
        { variables: [], contexts: {} }
      ensure
        tempfile.close
        tempfile.unlink
      end
    end

    def collect_from_text(text, variables, contexts)
      return unless text&.match?(VARIABLE_PATTERN)

      text.scan(VARIABLE_PATTERN).each do |match|
        variable_name = match[0].strip
        next if variable_name.blank?

        normalized_name = VariableNormalizer.normalize(variable_name)
        variables.add(normalized_name)

        snippet = text.strip.truncate(MAX_CONTEXT_LENGTH)
        contexts[normalized_name] << snippet unless contexts[normalized_name].include?(snippet)
      end
    end
  end
end
