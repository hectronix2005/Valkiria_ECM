# frozen_string_literal: true

module Templates
  # Validates document integrity after generation and after each signature.
  # Non-blocking by design — a top-level rescue ensures the agent never
  # breaks the generation or signing flow. Results are persisted via
  # atomic `set()` to avoid Mongoid callbacks.
  class DocumentIntegrityService
    TRIGGERS = %w[post_generation post_signature].freeze
    MAX_FILE_SIZE_DOCX = 50.megabytes
    MAX_FILE_SIZE_PDF  = 100.megabytes
    VARIABLE_PATTERN   = /\{\{[^}]+\}\}/
    # Standard PDF page dimensions (US Letter in points)
    MAX_PAGE_WIDTH  = 1200
    MAX_PAGE_HEIGHT = 2000

    def initialize(document, trigger:)
      @document = document
      @trigger  = trigger.to_s
      @results  = []
    end

    def run!
      unless TRIGGERS.include?(@trigger)
        Rails.logger.warn("[DocumentIntegrity] Unknown trigger: #{@trigger}")
        return
      end

      case @trigger
      when "post_generation" then run_post_generation_checks
      when "post_signature"  then run_post_signature_checks
      end

      persist_results!
    rescue StandardError => e
      Rails.logger.error("[DocumentIntegrity] Unhandled error for doc #{@document.id}: #{e.message}")
      Rails.logger.error(e.backtrace.first(5).join("\n"))
    end

    private

    # ── Post-generation checks ──────────────────────────────────────────

    def run_post_generation_checks
      check_file_exists
      check_file_not_empty
      check_content_type
      check_file_size
      check_docx_structure
      check_variables_replaced
      check_signatures_init
    end

    # ── Post-signature checks ───────────────────────────────────────────

    def run_post_signature_checks
      check_file_exists
      check_file_not_empty
      check_signature_entries
      check_sig_positions
      check_signing_order
      check_sig_images
    end

    # ── Individual checks ───────────────────────────────────────────────

    def check_file_exists
      file_id = @document.current_file_id
      unless file_id.present?
        return record(:file_exists, :failed, "No file ID present on document")
      end

      Mongoid::GridFs.get(file_id)
      record(:file_exists, :passed, "File exists in GridFS")
    rescue Mongoid::Errors::DocumentNotFound
      record(:file_exists, :failed, "File #{file_id} not found in GridFS")
    end

    def check_file_not_empty
      file_id = @document.current_file_id
      return record(:file_not_empty, :failed, "No file ID") unless file_id.present?

      file = Mongoid::GridFs.get(file_id)
      size = file.length

      if size.zero?
        record(:file_not_empty, :failed, "File is 0 bytes")
      elsif size < 100
        record(:file_not_empty, :warning, "File is only #{size} bytes — possibly corrupt")
      else
        record(:file_not_empty, :passed, "File size: #{size} bytes")
      end
    rescue StandardError => e
      record(:file_not_empty, :failed, "Could not read file: #{e.message}")
    end

    def check_content_type
      fname = @document.file_name.to_s
      file_id = @document.current_file_id
      return record(:content_type, :warning, "No file to check") unless file_id.present?

      file = Mongoid::GridFs.get(file_id)
      ct = file.content_type.to_s

      expected = if fname.end_with?(".pdf")
                   "application/pdf"
                 elsif fname.end_with?(".docx")
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                 end

      if expected.nil?
        record(:content_type, :warning, "Unknown file extension for #{fname}")
      elsif ct.include?(expected) || ct.include?("octet-stream")
        record(:content_type, :passed, "Content-Type #{ct} matches #{fname}")
      else
        record(:content_type, :warning, "Content-Type #{ct} does not match expected #{expected} for #{fname}")
      end
    rescue StandardError => e
      record(:content_type, :warning, "Could not verify content type: #{e.message}")
    end

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
        record(:file_size, :passed, "File size #{size} bytes within limits")
      end
    rescue StandardError => e
      record(:file_size, :warning, "Could not check file size: #{e.message}")
    end

    def check_docx_structure
      fname = @document.file_name.to_s
      return record(:docx_structure, :passed, "Not a DOCX file — skipping") unless fname.end_with?(".docx")

      content = @document.file_content
      return record(:docx_structure, :failed, "Could not read file content") unless content

      # DOCX files are ZIP archives — check for the required entry
      io = StringIO.new(content)
      Zip::File.open_buffer(io) do |zip|
        entry = zip.find_entry("word/document.xml")
        if entry
          record(:docx_structure, :passed, "Valid DOCX: word/document.xml present")
        else
          record(:docx_structure, :failed, "Invalid DOCX: word/document.xml missing")
        end
      end
    rescue Zip::Error => e
      record(:docx_structure, :failed, "Invalid ZIP/DOCX structure: #{e.message}")
    rescue StandardError => e
      record(:docx_structure, :failed, "DOCX structure check error: #{e.message}")
    end

    def check_variables_replaced
      fname = @document.file_name.to_s
      return record(:variables_replaced, :passed, "Not a DOCX — skipping") unless fname.end_with?(".docx")

      content = @document.file_content
      return record(:variables_replaced, :warning, "Could not read content") unless content

      # Extract text from DOCX to look for unreplaced variables
      io = StringIO.new(content)
      text = ""
      Zip::File.open_buffer(io) do |zip|
        entry = zip.find_entry("word/document.xml")
        text = entry.get_input_stream.read if entry
      end

      remaining = text.scan(VARIABLE_PATTERN).flatten
      if remaining.empty?
        record(:variables_replaced, :passed, "No unreplaced variables found")
      else
        record(:variables_replaced, :warning, "Unreplaced variables: #{remaining.uniq.first(10).join(', ')}")
      end
    rescue StandardError => e
      record(:variables_replaced, :warning, "Variable check error: #{e.message}")
    end

    def check_signatures_init
      template = @document.template
      return record(:signatures_init, :passed, "No template — skipping") unless template

      expected = template.signatories.count
      actual = @document.signatures.size

      if actual == expected
        record(:signatures_init, :passed, "#{actual} signature slots match template (#{expected})")
      else
        record(:signatures_init, :failed, "Document has #{actual} slots but template defines #{expected}")
      end
    rescue StandardError => e
      record(:signatures_init, :failed, "Signature init check error: #{e.message}")
    end

    def check_signature_entries
      signed = @document.signatures.select { |s| s["status"] == "signed" }
      issues = []

      signed.each_with_index do |entry, i|
        label = entry["signatory_label"] || "Slot #{i + 1}"
        issues << "#{label}: missing signed_at" if entry["signed_at"].blank?
        issues << "#{label}: missing signature_id" if entry["signature_id"].blank?
      end

      if issues.empty?
        record(:signature_entries, :passed, "All #{signed.size} signed entries have required fields")
      else
        record(:signature_entries, :warning, issues.first(5).join("; "))
      end
    end

    def check_sig_positions
      template = @document.template
      return record(:sig_positions, :passed, "No template — skipping") unless template

      issues = []
      template.signatories.each do |sig|
        label = sig.label || sig.role
        x = sig.x_position.to_f
        y = sig.y_position.to_f

        issues << "#{label}: x=#{x} out of range" if x.negative? || x > MAX_PAGE_WIDTH
        issues << "#{label}: y=#{y} out of range" if y.negative? || y > MAX_PAGE_HEIGHT
      end

      if issues.empty?
        record(:sig_positions, :passed, "All signature positions within page bounds")
      else
        record(:sig_positions, :warning, issues.first(5).join("; "))
      end
    rescue StandardError => e
      record(:sig_positions, :warning, "Position check error: #{e.message}")
    end

    def check_signing_order
      return record(:signing_order, :passed, "Sequential signing disabled") unless @document.sequential_signing?

      signed = @document.signatures.select { |s| s["status"] == "signed" }
      return record(:signing_order, :passed, "No signatures applied yet") if signed.empty?

      # Verify signed entries are contiguous from the start (no gaps in required sigs)
      sigs = @document.signatures
      last_signed_index = -1
      violation = nil

      sigs.each_with_index do |entry, i|
        if entry["status"] == "signed"
          # If there's a required unsigned entry before this signed one, order is broken
          if i > last_signed_index + 1
            gap_entries = sigs[(last_signed_index + 1)...i]
            unsigned_required = gap_entries.select { |e| e["required"] && e["status"] != "signed" }
            if unsigned_required.any?
              labels = unsigned_required.map { |e| e["signatory_label"] || "unknown" }.join(", ")
              violation = "Signed at position #{i + 1} but required slot(s) #{labels} were skipped"
              break
            end
          end
          last_signed_index = i
        end
      end

      if violation
        record(:signing_order, :failed, violation)
      else
        record(:signing_order, :passed, "Sequential signing order respected")
      end
    end

    def check_sig_images
      signed = @document.signatures.select { |s| s["status"] == "signed" && s["signature_id"].present? }
      return record(:sig_images, :passed, "No signed entries to check") if signed.empty?

      missing = []
      signed.each do |entry|
        sig = ::Identity::UserSignature.where(uuid: entry["signature_id"]).first
        label = entry["signatory_label"] || "unknown"

        if sig.nil?
          missing << "#{label}: UserSignature not found"
        elsif sig.drawn? && sig.image_data.blank?
          missing << "#{label}: drawn signature has no image data"
        elsif sig.styled? && sig.styled_text.blank?
          missing << "#{label}: styled signature has no text"
        end
      end

      if missing.empty?
        record(:sig_images, :passed, "All #{signed.size} signatures have image data")
      else
        record(:sig_images, :warning, missing.first(5).join("; "))
      end
    end

    # ── Helpers ──────────────────────────────────────────────────────────

    def record(check_name, severity, message)
      @results << {
        "check" => check_name.to_s,
        "severity" => severity.to_s,
        "message" => message.to_s.truncate(500),
        "trigger" => @trigger,
        "at" => Time.current.iso8601
      }
    end

    def persist_results!
      overall = compute_overall_status
      now = Time.current

      # Append new results to existing checks, capping at MAX_INTEGRITY_CHECKS
      existing = @document.integrity_checks || []
      combined = (existing + @results).last(IntegrityCheckable::MAX_INTEGRITY_CHECKS)

      # Use atomic set to avoid callbacks
      @document.set(
        integrity_status: overall,
        integrity_checks: combined,
        last_integrity_check_at: now
      )

      log_issues(overall)
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
          checks: issues.size
        }
      )
    end
  end
end
