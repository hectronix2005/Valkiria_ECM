# frozen_string_literal: true

# =============================================================
# Valkyria ECM — SignatureGuardianAgent
# Validates signature integrity on GeneratedDocument's embedded
# signatures[] array.
#
# When receiving a non-GeneratedDocument model (e.g. Legal::Contract),
# resolves the associated GeneratedDocument via source_type/source_id.
#
# Triggers:
#   templates/generated_document.updated
#   templates/generated_document.status_changed
#   identity/user_signature.created / .updated
#   legal/contract.created / .status_changed
# =============================================================
class SignatureGuardianAgent < BaseAgent

  private

  # -----------------------------------------------------------
  # Resolve the GeneratedDocument to inspect
  # -----------------------------------------------------------
  def resolved_document
    @resolved_document ||= resolve_generated_document
  end

  def resolve_generated_document
    return document if document.is_a?(::Templates::GeneratedDocument)

    # For other models (Contract, etc.), find the associated GeneratedDocument
    ::Templates::GeneratedDocument.where(
      source_type: document.class.name,
      source_id: document.id
    ).first
  end

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  def run_checks
    doc = resolved_document
    return if doc.nil?

    sigs = doc.signatures
    return if sigs.blank?

    check_signatures_complete(doc, sigs)
    check_signature_order(doc, sigs)
    check_identity_consistency(sigs)
    check_signature_references(sigs)
    check_missing_signature_id(sigs)
    check_status_consistency(doc, sigs)
    check_docx_with_signatures(doc, sigs)
    check_signature_placement(doc, sigs)
    check_coordinate_drift(doc, sigs)
    check_request_status_consistency(doc, sigs)
  end

  # -----------------------------------------------------------
  # Acciones correctivas
  # -----------------------------------------------------------
  def take_actions
    results[:failures].each do |failure|
      severity = failure.dig(:details, :severity) || :warning
      alert!(severity, "#{failure[:name]}: #{failure_summary(failure)}")
      add_action("flag_#{failure[:name]}", failure[:details])
    end
  end

  # -----------------------------------------------------------
  # Check 1: signatures_complete
  # All required signatures must be signed when doc is completed
  # -----------------------------------------------------------
  def check_signatures_complete(doc, sigs)
    return unless doc.completed?

    required = sigs.select { |s| s["required"] }
    unsigned = required.reject { |s| s["status"] == "signed" }

    add_check("signatures_complete", unsigned.empty?, {
      severity: :warning,
      total_required: required.size,
      unsigned: unsigned.map { |s| s["label"] || s["signatory_type_code"] }
    })
  end

  # -----------------------------------------------------------
  # Check 2: signature_order
  # If sequential signing is enabled, signatures must be in order
  # -----------------------------------------------------------
  def check_signature_order(doc, sigs)
    return unless doc.sequential_signing?

    signed = sigs.select { |s| s["signed_at"].present? }
    return if signed.size < 2

    # Get the indices of signed entries in the original array
    signed_indices = signed.map { |s| sigs.index(s) }

    # Check that signed_at timestamps respect array position order
    sorted_by_time = signed.sort_by { |s| s["signed_at"] }
    time_indices = sorted_by_time.map { |s| sigs.index(s) }

    in_order = signed_indices == time_indices

    add_check("signature_order", in_order, {
      severity: :warning,
      expected_order: signed_indices,
      actual_order_by_time: time_indices,
      signatures: signed.map { |s| { label: s["label"], signed_at: s["signed_at"] } }
    })
  end

  # -----------------------------------------------------------
  # Check 3: identity_consistency
  # user_name (assigned) vs signed_by_name (who actually signed)
  # Substituted signatures (substituted: true) are tracked as
  # informational — only untracked mismatches are warnings.
  # -----------------------------------------------------------
  def check_identity_consistency(sigs)
    mismatches = []
    substitutions = []

    sigs.each do |s|
      next unless s["signed_at"].present?
      next if s["user_name"].blank? || s["signed_by_name"].blank?
      next if s["user_name"] == s["signed_by_name"]

      if s["substituted"]
        substitutions << {
          label: s["label"],
          original_user: s["original_user_name"],
          signed_by: s["signed_by_name"]
        }
      else
        mismatches << {
          label: s["label"],
          assigned_to: s["user_name"],
          signed_by: s["signed_by_name"]
        }
      end
    end

    add_check("identity_substitutions", true, {
      severity: :info,
      substitutions: substitutions
    }) if substitutions.any?

    add_check("identity_consistency", mismatches.empty?, {
      severity: :warning,
      mismatches: mismatches
    })
  end

  # -----------------------------------------------------------
  # Check 4: signature_references
  # signature_id must point to a valid, active Identity::UserSignature
  # -----------------------------------------------------------
  def check_signature_references(sigs)
    invalid_refs = []

    sigs.each do |s|
      next unless s["signed_at"].present?
      next if s["signature_id"].blank? # handled by check 5

      user_sig = ::Identity::UserSignature.where(uuid: s["signature_id"]).first

      if user_sig.nil?
        invalid_refs << {
          label: s["label"],
          signature_id: s["signature_id"],
          reason: "not_found"
        }
      elsif user_sig.respond_to?(:active?) && !user_sig.active?
        invalid_refs << {
          label: s["label"],
          signature_id: s["signature_id"],
          reason: "inactive"
        }
      end
    end

    severity = invalid_refs.any? { |r| r[:reason] == "not_found" } ? :critical : :warning

    add_check("signature_references", invalid_refs.empty?, {
      severity: severity,
      invalid_references: invalid_refs
    })
  end

  # -----------------------------------------------------------
  # Check 5: missing_signature_id
  # Slots marked as signed but with signature_id nil (admin bypass)
  # -----------------------------------------------------------
  def check_missing_signature_id(sigs)
    missing = sigs.select do |s|
      s["status"] == "signed" && s["signature_id"].nil?
    end

    add_check("missing_signature_id", missing.empty?, {
      severity: :warning,
      slots_without_signature: missing.map { |s|
        { label: s["label"], signed_by: s["signed_by_name"], signed_at: s["signed_at"] }
      }
    })
  end

  # -----------------------------------------------------------
  # Check 6: status_consistency
  # Document status must be coherent with signature states
  # -----------------------------------------------------------
  def check_status_consistency(doc, sigs)
    issues = []

    required = sigs.select { |s| s["required"] }
    all_signed = required.all? { |s| s["status"] == "signed" }
    any_signed = sigs.any? { |s| s["status"] == "signed" }

    # Completed doc should have all required signatures signed
    if doc.completed? && !all_signed
      issues << "document is completed but has unsigned required signatures"
    end

    # Doc with all required signed should be completed (not still pending_signatures)
    if doc.pending_signatures? && all_signed && required.any?
      issues << "all required signatures are signed but document is still pending_signatures"
    end

    # Draft doc should not have any signatures
    if doc.draft? && any_signed
      issues << "document is draft but has signed signatures"
    end

    add_check("status_consistency", issues.empty?, {
      severity: issues.empty? ? :warning : :critical,
      document_status: doc.status,
      all_required_signed: all_signed,
      any_signed: any_signed,
      issues: issues
    })
  end

  # -----------------------------------------------------------
  # Check 7: docx_with_signatures
  # DOCX files cannot embed signature images — must be PDF
  # -----------------------------------------------------------
  def check_docx_with_signatures(doc, sigs)
    return unless doc.file_name&.end_with?(".docx")

    signed = sigs.select { |s| s["status"] == "signed" }
    return if signed.empty?

    add_check("docx_with_signatures", false, {
      severity: :critical,
      file_name: doc.file_name,
      signed_count: signed.size,
      document_uuid: doc.uuid,
      message: "Document is DOCX with #{signed.size} signature(s) — signatures cannot be embedded visually. Convert to PDF via Gotenberg."
    })
  end

  # -----------------------------------------------------------
  # Check 8: signature_placement
  # Verify actual signature images in the PDF are correctly positioned.
  # Two strategies:
  #   A) Anchor-based (vacations): image must sit above its underscore anchor
  #   B) Text-gap-based (certifications): image must be within the signature gap
  # -----------------------------------------------------------
  def check_signature_placement(doc, sigs)
    return unless doc.draft_file_id.present?
    return unless doc.file_name&.end_with?(".pdf")

    signed = sigs.select { |s| s["status"] == "signed" && s["signature_id"].present? }
    return if signed.empty?

    pdf_content = doc.file_content
    return unless pdf_content

    page_height = actual_page_height(pdf_content)
    anchors = doc.send(:find_signature_anchors, pdf_content, page_height, 0)

    # Find actual image positions in the PDF
    image_positions = find_image_positions_in_pdf(pdf_content, page_height)
    return if image_positions.empty?

    if anchors.any?
      check_anchor_based_placement(doc, signed, anchors, image_positions, page_height)
    else
      check_text_gap_placement(doc, signed, image_positions, pdf_content, page_height)
    end
  end

  # Check 8A: Anchor-based placement (vacations with underscore lines)
  def check_anchor_based_placement(doc, signed, anchors, image_positions, page_height)
    misplaced = []
    signed.each do |sig_entry|
      signatory_uuid = sig_entry["signatory_id"]
      signatory = doc.template&.signatories&.where(uuid: signatory_uuid)&.first
      next unless signatory

      sig_x = signatory.x_position.to_f
      template_y = signatory.y_position.to_f % page_height

      column_anchors = anchors.select { |a| (a[:x] - sig_x).abs < 30 }
      next if column_anchors.empty?

      column_images = image_positions.select { |i| (i[:x] - sig_x).abs < 30 }
      next if column_images.empty?

      expected_anchor = column_anchors.min_by { |a| (a[:y_from_top] - template_y).abs }

      img = column_images
        .select { |i| i[:bottom] < expected_anchor[:y_from_top] + 5 }
        .min_by { |i| expected_anchor[:y_from_top] - i[:bottom] }
      next unless img

      actual_anchor = column_anchors
        .select { |a| a[:y_from_top] > img[:bottom] - 5 }
        .min_by { |a| a[:y_from_top] - img[:bottom] }
      next unless actual_anchor

      gap = actual_anchor[:y_from_top] - img[:bottom]
      if gap < -5 || gap > 50
        misplaced << {
          label: sig_entry["signatory_label"] || signatory.label,
          image_bottom: img[:bottom].round(1),
          anchor_y: actual_anchor[:y_from_top].round(1),
          gap: gap.round(1),
          issue: gap < -5 ? "overlaps_underscore" : "too_far_from_anchor"
        }
      end

      if (expected_anchor[:y_from_top] - actual_anchor[:y_from_top]).abs > 20
        misplaced << {
          label: sig_entry["signatory_label"] || signatory.label,
          image_bottom: img[:bottom].round(1),
          expected_anchor_y: expected_anchor[:y_from_top].round(1),
          actual_anchor_y: actual_anchor[:y_from_top].round(1),
          issue: "wrong_anchor_line"
        }
      end
    end

    add_check("signature_placement", misplaced.empty?, {
      severity: misplaced.any? { |m| m[:issue] == "wrong_anchor_line" } ? :critical : :warning,
      misplaced_signatures: misplaced,
      anchors_found: anchors.size,
      images_found: image_positions.size
    })
  end

  # Check 8B: Text-gap placement (certifications without underscore anchors)
  # Verifies signature images are within the natural text gap (e.g., between
  # "Atentamente," and "HUMAN TALENT PARTNER").
  def check_text_gap_placement(doc, signed, image_positions, pdf_content, page_height)
    gap = doc.send(:find_signature_text_gap, pdf_content, page_height)
    return unless gap # No detectable text gap — skip

    misplaced = []
    signed.each do |sig_entry|
      signatory_uuid = sig_entry["signatory_id"]
      signatory = doc.template&.signatories&.where(uuid: signatory_uuid)&.first
      next unless signatory

      sig_x = signatory.x_position.to_f
      column_images = image_positions.select { |i| (i[:x] - sig_x).abs < 30 }
      next if column_images.empty?

      img = column_images.first # Typically one signature per certification

      # Image must be within the text gap (with 5pt tolerance)
      if img[:top] < gap[:gap_top] - 5 || img[:bottom] > gap[:gap_bottom] + 5
        misplaced << {
          label: sig_entry["signatory_label"] || signatory.label,
          image_top: img[:top],
          image_bottom: img[:bottom],
          gap_top: gap[:gap_top],
          gap_bottom: gap[:gap_bottom],
          issue: "outside_text_gap"
        }
      end
    end

    add_check("signature_placement", misplaced.empty?, {
      severity: misplaced.any? ? :critical : :info,
      misplaced_signatures: misplaced,
      text_gap: gap,
      images_found: image_positions.size,
      strategy: "text_gap"
    })
  end

  # Parse PDF to find signature image positions (excluding header/footer images)
  def find_image_positions_in_pdf(pdf_bytes, page_height)
    require "zlib"
    positions = []

    streams = []
    pdf_bytes.force_encoding("BINARY").scan(/stream\r?\n(.*?)\r?\nendstream/m) do |match|
      raw = match[0]
      begin
        decompressed = Zlib::Inflate.inflate(raw)
        streams << decompressed
      rescue Zlib::DataError, Zlib::BufError
        streams << raw if raw.ascii_only?
      end
    end

    streams.each do |stream|
      # Find image placement: a b c d e f cm /Name Do
      stream.scan(/([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+cm\s+\/([\w]+)\s+Do/) do |a, _b, _c, d, e, f, name|
        next if name.start_with?("Im") # Skip header/footer images (Im4, Im5, etc.)
        w = a.to_f; h = d.to_f; x = e.to_f; y_bot = f.to_f
        top = page_height - y_bot - h
        bottom = page_height - y_bot
        # Only include reasonable signature sizes (not tiny or page-sized)
        next if w < 20 || w > 300 || h < 10 || h > 200
        positions << { name: name, x: x.round(1), top: top.round(1), bottom: bottom.round(1) }
      end
    end

    positions
  rescue StandardError => e
    Rails.logger.warn "Image position detection failed: #{e.message}"
    []
  end

  # -----------------------------------------------------------
  # Check 9: coordinate_drift
  # Detect when template signatory coordinates don't match the
  # generated PDF's actual signature line positions. Runs on
  # document creation AND updates to catch misalignment BEFORE
  # anyone signs.
  #
  # Also detects page size mismatches (template says Letter but
  # PDF is A4) which cause systematic coordinate drift.
  # -----------------------------------------------------------
  def check_coordinate_drift(doc, _sigs)
    return unless doc.draft_file_id.present?
    return unless doc.file_name&.end_with?(".pdf")
    return unless doc.template&.signatories&.any?

    # Load configurable thresholds
    rule = load_rule("coordinate_drift")
    config = rule&.rule_config || {}
    info_threshold = config.fetch("info_threshold", 20)
    warning_threshold = config.fetch("warning_threshold", 50)
    critical_threshold = config.fetch("critical_threshold", 80)

    pdf_content = doc.file_content
    return unless pdf_content

    page_height = actual_page_height(pdf_content)
    page_width = actual_page_width(pdf_content)
    anchors = doc.send(:find_signature_anchors, pdf_content, page_height, 0)
    return if anchors.empty?

    # Count pages in generated PDF
    generated_pages = pdf_page_count(pdf_content)
    template_pages = doc.template.try(:pdf_page_count)
    page_mismatch = template_pages && generated_pages && template_pages != generated_pages

    # Detect page size mismatch (template dimensions vs actual PDF)
    tmpl_width = doc.template.pdf_width
    tmpl_height = doc.template.pdf_height
    size_mismatch = false
    if tmpl_width && tmpl_height && page_width && page_height
      width_diff = (tmpl_width - page_width).abs
      height_diff = (tmpl_height - page_height).abs
      size_mismatch = width_diff > 5 || height_diff > 5
    end

    drifted = []
    doc.template.signatories.by_position.each do |sig|
      anchor = doc.send(:match_anchor_for_signatory, sig, anchors, page_height)
      next unless anchor

      template_y = sig.y_position.to_f % page_height
      anchor_y = anchor[:y_from_top]
      drift = (template_y - anchor_y).abs

      if drift > info_threshold
        drifted << {
          label: sig.label,
          signatory_type: sig.signatory_type_code,
          template_x: sig.x_position.to_f.round(1),
          template_y: template_y.round(1),
          anchor_x: anchor[:x],
          anchor_y: anchor_y.round(1),
          drift: drift.round(1)
        }
      end
    end

    # Tiered severity based on max drift (configurable thresholds):
    #   >critical_threshold  = critical (severe miscalibration)
    #   >warning_threshold   = warning  (significant drift — recalibrate)
    #   info..warning        = info     (normal drift, auto-corrected)
    max_drift = drifted.map { |d| d[:drift] }.max || 0
    severity = if max_drift > critical_threshold
                 :critical
               elsif max_drift > warning_threshold || size_mismatch
                 :warning
               else
                 :info
               end

    # Only fail for warning/critical — info-level drift is expected and auto-corrected
    passed = drifted.empty? || severity == :info

    causes = []
    if size_mismatch
      causes << "Template espera #{tmpl_width.round(0)}x#{tmpl_height.round(0)}pts pero el PDF es #{page_width.round(0)}x#{page_height.round(0)}pts."
    end
    if page_mismatch
      causes << "Template tiene #{template_pages} página(s) pero el PDF generado tiene #{generated_pages}."
    end
    causes << "Coordenadas del template no coinciden con las líneas de firma del PDF." if drifted.any? && causes.empty?

    add_check("coordinate_drift", passed, {
      severity: severity,
      drifted_signatories: drifted,
      max_drift: max_drift.round(1),
      template_dimensions: tmpl_width && tmpl_height ? "#{tmpl_width.round(0)}x#{tmpl_height.round(0)}" : nil,
      pdf_dimensions: page_width && page_height ? "#{page_width.round(0)}x#{page_height.round(0)}" : nil,
      size_mismatch: size_mismatch,
      template_pages: template_pages,
      generated_pages: generated_pages,
      page_mismatch: page_mismatch,
      cause: causes.join(" "),
      recommendation: drifted.any? ? "Recalibre las coordenadas de firma en el editor de template para que coincidan con las líneas de firma del documento generado." : nil,
      note: "Las firmas se reposicionan automáticamente usando detección de anclas, pero las coordenadas del template deberían recalibrarse para evitar desplazamientos."
    })
  end

  # -----------------------------------------------------------
  # Check 9: request_status_consistency
  # If all document signatures are complete, the associated HR
  # request (vacation/certification) should be approved/completed.
  # Detects the scenario where signing completes but request is
  # stuck in pending/processing.
  # -----------------------------------------------------------
  def check_request_status_consistency(doc, sigs)
    required = sigs.select { |s| s["required"] }
    all_signed = required.any? && required.all? { |s| s["status"] == "signed" }
    return unless all_signed

    source = doc.source
    return unless source

    issues = []

    case source
    when ::Hr::VacationRequest
      if source.pending?
        issues << "todas las firmas completadas pero solicitud de vacaciones #{source.request_number} sigue en 'pendiente'"
      end
    when ::Hr::EmploymentCertificationRequest
      if source.processing? || source.pending?
        issues << "todas las firmas completadas pero certificación #{source.request_number} sigue en '#{source.status}'"
      end
    end

    add_check("request_status_consistency", issues.empty?, {
      severity: issues.any? ? :critical : :info,
      source_type: source.class.name,
      source_status: source.try(:status),
      request_number: source.try(:request_number),
      all_signatures_complete: true,
      issues: issues
    })
  end

  # -----------------------------------------------------------
  # PDF dimension helpers
  # -----------------------------------------------------------
  def actual_page_height(pdf_content)
    cpdf = CombinePDF.parse(pdf_content)
    cpdf.pages.first&.mediabox&.dig(3)&.to_f || 841.89
  rescue StandardError
    841.89
  end

  def actual_page_width(pdf_content)
    cpdf = CombinePDF.parse(pdf_content)
    cpdf.pages.first&.mediabox&.dig(2)&.to_f || 595.28
  rescue StandardError
    595.28
  end

  def pdf_page_count(pdf_content)
    CombinePDF.parse(pdf_content).pages.count
  rescue StandardError
    nil
  end

  # -----------------------------------------------------------
  # Helpers
  # -----------------------------------------------------------
  def failure_summary(failure)
    details = failure[:details] || {}

    case failure[:name]
    when "signatures_complete"
      "Firmas requeridas sin completar: #{(details[:unsigned] || []).join(', ')}"
    when "signature_order"
      "Firmas fuera de orden secuencial"
    when "identity_substitutions"
      subs = details[:substitutions] || []
      subs.map { |s| "#{s[:label]}: #{s[:signed_by]} en sustitución de #{s[:original_user]}" }.join("; ")
    when "identity_consistency"
      mismatches = details[:mismatches] || []
      mismatches.map { |m| "#{m[:label]}: asignado a #{m[:assigned_to]}, firmó #{m[:signed_by]}" }.join("; ")
    when "signature_references"
      refs = details[:invalid_references] || []
      refs.map { |r| "#{r[:label]}: #{r[:reason]}" }.join("; ")
    when "missing_signature_id"
      slots = details[:slots_without_signature] || []
      "#{slots.size} firma(s) sin referencia a firma digital (bypass administrativo)"
    when "status_consistency"
      (details[:issues] || []).join("; ")
    when "docx_with_signatures"
      "Documento DOCX con #{details[:signed_count]} firma(s) sin incrustar — requiere conversión a PDF"
    when "signature_placement"
      misplaced = details[:misplaced_signatures] || []
      misplaced.map do |m|
        case m[:issue]
        when "wrong_anchor_line"
          "#{m[:label]}: firma sobre línea incorrecta (esperada=#{m[:expected_anchor_y]}, real=#{m[:actual_anchor_y]})"
        when "outside_text_gap"
          "#{m[:label]}: firma fuera del espacio de firma (imagen=#{m[:image_top]}-#{m[:image_bottom]}, gap=#{m[:gap_top]}-#{m[:gap_bottom]})"
        else
          "#{m[:label]}: #{m[:issue]} (gap=#{m[:gap]}pts, anchor=#{m[:anchor_y]})"
        end
      end.join("; ")
    when "coordinate_drift"
      drifted = details[:drifted_signatories] || []
      parts = []
      parts << details[:cause] if details[:cause].present?
      parts << "Máx. desviación: #{details[:max_drift]}pts" if details[:max_drift]
      if drifted.any?
        drift_desc = drifted.map { |d| "#{d[:label]}: template(#{d[:template_x]},#{d[:template_y]}) vs ancla(#{d[:anchor_x]},#{d[:anchor_y]}) drift=#{d[:drift]}pts" }.join("; ")
        parts << drift_desc
      end
      parts << details[:recommendation] if details[:recommendation].present?
      parts.join(" ")
    when "request_status_consistency"
      (details[:issues] || []).join("; ")
    else
      failure[:name]
    end
  end
end
