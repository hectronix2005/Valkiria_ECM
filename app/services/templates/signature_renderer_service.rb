# frozen_string_literal: true

module Templates
  class SignatureRendererService
    FONT_PATH_MAP = {
      "Allura" => "Allura-Regular",
      "Dancing Script" => "DancingScript-Regular",
      "Great Vibes" => "GreatVibes-Regular",
      "Pacifico" => "Pacifico-Regular",
      "Sacramento" => "Sacramento-Regular"
    }.freeze

    def initialize(signature)
      @signature = signature
    end

    # Render styled signature as base64 PNG
    def render_styled
      return @signature.image_data if @signature.drawn?

      text = @signature.styled_text
      font = FONT_PATH_MAP[@signature.font_family] || "Helvetica"
      color = @signature.font_color&.delete("#") || "000000"
      size = @signature.font_size || 48

      # Create signature image using MiniMagick
      image = MiniMagick::Image.open(transparent_base_image)

      image.combine_options do |c|
        c.font font_path(font)
        c.pointsize size.to_s
        c.fill "##{color}"
        c.gravity "Center"
        c.draw "text 0,0 '#{escape_text(text)}'"
      end

      # Trim whitespace and add padding
      image.trim
      image.border "10x10"
      image.bordercolor "transparent"

      # Convert to base64
      Base64.strict_encode64(image.to_blob)
    rescue StandardError => e
      Rails.logger.error "SignatureRenderer error: #{e.message}"
      generate_fallback_signature
    end

    # Render a drawn signature from base64 data
    def render_drawn
      @signature.image_data
    end

    # Render signature to a temporary file for PDF embedding
    def to_tempfile
      data = @signature.drawn? ? @signature.image_data : render_styled

      # Remove data URI prefix if present
      base64_data = data.sub(/^data:image\/\w+;base64,/, "")

      tempfile = Tempfile.new(["signature", ".png"])
      tempfile.binmode
      tempfile.write(Base64.decode64(base64_data))
      tempfile.rewind
      tempfile
    end

    private

    def transparent_base_image
      # Create a transparent 400x150 PNG base
      MiniMagick::Image.create(".png") do |f|
        # Create transparent image
        MiniMagick::Tool::Convert.new do |convert|
          convert << "-size" << "400x150"
          convert << "xc:transparent"
          convert << f.path
        end
        f.path
      end
    rescue StandardError
      # Fallback to creating directly
      create_transparent_image
    end

    def create_transparent_image
      tempfile = Tempfile.new(["base", ".png"])
      MiniMagick::Tool::Convert.new do |convert|
        convert << "-size" << "400x150"
        convert << "xc:transparent"
        convert << tempfile.path
      end
      tempfile.path
    end

    def font_path(font_name)
      # Check for Google Fonts in common locations
      possible_paths = [
        Rails.root.join("app", "assets", "fonts", "#{font_name}.ttf"),
        "/usr/share/fonts/truetype/google-fonts/#{font_name}.ttf",
        "/Library/Fonts/#{font_name}.ttf",
        "~/Library/Fonts/#{font_name}.ttf"
      ]

      possible_paths.find { |p| File.exist?(p.to_s) } || font_name
    end

    def escape_text(text)
      text.to_s.gsub("'", "\\\\'")
    end

    def generate_fallback_signature
      # Generate a simple fallback signature using ImageMagick
      text = @signature.styled_text || "Signature"
      color = @signature.font_color&.delete("#") || "000000"

      tempfile = Tempfile.new(["fallback", ".png"])

      MiniMagick::Tool::Convert.new do |convert|
        convert << "-size" << "400x150"
        convert << "xc:transparent"
        convert << "-font" << "Helvetica-Oblique"
        convert << "-pointsize" << "36"
        convert << "-fill" << "##{color}"
        convert << "-gravity" << "Center"
        convert << "-draw" << "text 0,0 '#{escape_text(text)}'"
        convert << tempfile.path
      end

      image = MiniMagick::Image.open(tempfile.path)
      Base64.strict_encode64(image.to_blob)
    ensure
      tempfile&.close
      tempfile&.unlink
    end
  end
end
