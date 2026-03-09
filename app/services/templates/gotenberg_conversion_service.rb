# frozen_string_literal: true

require "net/http"
require "uri"

module Templates
  # Single-responsibility service for converting DOCX to PDF via Gotenberg.
  # Reusable from the document generator and the async retry job.
  class GotenbergConversionService
    # Web-safe mode: single fast attempt that fits within Heroku's 30s timeout
    WEB_OPEN_TIMEOUT = 10
    WEB_READ_TIMEOUT = 15

    # Job mode: multiple attempts with generous timeouts for cold starts
    JOB_MAX_ATTEMPTS = 3
    JOB_BACKOFF_SECONDS = [0, 5, 10].freeze
    JOB_OPEN_TIMEOUT = 45
    JOB_READ_TIMEOUT = 120

    # Quick conversion for web requests — single attempt, short timeouts.
    # Returns PDF bytes or nil (caller should create pending doc + enqueue job).
    # page_size: optional { width_pts:, height_pts: } to enforce specific page dimensions
    def self.convert(docx_path, page_size: nil)
      attempt_conversion(docx_path, attempts: 1, open_timeout: WEB_OPEN_TIMEOUT, read_timeout: WEB_READ_TIMEOUT,
                                    page_size: page_size)
    end

    # Full conversion for async jobs — multiple retries, generous timeouts.
    # Returns PDF bytes or nil (job will re-raise to trigger Sidekiq retry).
    def self.convert_with_retries(docx_path, page_size: nil)
      attempt_conversion(docx_path, attempts: JOB_MAX_ATTEMPTS, backoffs: JOB_BACKOFF_SECONDS,
                                    open_timeout: JOB_OPEN_TIMEOUT, read_timeout: JOB_READ_TIMEOUT,
                                    page_size: page_size)
    end

    def self.attempt_conversion(docx_path, attempts:, open_timeout:, read_timeout:, backoffs: [0], page_size: nil)
      return nil unless ENV["GOTENBERG_URL"].present?

      gotenberg_url = ENV["GOTENBERG_URL"].chomp("/")
      uri = URI.parse("#{gotenberg_url}/forms/libreoffice/convert")

      file_content = File.binread(docx_path)
      file_name = File.basename(docx_path)

      # Convert page dimensions from points to inches for Gotenberg
      paper_fields = {}
      if page_size && page_size[:width_pts] && page_size[:height_pts]
        paper_fields["paperWidth"] = (page_size[:width_pts] / 72.0).round(2).to_s
        paper_fields["paperHeight"] = (page_size[:height_pts] / 72.0).round(2).to_s
        Rails.logger.info "[GotenbergConversion] Using page size: #{paper_fields['paperWidth']}x#{paper_fields['paperHeight']} inches"
      end

      # Wake up Gotenberg before the first conversion attempt
      GotenbergWarmupService.ping

      attempts.times do |attempt|
        backoff = backoffs[attempt] || 0
        sleep(backoff) if backoff > 0

        begin
          boundary = "----GotenbergBoundary#{SecureRandom.hex(8)}"
          body = build_multipart_body(boundary, file_name, file_content, extra_fields: paper_fields)

          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = uri.scheme == "https"
          http.open_timeout = open_timeout
          http.read_timeout = read_timeout

          request = Net::HTTP::Post.new(uri.request_uri)
          request["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
          request.body = body

          Rails.logger.info "[GotenbergConversion] Attempt #{attempt + 1}/#{attempts}..."
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

      Rails.logger.error "[GotenbergConversion] All #{attempts} attempts failed"
      nil
    end
    private_class_method :attempt_conversion

    def self.build_multipart_body(boundary, file_name, file_content, extra_fields: {})
      body = String.new(encoding: "BINARY")

      # Add extra form fields (e.g., paperWidth, paperHeight)
      extra_fields.each do |name, value|
        body << "--#{boundary}\r\n"
        body << "Content-Disposition: form-data; name=\"#{name}\"\r\n"
        body << "\r\n"
        body << value.to_s
        body << "\r\n"
      end

      # Add the DOCX file
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
