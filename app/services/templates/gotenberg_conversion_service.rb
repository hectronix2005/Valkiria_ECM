# frozen_string_literal: true

require "net/http"
require "uri"

module Templates
  # Single-responsibility service for converting DOCX to PDF via Gotenberg.
  # Reusable from the document generator and the async retry job.
  class GotenbergConversionService
    MAX_ATTEMPTS = 3
    BACKOFF_SECONDS = [0, 5, 10].freeze
    OPEN_TIMEOUT = 45   # Render free-tier cold start can take ~30-40s
    READ_TIMEOUT = 120  # Large documents need time to convert

    # Converts a DOCX file to PDF bytes via Gotenberg.
    # Returns the PDF bytes on success, or nil if all attempts fail.
    def self.convert(docx_path)
      return nil unless ENV["GOTENBERG_URL"].present?

      gotenberg_url = ENV["GOTENBERG_URL"].chomp("/")
      uri = URI.parse("#{gotenberg_url}/forms/libreoffice/convert")

      file_content = File.binread(docx_path)
      file_name = File.basename(docx_path)

      # Wake up Gotenberg before the first conversion attempt
      GotenbergWarmupService.ping

      MAX_ATTEMPTS.times do |attempt|
        sleep(BACKOFF_SECONDS[attempt]) if BACKOFF_SECONDS[attempt] > 0

        begin
          boundary = "----GotenbergBoundary#{SecureRandom.hex(8)}"
          body = build_multipart_body(boundary, file_name, file_content)

          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = uri.scheme == "https"
          http.open_timeout = OPEN_TIMEOUT
          http.read_timeout = READ_TIMEOUT

          request = Net::HTTP::Post.new(uri.request_uri)
          request["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
          request.body = body

          Rails.logger.info "[GotenbergConversion] Attempt #{attempt + 1}/#{MAX_ATTEMPTS}..."
          response = http.request(request)

          if response.code == "200"
            Rails.logger.info "[GotenbergConversion] Success (#{response.body.bytesize} bytes) on attempt #{attempt + 1}"
            return response.body
          else
            Rails.logger.error "[GotenbergConversion] Attempt #{attempt + 1} failed: HTTP #{response.code} - #{response.body.to_s.truncate(200)}"
          end
        rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, Errno::ECONNRESET => e
          Rails.logger.warn "[GotenbergConversion] Attempt #{attempt + 1} connection error: #{e.class}: #{e.message}"
        rescue StandardError => e
          Rails.logger.error "[GotenbergConversion] Attempt #{attempt + 1} unexpected error: #{e.class}: #{e.message}"
          Rails.logger.error e.backtrace.first(3).join("\n")
          break # Non-retryable error
        end
      end

      Rails.logger.error "[GotenbergConversion] All #{MAX_ATTEMPTS} attempts failed"
      nil
    end

    def self.build_multipart_body(boundary, file_name, file_content)
      body = String.new(encoding: "BINARY")
      body << "--#{boundary}\r\n"
      body << "Content-Disposition: form-data; name=\"files\"; filename=\"#{file_name}\"\r\n"
      body << "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n"
      body << "\r\n"
      body << file_content
      body << "\r\n"
      body << "--#{boundary}--\r\n"
      body
    end
    private_class_method :build_multipart_body
  end
end
