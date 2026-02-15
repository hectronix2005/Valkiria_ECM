# frozen_string_literal: true

require "zip"
require "nokogiri"
require "prawn"
require "prawn/table"

module Templates
  # Pure Ruby DOCX-to-PDF converter using Prawn.
  # No external binaries (LibreOffice, Pandoc, wkhtmltopdf) required.
  class DocxToPdfConverter
    HALF_POINT = 0.5 # DOCX sizes are in half-points
    DEFAULT_FONT_SIZE = 11
    PAGE_MARGIN = [50, 50, 50, 50] # top, right, bottom, left

    def initialize(docx_path)
      @docx_path = docx_path
      @images = {}
      @rels = {}
      @header_images = {}
      @header_rels = {}
      @styles = {}
    end

    def convert
      Zip::File.open(@docx_path) do |zip|
        load_relationships(zip)
        load_images(zip)
        load_header_relationships(zip)
        load_header_images(zip)
        load_styles(zip)
        generate_pdf(zip)
      end
    end

    private

    def load_relationships(zip)
      entry = zip.find_entry("word/_rels/document.xml.rels")
      return unless entry

      xml = Nokogiri::XML(entry.get_input_stream.read)
      xml.remove_namespaces!
      xml.xpath("//Relationship").each do |rel|
        @rels[rel["Id"]] = rel["Target"]
      end
    end

    def load_header_relationships(zip)
      zip.entries.each do |entry|
        next unless entry.name =~ %r{word/_rels/header\d+\.xml\.rels}

        xml = Nokogiri::XML(entry.get_input_stream.read)
        xml.remove_namespaces!
        xml.xpath("//Relationship").each do |rel|
          @header_rels[rel["Id"]] = rel["Target"]
        end
      end
    end

    def load_images(zip)
      zip.entries.each do |entry|
        next unless entry.name =~ %r{word/media/}

        @images[entry.name] = entry.get_input_stream.read
      end
    end

    def load_header_images(zip)
      zip.entries.each do |entry|
        next unless entry.name =~ %r{word/media/}

        @header_images[entry.name] = @images[entry.name]
      end
    end

    def load_styles(zip)
      entry = zip.find_entry("word/styles.xml")
      return unless entry

      xml = Nokogiri::XML(entry.get_input_stream.read)
      xml.remove_namespaces!
      xml.xpath("//style").each do |style|
        id = style["styleId"]
        rpr = style.at_xpath(".//rPr")
        ppr = style.at_xpath(".//pPr")
        @styles[id] = {
          bold: rpr&.at_xpath(".//b") ? true : false,
          italic: rpr&.at_xpath(".//i") ? true : false,
          size: rpr&.at_xpath(".//sz")&.attr("val")&.to_f,
          alignment: ppr&.at_xpath(".//jc")&.attr("val")
        }
      end
    end

    def generate_pdf(zip)
      body_xml = zip.find_entry("word/document.xml").get_input_stream.read
      body_doc = Nokogiri::XML(body_xml)
      body_doc.remove_namespaces!

      header_doc = find_default_header(zip)

      pdf = Prawn::Document.new(
        page_size: "LETTER",
        margin: PAGE_MARGIN,
        info: { Producer: "Valkyria ECM" }
      )

      Prawn::Fonts::AFM.hide_m17n_warning = true

      render_header(pdf, header_doc) if header_doc
      render_body(pdf, body_doc)

      pdf.render
    end

    def find_default_header(zip)
      # header2 is typically the default header in DOCX
      %w[word/header2.xml word/header1.xml word/header3.xml].each do |name|
        entry = zip.find_entry(name)
        next unless entry

        doc = Nokogiri::XML(entry.get_input_stream.read)
        doc.remove_namespaces!
        # Only use if it has content (images or text)
        has_content = doc.xpath("//drawing").any? || doc.xpath("//t").any?
        return doc if has_content
      end
      nil
    end

    def render_header(pdf, header_doc)
      header_doc.xpath("//p").each do |para|
        drawing = para.at_xpath(".//drawing")
        if drawing
          render_header_image(pdf, drawing)
        else
          text = para.xpath(".//t").map(&:text).join
          next if text.strip.empty?

          pdf.text text, size: 9, color: "666666", align: :center
        end
      end
      pdf.move_down 10
    end

    def render_header_image(pdf, drawing)
      blip = drawing.at_xpath(".//blip")
      return unless blip

      embed_id = blip.attr("embed")
      target = @header_rels[embed_id] || @rels[embed_id]
      return unless target

      image_path = target.start_with?("word/") ? target : "word/#{target}"
      image_data = @images[image_path] || @header_images[image_path]
      return unless image_data

      # Get image dimensions from DOCX (in EMU - 1 inch = 914400 EMU)
      extent = drawing.at_xpath(".//extent")
      if extent
        cx = extent["cx"].to_f / 914_400.0 * 72 # convert EMU to points
        cy = extent["cy"].to_f / 914_400.0 * 72
        # Limit to page width
        max_width = pdf.bounds.width
        if cx > max_width
          ratio = max_width / cx
          cx = max_width
          cy *= ratio
        end
      end

      begin
        io = StringIO.new(image_data)
        opts = { position: :center }
        opts[:width] = cx if cx && cx > 0
        pdf.image io, **opts
        pdf.move_down 5
      rescue StandardError => e
        Rails.logger.warn "[DocxToPdfConverter] Could not render header image: #{e.message}"
      end
    end

    def render_body(pdf, doc)
      body = doc.at_xpath("//body")
      return unless body

      body.children.each do |node|
        case node.name
        when "p"
          render_paragraph(pdf, node)
        when "tbl"
          render_table(pdf, node)
        when "sectPr"
          # Section properties - skip
        end
      end
    end

    def render_paragraph(pdf, para)
      # Check for page break
      if para.at_xpath(".//pPr/pageBreakBefore") || para.at_xpath(".//r/br[@type='page']")
        pdf.start_new_page
        return
      end

      # Check for image
      drawing = para.at_xpath(".//drawing")
      if drawing
        render_inline_image(pdf, drawing)
        return
      end

      # Get paragraph properties
      ppr = para.at_xpath(".//pPr")
      alignment = parse_alignment(ppr&.at_xpath(".//jc")&.attr("val"))
      style_id = ppr&.at_xpath(".//pStyle")&.attr("val")
      style = @styles[style_id] || {}

      # Spacing
      spacing = ppr&.at_xpath(".//spacing")
      space_after = spacing ? (spacing["after"]&.to_f || 0) / 20.0 : 4
      space_before = spacing ? (spacing["before"]&.to_f || 0) / 20.0 : 0

      # Build formatted text from runs
      runs = para.xpath(".//r")
      if runs.empty?
        pdf.move_down [space_after, 6].max
        return
      end

      formatted_parts = runs.map { |run| build_run(run, style) }.compact
      return if formatted_parts.empty? && runs.all? { |r| r.xpath(".//t").empty? }

      pdf.move_down space_before if space_before > 0

      if formatted_parts.any?
        pdf.formatted_text formatted_parts, align: alignment, leading: 2
      end

      pdf.move_down space_after if space_after > 0
    end

    def build_run(run, parent_style)
      text_nodes = run.xpath(".//t")
      return nil if text_nodes.empty?

      text = text_nodes.map(&:text).join
      return nil if text.empty?

      rpr = run.at_xpath(".//rPr")
      bold = rpr&.at_xpath(".//b") ? true : (parent_style[:bold] || false)
      italic = rpr&.at_xpath(".//i") ? true : (parent_style[:italic] || false)
      underline = rpr&.at_xpath(".//u")
      size = rpr&.at_xpath(".//sz")&.attr("val")&.to_f
      size = size ? (size * HALF_POINT) : (parent_style[:size] ? parent_style[:size] * HALF_POINT : DEFAULT_FONT_SIZE)
      color = rpr&.at_xpath(".//color")&.attr("val")

      result = { text: text, size: size }

      styles = []
      styles << :bold if bold
      styles << :italic if italic
      result[:styles] = styles if styles.any?

      if underline && underline["val"] != "none"
        # Prawn doesn't support underline in formatted_text natively,
        # simulate with callback or just skip
      end

      result[:color] = color if color && color != "auto" && color.length == 6

      result
    end

    def render_inline_image(pdf, drawing)
      blip = drawing.at_xpath(".//blip")
      return unless blip

      embed_id = blip.attr("embed")
      target = @rels[embed_id]
      return unless target

      image_path = target.start_with?("word/") ? target : "word/#{target}"
      image_data = @images[image_path]
      return unless image_data

      extent = drawing.at_xpath(".//extent")
      if extent
        cx = extent["cx"].to_f / 914_400.0 * 72
        max_width = pdf.bounds.width
        cx = max_width if cx > max_width
      end

      begin
        io = StringIO.new(image_data)
        opts = { position: :center }
        opts[:width] = cx if cx && cx > 0
        pdf.image io, **opts
        pdf.move_down 5
      rescue StandardError => e
        Rails.logger.warn "[DocxToPdfConverter] Could not render image: #{e.message}"
      end
    end

    def render_table(pdf, tbl)
      rows_data = []
      tbl.xpath(".//tr").each do |tr|
        row = []
        tr.xpath(".//tc").each do |tc|
          cell_text = tc.xpath(".//p").map { |p|
            p.xpath(".//t").map(&:text).join
          }.join("\n")
          row << cell_text
        end
        rows_data << row
      end

      return if rows_data.empty?

      # Normalize column count
      max_cols = rows_data.map(&:length).max
      rows_data.each { |row| row << "" while row.length < max_cols }

      pdf.move_down 5
      begin
        pdf.table(rows_data, width: pdf.bounds.width, cell_style: {
          size: DEFAULT_FONT_SIZE - 1,
          padding: [4, 6, 4, 6],
          border_width: 0.5,
          border_color: "999999"
        })
      rescue StandardError => e
        # Fallback: render as plain text
        Rails.logger.warn "[DocxToPdfConverter] Table render failed: #{e.message}"
        rows_data.each { |row| pdf.text row.join(" | "), size: DEFAULT_FONT_SIZE - 1 }
      end
      pdf.move_down 5
    end

    def parse_alignment(val)
      case val
      when "center" then :center
      when "right" then :right
      when "both", "justify" then :justify
      else :left
      end
    end
  end
end
