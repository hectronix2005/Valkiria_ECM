# frozen_string_literal: true

module Templates
  # Normalizes variable names for consistent matching regardless of
  # case, accents, or special characters
  class VariableNormalizer
    # Mapping of accented characters to their base form (lowercase)
    ACCENT_MAP_LOWER = {
      "á" => "a", "à" => "a", "ä" => "a", "â" => "a", "ã" => "a",
      "é" => "e", "è" => "e", "ë" => "e", "ê" => "e",
      "í" => "i", "ì" => "i", "ï" => "i", "î" => "i",
      "ó" => "o", "ò" => "o", "ö" => "o", "ô" => "o", "õ" => "o",
      "ú" => "u", "ù" => "u", "ü" => "u", "û" => "u",
      "ñ" => "n",
      "ç" => "c"
    }.freeze

    # Mapping of accented characters to their base form (uppercase)
    ACCENT_MAP_UPPER = {
      "Á" => "A", "À" => "A", "Ä" => "A", "Â" => "A", "Ã" => "A",
      "É" => "E", "È" => "E", "Ë" => "E", "Ê" => "E",
      "Í" => "I", "Ì" => "I", "Ï" => "I", "Î" => "I",
      "Ó" => "O", "Ò" => "O", "Ö" => "O", "Ô" => "O", "Õ" => "O",
      "Ú" => "U", "Ù" => "U", "Ü" => "U", "Û" => "U",
      "Ñ" => "N",
      "Ç" => "C"
    }.freeze

    # Words that should remain lowercase in Title Case (Spanish)
    LOWERCASE_WORDS = %w[de del la el los las a en con por para y o u].freeze

    class << self
      # Normalize a variable name to Title Case without accents
      # Example: "AUXILIO DE ALIMENTACIÓN" -> "Auxilio de Alimentacion"
      # @param name [String] The variable name to normalize
      # @return [String] Normalized variable name in Title Case
      def normalize(name)
        return "" if name.blank?

        result = name.to_s.strip

        # Replace accented characters (both cases)
        ACCENT_MAP_LOWER.each { |accented, base| result = result.gsub(accented, base) }
        ACCENT_MAP_UPPER.each { |accented, base| result = result.gsub(accented, base) }

        # Split by spaces and other separators, preserving the separators
        # This handles cases like "Dia/Mes/Ano"
        parts = result.split(/(\s+|[\/\-])/)

        parts.map.with_index do |part, index|
          # Skip separators
          next part if part.match?(/^[\s\/\-]+$/)

          word = part.downcase

          # Find the first real word index (skip separators)
          first_word_index = parts.index { |p| !p.match?(/^[\s\/\-]+$/) }
          is_first_word = (index == first_word_index)

          # First word is always capitalized, others check against lowercase list
          if is_first_word || !LOWERCASE_WORDS.include?(word)
            word.capitalize
          else
            word
          end
        end.join
      end

      # Generate a key-safe version (lowercase, underscores)
      # @param name [String] The variable name
      # @return [String] Key-safe string for use in mapping keys
      def to_key(name)
        return "" if name.blank?

        result = name.to_s.strip.downcase

        # Replace accented characters
        ACCENT_MAP_LOWER.each { |accented, base| result = result.gsub(accented, base) }

        result
          .gsub(/[^a-z0-9]+/, "_")
          .gsub(/^_+|_+$/, "")
      end

      # Get the comparison key (for matching, all lowercase without accents)
      # @param name [String] The variable name
      # @return [String] Lowercase string for comparison
      def comparison_key(name)
        return "" if name.blank?

        result = name.to_s.strip.downcase

        # Replace accented characters
        ACCENT_MAP_LOWER.each { |accented, base| result = result.gsub(accented, base) }

        # Normalize spaces
        result.gsub(/\s+/, " ").strip
      end

      # Check if two variable names are equivalent after normalization
      # @param name1 [String] First variable name
      # @param name2 [String] Second variable name
      # @return [Boolean] True if names match after normalization
      def equivalent?(name1, name2)
        comparison_key(name1) == comparison_key(name2)
      end
    end
  end
end
