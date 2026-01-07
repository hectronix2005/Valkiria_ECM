# frozen_string_literal: true

module Templates
  class PdfSignatureService
    def initialize(generated_document)
      @generated_document = generated_document
    end

    # Apply all collected signatures to the PDF
    def apply_all_signatures!
      return unless @generated_document.all_required_signed?

      pdf_content = @generated_document.file_content
      raise SignatureError, "No se pudo leer el PDF" unless pdf_content

      # Create working files
      input_pdf = Tempfile.new(["input", ".pdf"])
      input_pdf.binmode
      input_pdf.write(pdf_content)
      input_pdf.rewind

      begin
        # Load the PDF
        pdf = CombinePDF.load(input_pdf.path)
        last_page = pdf.pages.last

        # Apply each signature
        @generated_document.signed_signatories.each do |sig_entry|
          apply_signature_to_page(last_page, sig_entry)
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

    def apply_signature_to_page(page, sig_entry)
      # Get signature data
      signature = find_signature(sig_entry["signature_id"])
      return unless signature

      signatory = find_signatory(sig_entry["signatory_id"])
      return unless signatory

      # Get signature as PNG image
      image_data = get_signature_image(signature)
      return unless image_data

      # Create signature overlay using Prawn
      overlay_pdf = create_signature_overlay(
        image_data: image_data,
        signatory: signatory,
        sig_entry: sig_entry,
        page_width: page.mediabox[2],
        page_height: page.mediabox[3]
      )

      # Merge overlay onto page
      overlay = CombinePDF.parse(overlay_pdf)
      page << overlay.pages.first
    end

    def find_signature(signature_uuid)
      Identity::UserSignature.find_by(uuid: signature_uuid)
    end

    def find_signatory(signatory_uuid)
      return nil unless @generated_document.template

      @generated_document.template.signatories.find_by(uuid: signatory_uuid)
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

    def create_signature_overlay(image_data:, signatory:, sig_entry:, page_width:, page_height:)
      # Get position from signatory config
      box = signatory.signature_box
      x = box[:x]
      y = box[:y]  # y from top of document
      width = box[:width]
      height = box[:height]

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

        # Draw signature image at absolute position
        pdf.image img_file.path, at: [x, y_from_bottom + height], fit: [width, height - 25]

        # Add label below signature
        label_y = y_from_bottom + 20
        pdf.draw_text signatory.label, at: [x + (width / 2) - 40, label_y], size: 8

        # Add date
        date_y = y_from_bottom + 8
        pdf.fill_color "666666"
        pdf.draw_text "Firmado: #{format_date(sig_entry['signed_at'])}", at: [x + (width / 2) - 50, date_y], size: 7
        pdf.fill_color "000000"

        pdf.render
      ensure
        img_file.close
        img_file.unlink
      end
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
