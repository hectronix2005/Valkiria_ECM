# Run with: rails runner lib/tasks/regenerate_previews.rb
require "combine_pdf"

puts "Regenerating ALL PDF previews locally..."
puts "=" * 60

templates = Templates::Template.where(:file_id.ne => nil).select { |t| t.file_name&.end_with?(".docx") }
puts "Found #{templates.count} templates\n\n"

regenerated = 0
templates.each do |template|
  print "  #{template.name}... "

  content = template.file_content
  unless content
    puts "No file content, skipped"
    next
  end

  begin
    pdf_content = template.send(:convert_docx_to_pdf_for_dimensions, content)
    if pdf_content
      template.store_pdf_preview!(pdf_content)

      # Update dimensions
      pdf = CombinePDF.parse(pdf_content)
      if pdf.pages.any?
        first_page = pdf.pages.first
        mediabox = first_page.mediabox
        template.pdf_width = mediabox[2].to_f
        template.pdf_height = mediabox[3].to_f
        template.pdf_page_count = pdf.pages.count
      end

      template.save!
      regenerated += 1
      puts "OK (#{pdf.pages.count} pages, #{pdf_content.bytesize} bytes)"
    else
      puts "Conversion failed"
    end
  rescue => e
    puts "ERROR: #{e.message}"
  end
end

puts "\n" + "=" * 60
puts "Regenerated #{regenerated} previews"
puts "=" * 60
