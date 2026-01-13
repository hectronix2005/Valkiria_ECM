# frozen_string_literal: true

module Templates
  class PdfSignatureService
    def initialize(generated_document)
      @generated_document = generated_document
    end

    # Apply all collected signatures to the PDF
    # Always reads from draft_file_id to avoid double-applying signatures
    def apply_all_signatures!
      return unless @generated_document.all_required_signed?

      # Always read from draft (original PDF without signatures)
      # This prevents double-application when apply_signature_to_pdf! was called earlier
      pdf_content = read_draft_pdf
      raise SignatureError, "No se pudo leer el PDF draft" unless pdf_content

      # Create working files
      input_pdf = Tempfile.new(["input", ".pdf"])
      input_pdf.binmode
      input_pdf.write(pdf_content)
      input_pdf.rewind

      begin
        # Load the PDF
        pdf = CombinePDF.load(input_pdf.path)
        pages = pdf.pages
        total_pages = pages.count

        # Get actual PDF page height
        actual_page_height = pages.first&.mediabox&.dig(3) || 792.0

        # Get template's stored preview page height (used when coordinates were captured)
        template = @generated_document.template
        preview_page_height = template&.preview_page_height || 792.0

        # Calculate scale factor if template preview height differs from actual PDF
        # This handles cases where the preview was at a different scale than the actual PDF
        scale_factor = actual_page_height / preview_page_height

        Rails.logger.info "PDF rendering: actual_page_height=#{actual_page_height}, preview_page_height=#{preview_page_height}, scale_factor=#{scale_factor}"

        # Apply each signature to the correct page
        @generated_document.signed_signatories.each do |sig_entry|
          signatory = find_signatory(sig_entry["signatory_id"])
          next unless signatory

          # Get stored coordinates (captured at preview_page_height scale)
          stored_y = signatory.y_position || 0

          # Scale coordinates to actual PDF dimensions
          absolute_y = stored_y * scale_factor

          # Calculate which page this Y coordinate falls on (0-indexed)
          calculated_page_index = (absolute_y / actual_page_height).floor

          # Clamp to valid range
          page_index = [[calculated_page_index, 0].max, total_pages - 1].min
          target_page = pages[page_index]

          Rails.logger.info "Signature #{signatory.label}: stored_y=#{stored_y}, absolute_y=#{absolute_y}, page_height=#{actual_page_height}, calculated_page=#{calculated_page_index + 1}, actual_page=#{page_index + 1}"

          apply_signature_to_page(target_page, sig_entry, page_index, actual_page_height)
        end

        # Save the final PDF
        output_pdf = Tempfile.new(["signed", ".pdf"])
        pdf.save(output_pdf.path)

        # Store in GridFS
        store_final_pdf(File.read(output_pdf.path))
      ensure
        input_pdf.close
        input_pdf.unlink
        output_pdf&.close
        output_pdf&.unlink
      end
    end

    # Apply a single signature when it's added
    def apply_single_signature!(signature, signatory)
      # For now, signatures are collected and applied all at once
      # This method could be used for real-time preview
      true
    end

    private

    def apply_signature_to_page(page, sig_entry, page_index, page_height)
      # Get signature data
      signature = find_signature(sig_entry["signature_id"])
      return unless signature

      signatory = find_signatory(sig_entry["signatory_id"])
      return unless signatory

      # Get signature as PNG image
      image_data = get_signature_image(signature)
      return unless image_data

      # Log signature placement for debugging
      Rails.logger.info "Applying signature for #{signatory.label} to page #{page_index + 1} at position (#{signatory.x_position}, #{signatory.y_position})"

      # Create signature overlay using Prawn
      overlay_pdf = create_signature_overlay(
        image_data: image_data,
        signatory: signatory,
        sig_entry: sig_entry,
        page_width: page.mediabox[2],
        page_height: page_height,
        target_page_index: page_index
      )

      # Merge overlay onto page
      overlay = CombinePDF.parse(overlay_pdf)
      page << overlay.pages.first
    end

    def find_signature(signature_uuid)
      return nil if signature_uuid.blank?

      Identity::UserSignature.where(uuid: signature_uuid).first
    end

    def find_signatory(signatory_uuid)
      return nil if signatory_uuid.blank?
      return nil unless @generated_document.template

      @generated_document.template.signatories.where(uuid: signatory_uuid).first
    end

    def get_signature_image(signature)
      renderer = SignatureRendererService.new(signature)
      tempfile = renderer.to_tempfile

      begin
        File.read(tempfile.path)
      ensure
        tempfile.close
        tempfile.unlink
      end
    end

    def create_signature_overlay(image_data:, signatory:, sig_entry:, page_width:, page_height:, target_page_index:)
      # Get position from signatory config
      box = signatory.signature_box
      x = box[:x]
      absolute_y = box[:y]  # y from top of ENTIRE document (absolute coordinate)
      width = box[:width]
      height = box[:height]
      show_label = box[:show_label].nil? ? true : box[:show_label]
      show_signer_name = box[:show_signer_name] || false
      date_position = box[:date_position] || "right"

      # Convert absolute Y to per-page Y coordinate
      # absolute_y is the distance from top of the entire document
      # We need to convert it to distance from top of the specific page
      y = absolute_y - (target_page_index * page_height)

      Rails.logger.info "Signature placement: absolute_y=#{absolute_y}, page_index=#{target_page_index}, page_height=#{page_height}, y_on_page=#{y}"

      # Create temp image file
      img_file = Tempfile.new(["sig", ".png"])
      img_file.binmode
      img_file.write(image_data)
      img_file.rewind

      begin
        pdf = Prawn::Document.new(
          page_size: [page_width, page_height],
          margin: 0,
          skip_page_creation: false
        )

        # Calculate position from bottom (Prawn uses bottom-left origin)
        # y_from_top = 700 means the signature box TOP is 700pt from page top
        # So bottom of signature box is at: page_height - y - height
        y_from_bottom = page_height - y - height

        # Calculate text space needed
        text_lines = 0
        text_lines += 1 if show_label
        text_lines += 1 if show_signer_name
        text_lines += 1 if date_position != "none"
        text_space = text_lines * 12

        # Draw signature image at absolute position
        pdf.image img_file.path, at: [x, y_from_bottom + height], fit: [width, height - text_space]

        # Add optional elements below signature
        current_y = y_from_bottom + text_space - 5

        if show_label
          pdf.draw_text signatory.label, at: [x + (width / 2) - 40, current_y], size: 8
          current_y -= 12
        end

        if show_signer_name && sig_entry["signed_by_name"].present?
          pdf.fill_color "333333"
          pdf.draw_text "Firmado por: #{sig_entry['signed_by_name']}", at: [x + (width / 2) - 50, current_y], size: 7
          pdf.fill_color "000000"
          current_y -= 12
        end

        if date_position != "none"
          pdf.fill_color "666666"
          pdf.draw_text "Firmado: #{format_date(sig_entry['signed_at'])}", at: [x + (width / 2) - 50, current_y], size: 7
          pdf.fill_color "000000"
        end

        pdf.render
      ensure
        img_file.close
        img_file.unlink
      end
    end

    # Read the original draft PDF (without any signatures applied)
    # Uses original_draft_file_id if available, falls back to draft_file_id
    def read_draft_pdf
      # Prefer original_draft_file_id (clean PDF without any signatures)
      file_id = @generated_document.original_draft_file_id || @generated_document.draft_file_id
      return nil unless file_id

      file = Mongoid::GridFs.get(file_id)
      file.data
    rescue StandardError => e
      Rails.logger.error "Error reading draft PDF: #{e.message}"
      nil
    end

    def store_final_pdf(pdf_content)
      file_name = @generated_document.file_name.sub(".pdf", "-firmado.pdf")
      pdf_file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: file_name,
        content_type: "application/pdf"
      )

      @generated_document.update!(final_file_id: pdf_file.id)
    end

    def format_date(date_string)
      return "" unless date_string

      Time.parse(date_string).strftime("%d/%m/%Y %H:%M")
    rescue StandardError
      date_string.to_s
    end

    class SignatureError < StandardError; end
  end
end
