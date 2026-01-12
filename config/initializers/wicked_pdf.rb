# frozen_string_literal: true

# WickedPdf configuration for HTML to PDF conversion
WickedPdf.config = {
  exe_path: Gem.bin_path("wkhtmltopdf-heroku", "wkhtmltopdf-linux-amd64")
}
