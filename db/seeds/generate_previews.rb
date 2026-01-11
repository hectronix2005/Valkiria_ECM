# frozen_string_literal: true

# Generate PDF previews for all templates that don't have one
Templates::Template.where(:file_id.ne => nil).each do |t|
  next if t.preview_file_id.present?
  next unless t.file_name&.end_with?(".docx")

  puts "Generating preview for: #{t.name}"
  content = t.file_content
  if content
    pdf_content = t.send(:convert_docx_to_pdf_for_dimensions, content)
    if pdf_content
      t.store_pdf_preview!(pdf_content)
      t.save!
      puts "  -> Preview generated: #{t.preview_file_id}"
    else
      puts "  -> ERROR: Could not convert"
    end
  end
end
puts "Done!"
