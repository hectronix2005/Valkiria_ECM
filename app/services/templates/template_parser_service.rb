# frozen_string_literal: true

module Templates
  class TemplateParserService
    VARIABLE_PATTERN = /\{\{([^}]+)\}\}/

    def initialize(file_content)
      @file_content = file_content
    end

    # Extract all {{Variable}} patterns from a Word document
    def extract_variables
      return [] unless @file_content

      # Write content to temp file for docx gem
      tempfile = Tempfile.new(["template", ".docx"])
      tempfile.binmode
      tempfile.write(@file_content)
      tempfile.rewind

      begin
        doc = Docx::Document.open(tempfile.path)
        variables = Set.new

        # Extract from paragraphs
        doc.paragraphs.each do |para|
          extract_from_text(para.text, variables)
        end

        # Extract from tables
        doc.tables.each do |table|
          table.rows.each do |row|
            row.cells.each do |cell|
              cell.paragraphs.each do |para|
                extract_from_text(para.text, variables)
              end
            end
          end
        end

        variables.to_a.sort
      rescue StandardError => e
        Rails.logger.error "TemplateParser error: #{e.message}"
        []
      ensure
        tempfile.close
        tempfile.unlink
      end
    end

    private

    def extract_from_text(text, variables)
      return unless text

      text.scan(VARIABLE_PATTERN).each do |match|
        variable_name = match[0].strip
        next if variable_name.blank?

        # Normalize to uppercase without accents for consistent matching
        normalized_name = VariableNormalizer.normalize(variable_name)
        variables.add(normalized_name)
      end
    end
  end
end
