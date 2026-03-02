# frozen_string_literal: true

require "zip"

module Templates
  # Non-blocking integrity agent for generated documents.
  #
  # Runs automatically after every document generation and every signature
  # application. Validates file integrity, format correctness, variable
  # replacement, and signature consistency.
  #
  # Design principles:
  #   1. **Never break the happy path** — triple-layered rescue (service → concern → caller)
  #   2. **Atomic persistence** — uses MongoDB $push + $slice to avoid race conditions
  #   3. **Lightweight** — reads GridFS metadata, not full file content (except DOCX structure)
  #   4. **Self-logging** — failures/warnings are recorded in ErrorLog for the dashboard
  #
  # Usage:
  #   DocumentIntegrityService.new(doc, trigger: TRIGGER_POST_GENERATION).call
  #   # or via convenience method:
  #   doc.run_integrity_check!(trigger: "post_generation")
  class DocumentIntegrityService
    # ── Trigger constants ────────────────────────────────────────────────
    TRIGGER_POST_GENERATION = "post_generation"
    TRIGGER_POST_SIGNATURE  = "post_signature"
    TRIGGERS = [TRIGGER_POST_GENERATION, TRIGGER_POST_SIGNATURE].freeze

    # ── Thresholds ───────────────────────────────────────────────────────
    MIN_FILE_SIZE      = 100           # bytes — anything under this is likely corrupt
    MAX_FILE_SIZE_DOCX = 50.megabytes
    MAX_FILE_SIZE_PDF  = 100.megabytes

    # Page dimension bounds (generous to accommodate various paper sizes)
    MAX_PAGE_WIDTH  = 1200  # points (~16.7 inches)
    MAX_PAGE_HEIGHT = 2000  # points (~27.8 inches)

    # MIME types
    DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    PDF_CONTENT_TYPE  = "application/pdf"

    # Pattern to detect unreplaced template variables.
    # Excludes matches containing XML tags (false positives from fragmented Word runs).
    VARIABLE_PATTERN = /\{\{([^}<>]+)\}\}/

    def initialize(document, trigger:)
      @document = document
      @trigger  = trigger.to_s
      @results  = []
    end

    # Public entry point. Returns the computed overall status string.
    def call
      unless TRIGGERS.include?(@trigger)
        Rails.logger.warn("[DocumentIntegrity] Unknown trigger: #{@trigger}")
        return nil
      end

      case @trigger
      when TRIGGER_POST_GENERATION then run_post_generation_checks
      when TRIGGER_POST_SIGNATURE  then run_post_signature_checks
      end

      persist_results!
    rescue StandardError => e
      Rails.logger.error("[DocumentIntegrity] Unhandled error for doc #{@document.id}: #{e.message}")
      Rails.logger.error(e.backtrace.first(5).join("\n"))
      nil
    end

    private

    # ── Post-generation checks (7) ───────────────────────────────────────

    def run_post_generation_checks
      check_file_exists
      check_file_not_empty
      check_content_type
      check_file_size
      check_docx_structure
      check_variables_replaced
      check_signatures_init
    end

    # ── Post-signature checks (6) ────────────────────────────────────────

    def run_post_signature_checks
      check_file_exists
      check_file_not_empty
      check_signature_entries
      check_sig_positions
      check_signing_order
      check_sig_images
    end

    # ── Individual checks ────────────────────────────────────────────────

    # [FAILED] Verifies that a file ID is present and the file exists in GridFS.
    def check_file_exists
      file_id = @document.current_file_id
      unless file_id.present?
        return record(:file_exists, :failed, "No file ID present on document")
      end

      file = Mongoid::GridFs.get(file_id)
      record(:file_exists, :passed, "File #{file_id} exists in GridFS (#{file.length} bytes)")
    rescue Mongoid::Errors::DocumentNotFound
      record(:file_exists, :failed, "File #{file_id} not found in GridFS")
    end

    # [FAILED/WARN] Verifies the file has meaningful content (> 0, > MIN_FILE_SIZE bytes).
    def check_file_not_empty
      file_id = @document.current_file_id
      return record(:file_not_empty, :failed, "No file ID") unless file_id.present?

      file = Mongoid::GridFs.get(file_id)
      size = file.length

      if size.zero?
        record(:file_not_empty, :failed, "File is 0 bytes")
      elsif size < MIN_FILE_SIZE
        record(:file_not_empty, :warning, "File is only #{size} bytes — possibly corrupt")
      else
        record(:file_not_empty, :passed, "File size: #{size} bytes")
      end
    rescue StandardError => e
      record(:file_not_empty, :failed, "Could not read file: #{e.message}")
    end

    # [WARN] Verifies the GridFS content type matches the file extension.
    def check_content_type
      fname = @document.file_name.to_s
      file_id = @document.current_file_id
      return record(:content_type, :warning, "No file to check") unless file_id.present?

      file = Mongoid::GridFs.get(file_id)
      actual_ct = file.content_type.to_s

      expected_ct = if fname.end_with?(".pdf")
                      PDF_CONTENT_TYPE
                    elsif fname.end_with?(".docx")
                      DOCX_CONTENT_TYPE
                    end

      if expected_ct.nil?
        record(:content_type, :warning, "Unknown file extension: #{fname}")
      elsif actual_ct.include?(expected_ct) || actual_ct.include?("octet-stream")
        record(:content_type, :passed, "Content-Type '#{actual_ct}' matches #{fname}")
      else
        record(:content_type, :warning, "Content-Type '#{actual_ct}' does not match expected '#{expected_ct}' for #{fname}")
      end
    rescue StandardError => e
      record(:content_type, :warning, "Could not verify content type: #{e.message}")
    end

    # [WARN] Verifies the file is under the size limit for its type.
    def check_file_size
      file_id = @document.current_file_id
      return record(:file_size, :warning, "No file to check") unless file_id.present?

      file = Mongoid::GridFs.get(file_id)
      size = file.length
      fname = @document.file_name.to_s
      limit = fname.end_with?(".pdf") ? MAX_FILE_SIZE_PDF : MAX_FILE_SIZE_DOCX

      if size > limit
        record(:file_size, :warning, "File #{size} bytes exceeds #{limit / 1.megabyte}MB limit")
      else
        record(:file_size, :passed, "File size #{size} bytes within #{limit / 1.megabyte}MB limit")
      end
    rescue StandardError => e
      record(:file_size, :warning, "Could not check file size: #{e.message}")
    end

    # [FAILED] Verifies DOCX is a valid ZIP archive containing word/document.xml.
    def check_docx_structure
      fname = @document.file_name.to_s
      return record(:docx_structure, :passed, "Not a DOCX file — skipping") unless fname.end_with?(".docx")

      content = @document.file_content
      return record(:docx_structure, :failed, "Could not read file content") unless content

      io = StringIO.new(content)
      Zip::File.open_buffer(io) do |zip|
        if zip.find_entry("word/document.xml")
          record(:docx_structure, :passed, "Valid DOCX: word/document.xml present")
        else
          record(:docx_structure, :failed, "Invalid DOCX: word/document.xml missing from ZIP")
        end
      end
    rescue Zip::Error => e
      record(:docx_structure, :failed, "Invalid ZIP/DOCX structure: #{e.message}")
    rescue StandardError => e
      record(:docx_structure, :failed, "DOCX structure check error: #{e.message}")
    end

    # [WARN] Scans DOCX XML for remaining {{variable}} patterns that weren't replaced.
    # Filters out false positives where the match contains XML tags (fragmented runs).
    def check_variables_replaced
      fname = @document.file_name.to_s
      return record(:variables_replaced, :passed, "Not a DOCX — skipping") unless fname.end_with?(".docx")

      content = @document.file_content
      return record(:variables_replaced, :warning, "Could not read content") unless content

      xml_text = extract_docx_xml(content)
      return record(:variables_replaced, :warning, "Could not extract document XML") if xml_text.nil?

      # Scan for {{variable}} patterns, filtering out XML-fragmented false positives
      remaining = xml_text.scan(VARIABLE_PATTERN).flatten.select do |var_name|
        # Skip if the captured name contains XML elements — those are fragmented runs,
        # not real unreplaced variables
        !var_name.include?("</") && !var_name.include?("/>")
      end

      if remaining.empty?
        record(:variables_replaced, :passed, "No unreplaced variables found")
      else
        names = remaining.uniq.first(10).join(", ")
        record(:variables_replaced, :warning, "#{remaining.uniq.size} unreplaced variable(s): #{names}")
      end
    rescue StandardError => e
      record(:variables_replaced, :warning, "Variable check error: #{e.message}")
    end

    # [FAILED] Verifies signature slot count matches the template's signatory count.
    def check_signatures_init
      template = @document.template
      return record(:signatures_init, :passed, "No template — skipping") unless template

      expected = template.signatories.count
      actual = @document.signatures.size

      if actual == expected
        record(:signatures_init, :passed, "#{actual} signature slot(s) match template (#{expected} signatories)")
      else
        record(:signatures_init, :failed, "Document has #{actual} slot(s) but template defines #{expected} signatory(ies)")
      end
    rescue StandardError => e
      record(:signatures_init, :failed, "Signature init check error: #{e.message}")
    end

    # [WARN] Verifies all signed entries have signed_at and signature_id populated.
    def check_signature_entries
      signed = @document.signatures.select { |s| s["status"] == "signed" }
      return record(:signature_entries, :passed, "No signed entries yet") if signed.empty?

      issues = []
      signed.each_with_index do |entry, i|
        label = entry["signatory_label"] || entry["label"] || "Slot #{i + 1}"
        issues << "#{label}: missing signed_at" if entry["signed_at"].blank?
        issues << "#{label}: missing signature_id" if entry["signature_id"].blank?
      end

      if issues.empty?
        record(:signature_entries, :passed, "All #{signed.size} signed entries have signed_at + signature_id")
      else
        record(:signature_entries, :warning, issues.first(5).join("; "))
      end
    end

    # [WARN] Verifies signature position boxes are within page dimension bounds.
    # Uses a 10pt tolerance for rounding.
    def check_sig_positions
      template = @document.template
      return record(:sig_positions, :passed, "No template — skipping") unless template

      tolerance = 10 # points
      issues = []

      template.signatories.each do |sig|
        label = sig.label || sig.role || "unknown"
        x = sig.x_position.to_f
        y = sig.y_position.to_f

        issues << "#{label}: x=#{x} out of range" if x < -tolerance || x > MAX_PAGE_WIDTH + tolerance
        issues << "#{label}: y=#{y} out of range" if y < -tolerance || y > MAX_PAGE_HEIGHT + tolerance
      end

      if issues.empty?
        record(:sig_positions, :passed, "All #{template.signatories.count} signature positions within page bounds")
      else
        record(:sig_positions, :warning, issues.first(5).join("; "))
      end
    rescue StandardError => e
      record(:sig_positions, :warning, "Position check error: #{e.message}")
    end

    # [FAILED] Verifies sequential signing order is respected (no gaps in required signatures).
    def check_signing_order
      return record(:signing_order, :passed, "Sequential signing disabled") unless @document.sequential_signing?

      signed = @document.signatures.select { |s| s["status"] == "signed" }
      return record(:signing_order, :passed, "No signatures applied yet") if signed.empty?

      sigs = @document.signatures
      last_signed_index = -1
      violation = nil

      sigs.each_with_index do |entry, i|
        next unless entry["status"] == "signed"

        # Check for unsigned required entries between the last signed and this one
        if i > last_signed_index + 1
          gap = sigs[(last_signed_index + 1)...i]
          unsigned_required = gap.select { |e| e["required"] && e["status"] != "signed" }
          if unsigned_required.any?
            labels = unsigned_required.map { |e| e["signatory_label"] || e["label"] || "unknown" }.join(", ")
            violation = "Position #{i + 1} signed but required slot(s) [#{labels}] were skipped"
            break
          end
        end
        last_signed_index = i
      end

      if violation
        record(:signing_order, :failed, violation)
      else
        record(:signing_order, :passed, "Sequential signing order respected (#{signed.size} signed)")
      end
    end

    # [WARN] Verifies each signed entry's UserSignature record has image/text data.
    def check_sig_images
      signed = @document.signatures.select { |s| s["status"] == "signed" && s["signature_id"].present? }
      return record(:sig_images, :passed, "No signed entries to check") if signed.empty?

      missing = []
      signed.each do |entry|
        sig = ::Identity::UserSignature.where(uuid: entry["signature_id"]).first
        label = entry["signatory_label"] || entry["label"] || "unknown"

        if sig.nil?
          missing << "#{label}: UserSignature record not found (uuid: #{entry['signature_id']})"
        elsif sig.drawn? && sig.image_data.blank?
          missing << "#{label}: drawn signature has no image_data"
        elsif sig.styled? && sig.styled_text.blank?
          missing << "#{label}: styled signature has no styled_text"
        end
      end

      if missing.empty?
        record(:sig_images, :passed, "All #{signed.size} signature(s) have valid image data")
      else
        record(:sig_images, :warning, missing.first(5).join("; "))
      end
    end

    # ── Helpers ──────────────────────────────────────────────────────────

    # Extract word/document.xml text from a DOCX binary string.
    def extract_docx_xml(content)
      io = StringIO.new(content)
      text = nil
      Zip::File.open_buffer(io) do |zip|
        entry = zip.find_entry("word/document.xml")
        text = entry.get_input_stream.read if entry
      end
      text
    rescue StandardError
      nil
    end

    def record(check_name, severity, message)
      @results << {
        "check"    => check_name.to_s,
        "severity" => severity.to_s,
        "message"  => message.to_s.truncate(500),
        "trigger"  => @trigger,
        "at"       => Time.current.iso8601
      }
    end

    # Persist check results atomically using MongoDB $push with $slice
    # to avoid read-modify-write race conditions.
    def persist_results!
      overall = compute_overall_status

      collection = @document.class.collection
      collection.update_one(
        { "_id" => @document.id },
        {
          "$push" => {
            "integrity_checks" => {
              "$each"  => @results,
              "$slice" => -IntegrityCheckable::MAX_INTEGRITY_CHECKS
            }
          },
          "$set" => {
            "integrity_status"        => overall,
            "last_integrity_check_at" => Time.current
          }
        }
      )

      # Sync in-memory state so the caller sees updated values
      @document.reload

      log_issues(overall)
      overall
    end

    def compute_overall_status
      severities = @results.map { |r| r["severity"] }

      if severities.include?("failed")
        "failed"
      elsif severities.include?("warning")
        "warning"
      else
        "passed"
      end
    end

    # Log non-passing results to ErrorLog for the admin dashboard.
    def log_issues(overall)
      return if overall == "passed"

      issues = @results.reject { |r| r["severity"] == "passed" }
      summary = issues.map { |r| "#{r['check']}(#{r['severity']}): #{r['message']}" }.join(" | ")

      severity = overall == "failed" ? "error" : "warning"

      ErrorLoggingService.log_service_event(
        "Document integrity #{overall}: #{summary}",
        service: "Templates::DocumentIntegrityService",
        severity: severity,
        metadata: {
          document_id: @document.id.to_s,
          document_uuid: @document.uuid,
          trigger: @trigger,
          total_checks: @results.size,
          failed_checks: issues.size
        }
      )
    end
  end
end
