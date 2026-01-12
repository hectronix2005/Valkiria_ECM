# frozen_string_literal: true

module Templates
  class GeneratedDocument
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "generated_documents"

    # Status values
    DRAFT = "draft"
    PENDING_SIGNATURES = "pending_signatures"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    STATUSES = [DRAFT, PENDING_SIGNATURES, COMPLETED, CANCELLED].freeze

    # Fields
    field :name, type: String
    field :status, type: String, default: DRAFT

    # PDF file storage (GridFS)
    field :draft_file_id, type: BSON::ObjectId  # Initial generated PDF
    field :final_file_id, type: BSON::ObjectId  # PDF with all signatures
    field :docx_file_id, type: BSON::ObjectId   # Source DOCX for local PDF generation
    field :file_name, type: String

    # PDF generation tracking (for local sync workflow)
    field :pdf_generation_status, type: String, default: "completed"
    # Values: "completed", "pending", "failed"

    # Variable values used for generation
    field :variable_values, type: Hash, default: {}

    # Reference to the source request (certification, vacation, etc.)
    field :source_type, type: String  # "Hr::EmploymentCertificationRequest", "Hr::VacationRequest"
    field :source_id, type: BSON::ObjectId

    # Signature tracking
    field :signatures, type: Array, default: []
    # Each signature entry: { signatory_id, user_id, signed_at, signature_id, status }

    field :completed_at, type: Time
    field :expires_at, type: Time

    # Direct employee reference (for documents generated directly for an employee)
    field :employee_id, type: BSON::ObjectId

    # Associations
    belongs_to :template, class_name: "Templates::Template", optional: true
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :requested_by, class_name: "Identity::User"
    belongs_to :employee, class_name: "Hr::Employee", optional: true

    # Indexes
    index({ organization_id: 1 })
    index({ template_id: 1 })
    index({ status: 1 })
    index({ source_type: 1, source_id: 1 })
    index({ requested_by_id: 1 })
    index({ employee_id: 1 })
    index({ created_at: -1 })

    # Validations
    validates :name, presence: true, length: { maximum: 255 }
    validates :status, presence: true, inclusion: { in: STATUSES }

    # Scopes
    scope :draft, -> { where(status: DRAFT) }
    scope :pending_signatures, -> { where(status: PENDING_SIGNATURES) }
    scope :completed, -> { where(status: COMPLETED) }
    scope :cancelled, -> { where(status: CANCELLED) }
    scope :for_user, ->(user) { where(requested_by_id: user.id) }
    scope :pending_pdf_generation, -> { where(pdf_generation_status: "pending") }
    scope :pending_signature_by, lambda { |user|
      where(
        status: PENDING_SIGNATURES,
        "signatures.user_id" => user.id.to_s,
        "signatures.status" => "pending"
      )
    }

    # Instance methods
    def draft?
      status == DRAFT
    end

    def pending_signatures?
      status == PENDING_SIGNATURES
    end

    def completed?
      status == COMPLETED
    end

    def cancelled?
      status == CANCELLED
    end

    def source
      return nil unless source_type && source_id

      source_type.constantize.find(source_id)
    rescue Mongoid::Errors::DocumentNotFound
      nil
    end

    def source=(record)
      return if record.nil?

      self.source_type = record.class.name
      self.source_id = record.id
    end

    # Initialize signature tracking from template signatories
    def initialize_signatures!
      return unless template

      self.signatures = template.signatories.by_position.map do |sig|
        user = sig.find_signatory_for(signature_context)

        {
          "signatory_id" => sig.uuid,
          "signatory_type_code" => sig.signatory_type_code,
          "signatory_role" => sig.role,
          "signatory_label" => sig.label,
          "label" => sig.label,
          "user_id" => user&.id&.to_s,
          "user_name" => user&.full_name,
          "required" => sig.required,
          "status" => "pending",
          "signature_id" => nil,
          "signed_at" => nil,
          "signed_by_name" => nil
        }
      end

      update!(status: PENDING_SIGNATURES) if signatures.any?
    end

    # Apply a user's signature
    # custom_position: { x:, y:, width:, height: } - optional override for signature position
    def sign!(user:, signature:, custom_position: nil)
      sig_entry = find_pending_signature_for(user)

      raise SignatureError, "No hay firma pendiente para este usuario" unless sig_entry
      raise SignatureError, "Usuario no tiene firma digital configurada" unless signature

      # Check signature order if sequential signing is enabled
      unless can_sign_at_position?(sig_entry)
        blocking = blocking_signatures_for(sig_entry)
        waiting_names = blocking.map { |b| b["signatory_label"] || b["label"] }.join(", ")
        raise SignatureError, "Debe esperar las firmas de: #{waiting_names}"
      end

      sig_entry["signature_id"] = signature.uuid
      sig_entry["signed_at"] = Time.current.iso8601
      sig_entry["signed_by_name"] = user.full_name
      sig_entry["status"] = "signed"

      # Store custom position if provided
      if custom_position.present?
        sig_entry["custom_x"] = custom_position[:x] if custom_position[:x]
        sig_entry["custom_y"] = custom_position[:y] if custom_position[:y]
        sig_entry["custom_width"] = custom_position[:width] if custom_position[:width]
        sig_entry["custom_height"] = custom_position[:height] if custom_position[:height]
      end

      save!

      # Apply signature to PDF immediately (don't wait for all signatures)
      apply_signature_to_pdf!(sig_entry, signature)

      # Check if all required signatures are complete
      check_completion!
    end

    # Apply a single signature to the current PDF
    def apply_signature_to_pdf!(sig_entry, signature)
      signatory = template&.signatories&.find_by(uuid: sig_entry["signatory_id"])
      return unless signatory

      pdf_content = file_content
      return unless pdf_content

      # Create working files
      input_pdf = Tempfile.new(["input", ".pdf"])
      input_pdf.binmode
      input_pdf.write(pdf_content)
      input_pdf.rewind

      begin
        # Load the PDF
        pdf = CombinePDF.load(input_pdf.path)

        # Get page dimensions to calculate correct page from absolute Y
        first_page = pdf.pages.first
        page_height = first_page.mediabox[3].to_f

        # Calculate which page the signature should go on based on absolute Y
        absolute_y = signatory.y_position.to_f
        calculated_page = (absolute_y / page_height).floor + 1
        relative_y = absolute_y % page_height

        # Use calculated page, but respect explicit page_number if Y is within first page
        page_index = if absolute_y < page_height && signatory.page_number
                       (signatory.page_number || 1) - 1
                     else
                       calculated_page - 1
                     end
        page_index = [[page_index, 0].max, pdf.pages.count - 1].min
        target_page = pdf.pages[page_index]

        Rails.logger.info "Signature placement: absoluteY=#{absolute_y}, pageHeight=#{page_height}, calculatedPage=#{calculated_page}, relativeY=#{relative_y}, pageIndex=#{page_index}"

        # Get signature image
        renderer = Templates::SignatureRendererService.new(signature)
        img_tempfile = renderer.to_tempfile

        begin
          # Create signature overlay with relative Y position for this page
          overlay_pdf = create_signature_overlay_for(
            img_path: img_tempfile.path,
            signatory: signatory,
            sig_entry: sig_entry,
            page_width: target_page.mediabox[2],
            page_height: target_page.mediabox[3],
            relative_y: relative_y
          )

          # Merge overlay onto page
          overlay = CombinePDF.parse(overlay_pdf)
          target_page << overlay.pages.first

          # Save updated PDF
          output_pdf = Tempfile.new(["updated", ".pdf"])
          pdf.save(output_pdf.path)

          # Update in GridFS (replace draft with signed version)
          store_updated_pdf(File.binread(output_pdf.path))
        ensure
          img_tempfile.close
          img_tempfile.unlink
          output_pdf&.close
          output_pdf&.unlink
        end
      ensure
        input_pdf.close
        input_pdf.unlink
      end
    rescue StandardError => e
      Rails.logger.error("Error applying signature to PDF: #{e.message}")
      Rails.logger.error(e.backtrace.first(5).join("\n"))
    end

    def create_signature_overlay_for(img_path:, signatory:, sig_entry:, page_width:, page_height:, relative_y: nil)
      box = signatory.signature_box

      # Use custom position from sig_entry if available, otherwise use template defaults
      x = sig_entry["custom_x"] || box[:x]
      base_y = sig_entry["custom_y"] || box[:y]
      # Use relative_y if provided (for multi-page documents), otherwise use base_y
      y = relative_y || base_y
      width = sig_entry["custom_width"] || box[:width]
      height = sig_entry["custom_height"] || box[:height]
      date_position = box[:date_position] || "right"
      show_label = box[:show_label].nil? ? true : box[:show_label]
      show_signer_name = box[:show_signer_name] || false

      pdf = Prawn::Document.new(
        page_size: [page_width, page_height],
        margin: 0
      )

      # Calculate text space needed below signature
      text_lines = 0
      text_lines += 1 if show_label
      text_lines += 1 if show_signer_name
      text_space = text_lines * 10

      # Calculate signature dimensions based on date position
      # This ensures the preview matches what's rendered
      sig_width, sig_height, sig_y_offset = case date_position
      when "right"
        # Fecha a la derecha: firma usa 75% del ancho
        [width * 0.75, height - text_space, 0]
      when "below"
        # Fecha debajo: firma usa 100% ancho, 80% alto, fecha en el 20% inferior
        [width, (height - text_space) * 0.80, (height - text_space) * 0.20]
      when "above"
        # Fecha arriba: firma usa 100% ancho, 80% alto, firma en el 80% inferior
        [width, (height - text_space) * 0.80, 0]
      when "none"
        # Sin fecha: firma usa 100% del espacio
        [width, height - text_space, 0]
      else
        [width * 0.75, height - text_space, 0]
      end

      # Calculate position from bottom (Prawn uses bottom-left origin)
      # y is distance from TOP of page to TOP of signature box
      # Prawn's image at: [x, y] positions the TOP-LEFT of the image at (x, y) from bottom-left origin
      # So we need: y_position_from_bottom = page_height - y_from_top
      sig_top_from_bottom = page_height - y + sig_y_offset

      Rails.logger.info "Signature overlay: x=#{x}, y=#{y}, sig_top_from_bottom=#{sig_top_from_bottom}, page_height=#{page_height}, date_position=#{date_position}, show_label=#{show_label}"

      # Draw signature image - fit maintains aspect ratio within the specified dimensions
      # at: positions TOP-LEFT corner of image at given coordinates
      pdf.image img_path, at: [x, sig_top_from_bottom], fit: [sig_width, sig_height]

      # Add optional label and signer name below signature
      # Position text below the signature (signature bottom = sig_top - sig_height)
      current_y = sig_top_from_bottom - sig_height - 3

      if show_label
        pdf.fill_color "333333"
        pdf.draw_text signatory.label, at: [x, current_y], size: 7
        pdf.fill_color "000000"
        current_y -= 10
      end

      if show_signer_name && sig_entry["signed_by_name"].present?
        pdf.fill_color "666666"
        pdf.draw_text sig_entry["signed_by_name"], at: [x, current_y], size: 6
        pdf.fill_color "000000"
      end

      # Add date based on position setting
      unless date_position == "none"
        pdf.fill_color "666666"
        signed_at = sig_entry["signed_at"]
        date_str = signed_at ? Time.parse(signed_at).strftime("%d/%m/%Y") : ""
        time_str = signed_at ? Time.parse(signed_at).strftime("%H:%M") : ""

        # Calculate signature center Y for positioning date
        sig_center_y = sig_top_from_bottom - (sig_height / 2)

        case date_position
        when "right"
          # Fecha a la derecha de la firma (vertical, centrada)
          date_x = x + sig_width + 5
          pdf.draw_text date_str, at: [date_x, sig_center_y + 5], size: 7
          pdf.draw_text time_str, at: [date_x, sig_center_y - 7], size: 6
        when "below"
          # Fecha debajo de la firma (horizontal, centrada)
          date_text = "#{date_str} #{time_str}"
          date_x = x + (width / 2) - 25
          date_y = sig_top_from_bottom - sig_height - 15
          pdf.draw_text date_text, at: [date_x, date_y], size: 7
        when "above"
          # Fecha arriba de la firma (horizontal, centrada)
          date_text = "#{date_str} #{time_str}"
          date_x = x + (width / 2) - 25
          date_y = sig_top_from_bottom + 5
          pdf.draw_text date_text, at: [date_x, date_y], size: 7
        end
        pdf.fill_color "000000"
      end

      pdf.render
    end

    def store_updated_pdf(pdf_content)
      file_name = file_name_base + "-signed.pdf"
      pdf_file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: file_name,
        content_type: "application/pdf"
      )

      # Keep as draft_file_id to maintain the workflow
      # Delete old file if exists
      Mongoid::GridFs.delete(draft_file_id) if draft_file_id
      update!(draft_file_id: pdf_file.id)
    end

    def file_name_base
      file_name&.gsub(/\.pdf$/i, "") || "document"
    end

    def pending_signatures_count
      signatures.count { |s| s["status"] == "pending" && s["required"] }
    end

    def completed_signatures_count
      signatures.count { |s| s["status"] == "signed" }
    end

    def total_required_signatures
      signatures.count { |s| s["required"] }
    end

    def all_required_signed?
      signatures.select { |s| s["required"] }.all? { |s| s["status"] == "signed" }
    end

    def can_be_signed_by?(user)
      signatures.any? do |s|
        s["user_id"] == user.id.to_s && s["status"] == "pending" && can_sign_at_position?(s)
      end
    end

    # Check if sequential signing is enabled for this document's template
    def sequential_signing?
      template&.sequential_signing != false
    end

    # Check if a signature at a given position can be signed now
    # (all previous required signatures must be completed)
    def can_sign_at_position?(sig_entry)
      return true unless sequential_signing?

      sig_index = signatures.index(sig_entry)
      return true if sig_index.nil? || sig_index.zero?

      # Check all previous required signatures are signed
      signatures[0...sig_index].all? do |prev_sig|
        !prev_sig["required"] || prev_sig["status"] == "signed"
      end
    end

    # Get the signatures that are blocking a given signature
    def blocking_signatures_for(sig_entry)
      return [] unless sequential_signing?

      sig_index = signatures.index(sig_entry)
      return [] if sig_index.nil? || sig_index.zero?

      # Return all previous required signatures that are not signed
      signatures[0...sig_index].select do |prev_sig|
        prev_sig["required"] && prev_sig["status"] != "signed"
      end
    end

    # Get signature status with order information
    def signature_with_order_status(sig_entry)
      can_sign = can_sign_at_position?(sig_entry)
      blocking = blocking_signatures_for(sig_entry)

      {
        can_sign_now: can_sign,
        waiting_for: blocking.map { |b| b["signatory_label"] || b["label"] },
        waiting_count: blocking.count
      }
    end

    # Get next signatory who can sign
    def next_signatory_to_sign
      return nil unless pending_signatures?

      pending_signatories.find { |sig| can_sign_at_position?(sig) }
    end

    def pending_signatories
      signatures.select { |s| s["status"] == "pending" }
    end

    def signed_signatories
      signatures.select { |s| s["status"] == "signed" }
    end

    # Get the current file (final if completed, draft otherwise)
    def current_file_id
      completed? && final_file_id ? final_file_id : draft_file_id
    end

    def file_content
      file_id = current_file_id
      return nil unless file_id

      file = Mongoid::GridFs.get(file_id)
      file.data
    rescue StandardError => e
      Rails.logger.error "Error reading generated document from GridFS: #{e.message}"
      nil
    end

    def docx_content
      return nil unless docx_file_id

      file = Mongoid::GridFs.get(docx_file_id)
      file.data
    rescue StandardError => e
      Rails.logger.error "Error reading DOCX from GridFS: #{e.message}"
      nil
    end

    def pending_pdf?
      pdf_generation_status == "pending"
    end

    def store_pdf_from_sync!(pdf_content)
      file_name = "#{name.parameterize}.pdf"
      pdf_file = Mongoid::GridFs.put(
        StringIO.new(pdf_content),
        filename: file_name,
        content_type: "application/pdf"
      )

      update!(
        draft_file_id: pdf_file.id,
        pdf_generation_status: "completed"
      )

      # Initialize signatures now that we have a PDF
      initialize_signatures!
    end

    def cancel!(reason: nil)
      update!(
        status: CANCELLED,
        variable_values: variable_values.merge("cancellation_reason" => reason)
      )
    end

    private

    def signature_context
      src = source
      # Use direct employee reference if available, otherwise try to get from source
      emp = employee || (src.respond_to?(:employee) ? src.employee : nil)

      {
        employee: emp,
        organization: organization,
        request: src
      }
    end

    def find_pending_signature_for(user)
      signatures.find do |s|
        s["user_id"] == user.id.to_s && s["status"] == "pending"
      end
    end

    def check_completion!
      return unless all_required_signed?

      # Generate final PDF with all signatures
      Templates::PdfSignatureService.new(self).apply_all_signatures!

      update!(status: COMPLETED, completed_at: Time.current)
    end

    class SignatureError < StandardError; end
  end
end
