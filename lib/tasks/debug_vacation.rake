# frozen_string_literal: true

namespace :debug do
  desc "Debug vacation request signature placement"
  task :vacation, [:request_number] => :environment do |_t, args|
    rn = args[:request_number] || "VAC-2026-00013"
    vac = Hr::VacationRequest.find_by(request_number: rn)
    puts "Vacation: #{vac.uuid} status=#{vac.status}"
    puts "Doc UUID: #{vac.document_uuid}"

    doc = Templates::GeneratedDocument.where(uuid: vac.document_uuid).first
    puts "Doc status: #{doc.status}"
    puts "File name: #{doc.file_name}"
    puts ""

    tmpl = doc.template
    puts "=== TEMPLATE ==="
    puts "Name: #{tmpl&.name}"
    puts "preview_scale: #{tmpl&.preview_scale}"
    puts "pdf_width: #{tmpl&.pdf_width}"
    puts "pdf_height: #{tmpl&.pdf_height}"
    puts "preview_page_height: #{tmpl&.preview_page_height}"
    puts "sequential_signing: #{tmpl&.sequential_signing}"
    puts ""

    puts "=== SIGNATORIES (template) ==="
    tmpl&.signatories&.by_position&.each_with_index do |s, i|
      puts "  [#{i}] #{s.label} | type=#{s.signatory_type_code}"
      puts "      x=#{s.x_position} y=#{s.y_position} w=#{s.width} h=#{s.height}"
      puts "      page=#{s.page_number} date_pos=#{s.date_position}"
      puts "      show_label=#{s.show_label} show_name=#{s.show_signer_name}"
    end
    puts ""

    puts "=== SIGNATURES (document) ==="
    doc.signatures.each_with_index do |s, i|
      puts "  [#{i}] #{s['label']} | type=#{s['signatory_type_code']}"
      puts "      status=#{s['status']} signed_at=#{s['signed_at']}"
      puts "      signed_by=#{s['signed_by_name']} sig_id=#{s['signature_id']}"
      puts "      custom: x=#{s['custom_x']} y=#{s['custom_y']} w=#{s['custom_width']} h=#{s['custom_height']}"
    end
    puts ""

    # Check user signature
    doc.signatures.each do |s|
      next unless s["signature_id"]
      sig = Identity::UserSignature.where(uuid: s["signature_id"]).first
      if sig
        puts "UserSignature #{sig.uuid}: type=#{sig.signature_type} name=#{sig.name} active=#{sig.active} default=#{sig.is_default}"
        puts "  image_data present: #{sig.image_data.present?} length: #{sig.image_data&.length}"
        puts "  styled: text=#{sig.styled_text} font=#{sig.font_family}"
      else
        puts "UserSignature #{s['signature_id']}: NOT FOUND"
      end
    end
    puts ""

    # Anchor analysis on actual PDF
    pdf_content = doc.file_content
    if pdf_content
      puts "=== PDF ANALYSIS ==="
      puts "PDF size: #{pdf_content.length} bytes"
      combined = CombinePDF.parse(pdf_content)
      puts "Pages: #{combined.pages.count}"
      combined.pages.each_with_index do |page, i|
        puts "  Page #{i}: mediabox=#{page.mediabox.inspect}"
      end

      page_height = combined.pages.first.mediabox[3].to_f
      anchors = doc.send(:find_signature_anchors, pdf_content, page_height, 0)
      puts ""
      puts "Detected anchors: #{anchors.count}"
      anchors.each_with_index do |a, i|
        puts "  [#{i}] x=#{a[:x]} y_from_top=#{a[:y_from_top]}"
      end
    end
  end

  desc "Reset signatures on a vacation request document"
  task :reset_signatures, [:request_number] => :environment do |_t, args|
    rn = args[:request_number] || "VAC-2026-00013"
    vac = Hr::VacationRequest.find_by(request_number: rn)
    doc = Templates::GeneratedDocument.where(uuid: vac.document_uuid).first

    puts "Resetting signatures for #{rn} (doc: #{doc.uuid})"
    doc.reset_signatures!
    puts "Done. Status: #{doc.status}"
    doc.signatures.each { |s| puts "  #{s['label']}: #{s['status']}" }
  end
end
