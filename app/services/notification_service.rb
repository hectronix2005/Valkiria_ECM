# frozen_string_literal: true

class NotificationService
  class << self
    def vacation_submitted(vacation_request)
      approver_user = vacation_request.approver&.user
      return unless approver_user

      create_notification(
        recipient: approver_user,
        organization: vacation_request.organization,
        category: "vacation",
        action: "submitted",
        title: "Nueva solicitud de vacaciones",
        body: "#{vacation_request.employee.full_name} solicit\u00F3 #{vacation_request.days_requested} d\u00EDas de vacaciones",
        actor_name: vacation_request.employee.full_name,
        source_type: "Hr::VacationRequest",
        source_uuid: vacation_request.uuid,
        link: "/hr/approvals?id=#{vacation_request.uuid}"
      )
    end

    def vacation_approved(vacation_request)
      employee_user = vacation_request.employee.user
      return unless employee_user

      create_notification(
        recipient: employee_user,
        organization: vacation_request.organization,
        category: "vacation",
        action: "approved",
        title: "Vacaciones aprobadas",
        body: "Tu solicitud de #{vacation_request.days_requested} d\u00EDas de vacaciones fue aprobada",
        actor_name: vacation_request.approved_by_name,
        source_type: "Hr::VacationRequest",
        source_uuid: vacation_request.uuid,
        link: "/hr/my-requests/vacations?id=#{vacation_request.uuid}"
      )
    end

    def vacation_rejected(vacation_request)
      employee_user = vacation_request.employee.user
      return unless employee_user

      create_notification(
        recipient: employee_user,
        organization: vacation_request.organization,
        category: "vacation",
        action: "rejected",
        title: "Vacaciones rechazadas",
        body: "Tu solicitud de vacaciones fue rechazada: #{vacation_request.decision_reason}",
        actor_name: vacation_request.approved_by_name,
        source_type: "Hr::VacationRequest",
        source_uuid: vacation_request.uuid,
        link: "/hr/my-requests/vacations?id=#{vacation_request.uuid}"
      )
    end

    def certification_submitted(certification)
      type_label = certification_type_label(certification.certification_type)

      # Find HR roles and notify all HR users in the organization
      hr_roles = ::Identity::Role.where(:name.in => %w[hr hr_manager admin])
      hr_users = ::Identity::User.where(
        organization_id: certification.organization_id,
        :role_ids.in => hr_roles.pluck(:id)
      )

      hr_users.each do |hr_user|
        next if hr_user.id == certification.employee&.user_id

        create_notification(
          recipient: hr_user,
          organization: certification.organization,
          category: "certification",
          action: "submitted",
          title: "Nueva solicitud de #{type_label.downcase}",
          body: "#{certification.employee.full_name} solicitó #{type_label.downcase} #{certification.request_number}",
          actor_name: certification.employee.full_name,
          source_type: "Hr::EmploymentCertificationRequest",
          source_uuid: certification.uuid,
          link: "/hr/my-requests/certifications?id=#{certification.uuid}"
        )
      end
    end

    def certification_completed(certification)
      employee_user = certification.employee.user
      return unless employee_user

      type_label = certification_type_label(certification.certification_type)

      create_notification(
        recipient: employee_user,
        organization: certification.organization,
        category: "certification",
        action: "completed",
        title: "#{type_label} completada",
        body: "Tu #{type_label.downcase} #{certification.request_number} ha sido completada",
        actor_name: certification.processed_by&.full_name,
        source_type: "Hr::EmploymentCertificationRequest",
        source_uuid: certification.uuid,
        link: "/hr/my-requests/certifications?id=#{certification.uuid}"
      )
    end

    def certification_rejected(certification)
      employee_user = certification.employee.user
      return unless employee_user

      type_label = certification_type_label(certification.certification_type)

      create_notification(
        recipient: employee_user,
        organization: certification.organization,
        category: "certification",
        action: "rejected",
        title: "#{type_label} rechazada",
        body: "Tu #{type_label.downcase} #{certification.request_number} fue rechazada: #{certification.rejection_reason}",
        actor_name: certification.processed_by&.full_name,
        source_type: "Hr::EmploymentCertificationRequest",
        source_uuid: certification.uuid,
        link: "/hr/my-requests/certifications?id=#{certification.uuid}"
      )
    end

    # Notify all users who signed a document when the associated request changes status
    def notify_document_signers(request, new_status, actor:) # rubocop:disable Metrics/MethodLength, Metrics/AbcSize
      document_uuid = request.document_uuid
      return unless document_uuid.present?

      doc = ::Templates::GeneratedDocument.where(uuid: document_uuid).first
      return unless doc

      signed_entries = (doc.signatures || []).select { |s| s["status"] == "signed" && s["user_id"].present? }
      return if signed_entries.empty?

      signer_user_ids = signed_entries.map { |s| s["user_id"] }.uniq
      signer_users = ::Identity::User.where(:id.in => signer_user_ids)

      # Determine request type info for notification text
      case request
      when ::Hr::VacationRequest
        category = "vacation"
        request_label = "vacaciones #{request.request_number}"
        link = "/hr/my-requests/vacations?id=#{request.uuid}"
      when ::Hr::EmploymentCertificationRequest
        type_label = certification_type_label(request.certification_type)
        category = "certification"
        request_label = "#{type_label.downcase} #{request.request_number}"
        link = "/hr/my-requests/certifications?id=#{request.uuid}"
      else
        return
      end

      status_label = status_label_for(new_status)

      actor_user_id = (actor&.user_id || actor&.user&.id)&.to_s

      signer_users.each do |signer_user|
        # Don't notify the actor who triggered the change
        next if signer_user.id.to_s == actor_user_id

        create_notification(
          recipient: signer_user,
          organization: request.organization,
          category: category,
          action: "document_signer_#{new_status}",
          title: "Documento firmado: solicitud #{status_label}",
          body: "La solicitud de #{request_label} que firmaste cambió a #{status_label}",
          actor_name: actor&.full_name,
          source_type: request.class.name,
          source_uuid: request.uuid,
          link: link
        )
      end
    end

    private

    STATUS_LABELS = {
      "pending" => "solicitada",
      "approved" => "aprobada",
      "rejected" => "rechazada",
      "cancelled" => "cancelada",
      "enjoyed" => "disfrutada",
      "processing" => "en proceso",
      "completed" => "completada"
    }.freeze

    def status_label_for(status)
      STATUS_LABELS[status] || status
    end

    CERTIFICATION_TYPE_LABELS = {
      "employment" => "Certificaci\u00F3n Laboral",
      "salary" => "Certificaci\u00F3n Salarial",
      "position" => "Certificaci\u00F3n de Cargo",
      "full" => "Certificaci\u00F3n Completa",
      "custom" => "Certificaci\u00F3n Personalizada"
    }.freeze

    def certification_type_label(type)
      CERTIFICATION_TYPE_LABELS[type] || "Certificaci\u00F3n"
    end

    def create_notification(attrs)
      if attrs[:source_uuid].present?
        existing = Notification.where(
          source_uuid: attrs[:source_uuid],
          action: attrs[:action],
          recipient_id: attrs[:recipient]&.id
        ).first
        return existing if existing
      end

      Notification.create!(attrs)
    rescue StandardError => e
      Rails.logger.error("NotificationService error: #{e.message}")
      ErrorLoggingService.capture_service_error(e,
        service: "NotificationService",
        severity: "warning",
        metadata: { category: attrs[:category], action: attrs[:action] }
      )
    end
  end
end
