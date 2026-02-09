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
        link: "/hr/approvals"
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
        link: "/hr/my-requests/vacations"
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
        link: "/hr/my-requests/vacations"
      )
    end

    def certification_completed(certification)
      employee_user = certification.employee.user
      return unless employee_user

      create_notification(
        recipient: employee_user,
        organization: certification.organization,
        category: "certification",
        action: "completed",
        title: "Certificaci\u00F3n completada",
        body: "Tu solicitud de certificaci\u00F3n laboral ha sido completada",
        actor_name: nil,
        source_type: "Hr::EmploymentCertificationRequest",
        source_uuid: certification.uuid,
        link: "/hr/my-requests/certifications"
      )
    end

    def certification_rejected(certification)
      employee_user = certification.employee.user
      return unless employee_user

      create_notification(
        recipient: employee_user,
        organization: certification.organization,
        category: "certification",
        action: "rejected",
        title: "Certificaci\u00F3n rechazada",
        body: "Tu solicitud de certificaci\u00F3n laboral fue rechazada: #{certification.rejection_reason}",
        actor_name: nil,
        source_type: "Hr::EmploymentCertificationRequest",
        source_uuid: certification.uuid,
        link: "/hr/my-requests/certifications"
      )
    end

    private

    def create_notification(attrs)
      Notification.create!(attrs)
    rescue StandardError => e
      Rails.logger.error("NotificationService error: #{e.message}")
    end
  end
end
