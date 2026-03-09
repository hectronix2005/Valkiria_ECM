# frozen_string_literal: true

class GotenbergPdfRetryJob < ApplicationJob
  queue_as :default

  # Exponential backoff: ~30s, ~1m, ~2.5m, ~5m, ~10m, ~20m, ~40m, ~1h20m, ~2h40m, ~5h
  retry_on StandardError, wait: :polynomially_longer, attempts: 10

  discard_on Mongoid::Errors::DocumentNotFound

  def perform(document_id)
    doc = Templates::GeneratedDocument.find(document_id)

    if doc.pdf_generation_status == "completed"
      log_info "Document #{document_id} already has PDF — skipping"
      return
    end

    unless doc.docx_file_id.present?
      log_info "Document #{document_id} has no stored DOCX — skipping"
      return
    end

    tmp_file = Tempfile.new(["retry_docx", ".docx"])
    tmp_file.binmode

    begin
      docx_data = Mongoid::GridFs.get(doc.docx_file_id).data
      tmp_file.write(docx_data)
      tmp_file.close

      # Pass template page dimensions for consistent PDF output
      page_size = if doc.template&.pdf_width && doc.template&.pdf_height
                    { width_pts: doc.template.pdf_width, height_pts: doc.template.pdf_height }
                  end
      pdf_bytes = Templates::GotenbergConversionService.convert_with_retries(tmp_file.path, page_size: page_size)

      if pdf_bytes
        doc.store_pdf_from_sync!(pdf_bytes)
        doc.run_integrity_check!(trigger: Templates::DocumentIntegrityService::TRIGGER_POST_GENERATION)
        log_info "PDF generated successfully for document #{document_id} (#{pdf_bytes.bytesize} bytes)"
      else
        raise "Gotenberg conversion returned nil for document #{document_id}"
      end
    ensure
      tmp_file.close unless tmp_file.closed?
      tmp_file.unlink
    end
  end
end
