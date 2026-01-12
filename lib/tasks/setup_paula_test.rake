# frozen_string_literal: true

namespace :test_data do
  desc "Generate new document for Paula with her data"
  task generate_paula_contract: :environment do
    paula_user = Identity::User.where(email: /paula/i).first
    paula_emp = Hr::Employee.where(user_id: paula_user.id).first
    template = Templates::Template.where(name: /Contrato termino indefinido/i).first

    puts "Employee: #{paula_emp.full_name}"
    puts "Template: #{template.name}"

    # Delete existing test documents for Paula
    Templates::GeneratedDocument.where(
      employee_id: paula_emp.id,
      :name => /paula/i
    ).destroy_all
    puts "Deleted old test documents"

    service = Templates::DocumentGeneratorService.new(
      template: template,
      employee: paula_emp,
      requested_by: paula_user
    )

    result = service.generate

    if result[:success]
      doc = result[:document]
      puts ""
      puts "=== Document Generated ==="
      puts "UUID: #{doc.uuid}"
      puts "Name: #{doc.name}"
      puts "Status: #{doc.status}"
      puts "Has PDF: #{doc.draft_file_id.present?}"

      # Initialize signatures if template has signatories
      if template.signatories.any?
        doc.initialize_signatures!
        doc.update!(status: "pending_signatures")
        doc.reload
        puts ""
        puts "Signatures initialized:"
        doc.signatures.each_with_index do |sig, idx|
          puts "  #{idx + 1}. #{sig['signatory_label']}: #{sig['status']} (#{sig['user_name']})"
        end
      end

      puts ""
      puts "Paula can sign: #{doc.can_be_signed_by?(paula_user)}"
    else
      puts "Error: #{result[:error]}"
    end
  end

  desc "Recreate Paula's document with clean PDF"
  task recreate_paula_doc: :environment do
    # Get clean PDF from draft document
    clean_doc = Templates::GeneratedDocument.where(uuid: "acb4c1d7-ba68-4edc-a363-8e272a43b8a8").first
    unless clean_doc&.draft_file_id
      puts "ERROR: No clean PDF found"
      exit 1
    end

    pdf_content = clean_doc.file_content
    unless pdf_content
      puts "ERROR: Cannot read PDF"
      exit 1
    end
    puts "Clean PDF size: #{pdf_content.size} bytes"

    # Store new copy of PDF
    new_file_name = "contrato-paula-limpio-#{Time.now.strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_file = Mongoid::GridFs.put(
      StringIO.new(pdf_content),
      filename: new_file_name,
      content_type: "application/pdf"
    )
    puts "Stored new PDF: #{pdf_file.id}"

    # Get Paula and template
    paula = Identity::User.where(email: /paula/i).first
    template = Templates::Template.where(name: /Contrato termino indefinido/i).first
    org = Identity::Organization.first
    paula_emp = Hr::Employee.for_user(paula) || Hr::Employee.where(email: paula.email).first

    # Get legal user
    legal_user = Identity::User.where(email: /legal/i).first ||
                 Identity::User.where(email: /nathalia/i).first

    # Get template signatories
    emp_sig = template.signatories.where(signatory_type_code: "employee").first
    legal_sig = template.signatories.where(signatory_type_code: "legal_representative").first

    # Delete old document
    old_doc = Templates::GeneratedDocument.where(uuid: "7282513c-a2d6-4a2a-87a2-12220128dd39").first
    if old_doc
      old_doc.destroy
      puts "Deleted old document"
    end

    # Create new document
    doc = Templates::GeneratedDocument.create!(
      name: new_file_name,
      file_name: new_file_name,
      template: template,
      organization: org,
      requested_by: paula,
      employee: paula_emp,
      status: "pending_signatures",
      draft_file_id: pdf_file.id,
      variable_values: {},
      signatures: [
        {
          "signatory_id" => emp_sig.uuid,
          "signatory_type_code" => "employee",
          "signatory_role" => emp_sig.role,
          "signatory_label" => "Empleado Solicitante",
          "label" => "Empleado Solicitante",
          "user_id" => paula.id.to_s,
          "user_name" => paula.full_name,
          "required" => true,
          "status" => "pending",
          "signature_id" => nil,
          "signed_at" => nil,
          "signed_by_name" => nil
        },
        {
          "signatory_id" => legal_sig.uuid,
          "signatory_type_code" => "legal_representative",
          "signatory_role" => legal_sig.role,
          "signatory_label" => "Representante Legal",
          "label" => "Representante Legal",
          "user_id" => legal_user&.id&.to_s,
          "user_name" => legal_user&.full_name,
          "required" => true,
          "status" => "pending",
          "signature_id" => nil,
          "signed_at" => nil,
          "signed_by_name" => nil
        }
      ]
    )

    puts ""
    puts "=== New document created ==="
    puts "UUID: #{doc.uuid}"
    puts "Name: #{doc.name}"
    puts "Status: #{doc.status}"
    puts "Signatures:"
    doc.signatures.each_with_index do |sig, idx|
      puts "  #{idx + 1}. #{sig['signatory_label']}: #{sig['status']}"
    end
    puts ""
    puts "Paula can sign: #{doc.can_be_signed_by?(paula)}"
  end

  desc "Fix signature order: Employee first, then Legal Representative"
  task fix_contract_order: :environment do
    # Fix template order
    template = Templates::Template.where(name: /Contrato termino indefinido/i).first
    puts "Template: #{template.name}"

    template.signatories.each do |sig|
      if sig.signatory_type_code == "employee"
        sig.update!(position: 1)
        puts "  #{sig.label} -> Position 1"
      elsif sig.signatory_type_code == "legal_representative"
        sig.update!(position: 2)
        puts "  #{sig.label} -> Position 2"
      end
    end

    # Reset document signatures
    doc = Templates::GeneratedDocument.where(uuid: "7282513c-a2d6-4a2a-87a2-12220128dd39").first
    if doc
      puts "\nResetting document: #{doc.name}"

      # Get users
      paula = Identity::User.where(email: /paula/i).first
      legal_user = Identity::User.where(email: /legal/i).first ||
                   Identity::User.where(email: /nathalia/i).first

      # Get signatories
      emp_sig = template.signatories.where(signatory_type_code: "employee").first
      legal_sig = template.signatories.where(signatory_type_code: "legal_representative").first

      # Reset signatures with correct order
      doc.signatures = [
        {
          "signatory_id" => emp_sig.uuid,
          "signatory_type_code" => "employee",
          "signatory_role" => emp_sig.role,
          "signatory_label" => "Empleado Solicitante",
          "label" => "Empleado Solicitante",
          "user_id" => paula.id.to_s,
          "user_name" => paula.full_name,
          "required" => true,
          "status" => "pending",
          "signature_id" => nil,
          "signed_at" => nil,
          "signed_by_name" => nil
        },
        {
          "signatory_id" => legal_sig.uuid,
          "signatory_type_code" => "legal_representative",
          "signatory_role" => legal_sig.role,
          "signatory_label" => "Representante Legal",
          "label" => "Representante Legal",
          "user_id" => legal_user&.id&.to_s,
          "user_name" => legal_user&.full_name,
          "required" => true,
          "status" => "pending",
          "signature_id" => nil,
          "signed_at" => nil,
          "signed_by_name" => nil
        }
      ]
      doc.status = "pending_signatures"
      doc.save!

      puts "Document reset. New signature order:"
      doc.signatures.each_with_index do |sig, idx|
        puts "  #{idx + 1}. #{sig['signatory_label']}: #{sig['status']}"
      end
    end

    puts "\nDone!"
  end

  desc "Assign employee to Paula's test document"
  task assign_paula_employee: :environment do
    paula = Identity::User.find_by(email: /paula/i)
    doc = Templates::GeneratedDocument.find_by(uuid: "7282513c-a2d6-4a2a-87a2-12220128dd39")

    unless doc
      puts "Document not found"
      exit 1
    end

    # Find or create employee for Paula
    employee = Hr::Employee.where(email: paula.email).first || Hr::Employee.for_user(paula)

    if employee.nil?
      employee = Hr::Employee.create!(
        first_name: paula.first_name || "Paula",
        last_name: paula.last_name || "Carrillo",
        email: paula.email,
        user_id: paula.id,
        organization_id: paula.organization_id,
        employee_number: "EMP-#{paula.id.to_s[-4..-1]}",
        hire_date: Date.today,
        status: "active"
      )
      puts "Created employee: #{employee.full_name}"
    else
      puts "Existing employee: #{employee.full_name} (#{employee.id})"
    end

    doc.update!(employee_id: employee.id)
    puts "Document updated with employee_id: #{doc.employee_id}"
  end

  desc "Fix signatory positions to be 1-based"
  task fix_signatory_positions: :environment do
    Templates::Template.all.each do |template|
      next if template.signatories.empty?

      puts "Template: #{template.name}"

      # Sort signatories by current position and reassign 1, 2, 3...
      sorted = template.signatories.sort_by { |s| s.position || 0 }
      sorted.each_with_index do |sig, idx|
        new_position = idx + 1
        if sig.position != new_position
          puts "  #{sig.label}: #{sig.position} -> #{new_position}"
          sig.update!(position: new_position)
        else
          puts "  #{sig.label}: #{sig.position} (OK)"
        end
      end
    end
    puts "\nDone!"
  end

  desc "Fix documents with inconsistent status"
  task fix_status: :environment do
    docs = Templates::GeneratedDocument.where(status: "pending_signatures")
    fixed = 0
    docs.each do |doc|
      if doc.all_required_signed?
        puts "Fixing: #{doc.name} (#{doc.uuid})"
        doc.update!(status: "completed", completed_at: Time.current)
        fixed += 1
      end
    end
    puts ""
    puts "Fixed #{fixed} documents"
  end

  desc "Setup Paula with signature and test document"
  task setup_paula: :environment do
    puts "Finding Paula..."
    paula = Identity::User.where(email: /paula/i).first

    unless paula
      puts "ERROR: Paula not found"
      exit 1
    end

    puts "Paula: #{paula.full_name} (ID: #{paula.id})"

    # Create signature for Paula if missing
    if paula.signatures.active.empty?
      puts "Creating digital signature for Paula..."
      sig = Identity::UserSignature.create!(
        user: paula,
        name: "Firma Paula",
        signature_type: "styled",
        styled_text: "Paula Carrillo",
        font_family: "Dancing Script",
        active: true,
        is_default: true
      )
      puts "Created: #{sig.name} (#{sig.uuid})"
    else
      puts "Paula already has signature: #{paula.signatures.active.first.name}"
    end

    # Find template with signatories
    template = Templates::Template.where(name: /Contrato termino indefinido/i).first ||
               Templates::Template.where("signatories.signatory_type_code" => "employee").first

    unless template
      puts "ERROR: No suitable template found"
      exit 1
    end

    puts "Template: #{template.name}"

    # Find existing document with PDF
    source_doc = Templates::GeneratedDocument.where(:draft_file_id.ne => nil).order(created_at: :desc).first
    unless source_doc
      puts "ERROR: No document with PDF found"
      exit 1
    end

    pdf_content = source_doc.file_content
    unless pdf_content
      puts "ERROR: Cannot read source PDF"
      exit 1
    end
    puts "Source PDF: #{pdf_content.size} bytes"

    # Get users
    org = Identity::Organization.first
    legal_user = Identity::User.where(email: /legal/i).first ||
                 Identity::User.where(email: /admin/i).first ||
                 Identity::User.first

    # Ensure legal user has signature
    if legal_user.signatures.active.empty?
      legal_sig = Identity::UserSignature.create!(
        user: legal_user,
        name: "Firma Legal",
        signature_type: "styled",
        styled_text: legal_user.full_name,
        font_family: "Dancing Script",
        active: true,
        is_default: true
      )
    else
      legal_sig = legal_user.signatures.active.first
    end

    # Get template signatories
    employee_sig = template.signatories.find { |s| s.signatory_type_code == "employee" }
    legal_rep_sig = template.signatories.find { |s| s.signatory_type_code == "legal_representative" }

    unless employee_sig && legal_rep_sig
      puts "ERROR: Template missing required signatories"
      puts "Available: #{template.signatories.map(&:signatory_type_code).join(', ')}"
      exit 1
    end

    # Store new PDF copy
    file_name = "contrato-paula-pendiente-#{Time.now.strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_file = Mongoid::GridFs.put(
      StringIO.new(pdf_content),
      filename: file_name,
      content_type: "application/pdf"
    )
    puts "Stored PDF with ID: #{pdf_file.id}"

    # Create document
    doc = Templates::GeneratedDocument.create!(
      name: file_name,
      file_name: file_name,
      template: template,
      organization: org,
      requested_by: paula,
      status: Templates::GeneratedDocument::PENDING_SIGNATURES,
      draft_file_id: pdf_file.id,
      variable_values: {}
    )

    doc.signatures = [
      {
        "signatory_id" => legal_rep_sig.uuid,
        "signatory_type_code" => "legal_representative",
        "signatory_role" => legal_rep_sig.role,
        "signatory_label" => "Representante Legal",
        "label" => "Representante Legal",
        "user_id" => legal_user.id.to_s,
        "user_name" => legal_user.full_name,
        "required" => true,
        "status" => "signed",
        "signature_id" => legal_sig.uuid,
        "signed_at" => Time.current.iso8601,
        "signed_by_name" => legal_user.full_name
      },
      {
        "signatory_id" => employee_sig.uuid,
        "signatory_type_code" => "employee",
        "signatory_role" => employee_sig.role,
        "signatory_label" => "Empleado Solicitante",
        "label" => "Empleado Solicitante",
        "user_id" => paula.id.to_s,
        "user_name" => paula.full_name,
        "required" => true,
        "status" => "pending",
        "signature_id" => nil,
        "signed_at" => nil,
        "signed_by_name" => nil
      }
    ]
    doc.save!

    puts ""
    puts "=" * 50
    puts "Document created for Paula to sign"
    puts "UUID: #{doc.uuid}"
    puts "Name: #{doc.name}"
    puts "Status: #{doc.status}"
    puts "Paula can sign: #{doc.can_be_signed_by?(paula)}"
    puts "=" * 50
  end
end
