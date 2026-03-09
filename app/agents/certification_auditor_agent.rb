# frozen_string_literal: true

# =============================================================
# Valkyria ECM — CertificationAuditorAgent
# Audita certificaciones: cadena de aprobaciones, vigencia,
# documentos soporte y formato del certificado.
#
# Triggers: certification.issued, certification.renewed, cron.daily
# =============================================================
class CertificationAuditorAgent < BaseAgent
  # Días antes del vencimiento para alertar
  EXPIRY_WARNING_DAYS = 30
  EXPIRY_CRITICAL_DAYS = 7

  private

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  def run_checks
    check_approvals_complete
    check_approval_order
    check_expiry_date
    check_associated_certificate
    check_support_documents
    check_certificate_format
  end

  # -----------------------------------------------------------
  # Acciones correctivas
  # -----------------------------------------------------------
  def take_actions
    results[:failures].each do |failure|
      case failure[:name]
      when "expiry_date"
        handle_expiry(failure)
      when "approvals_complete"
        handle_missing_approvals(failure)
      when "associated_certificate"
        handle_missing_certificate(failure)
      when "support_documents"
        handle_missing_support(failure)
      when "approval_order"
        handle_wrong_approval_order(failure)
      when "certificate_format"
        handle_bad_format(failure)
      end
    end
  end

  # -----------------------------------------------------------
  # Checks individuales
  # -----------------------------------------------------------

  # ¿La certificación tiene todas las aprobaciones requeridas?
  def check_approvals_complete
    rule = load_rule("required_approvals")
    required_roles = rule&.rule_config&.fetch("roles", []) ||
                     %w[reviewer approver director]

    existing = document.try(:approvals)&.pluck(:approver_role) || []
    missing = required_roles - existing

    add_check("approvals_complete", missing.empty?, {
      required: required_roles,
      existing: existing,
      missing: missing
    })
  end

  # ¿Las aprobaciones están en el orden jerárquico correcto?
  def check_approval_order
    approvals = document.try(:approvals)&.order(:approved_at) || []
    return if approvals.size < 2

    rule = load_rule("approval_order")
    return unless rule

    expected = rule.rule_config.fetch("order", [])
    actual = approvals.map(&:approver_role)

    # Verificar orden relativo
    filtered_expected = expected.select { |r| actual.include?(r) }
    filtered_actual = actual.select { |r| expected.include?(r) }
    in_order = filtered_expected == filtered_actual

    add_check("approval_order", in_order, {
      expected: expected,
      actual: actual
    })
  end

  # ¿La certificación no está expirada o próxima a expirar?
  def check_expiry_date
    expires_at = document.try(:expires_at) || document.try(:valid_until)
    return unless expires_at

    now = Time.current
    days_remaining = ((expires_at - now) / 1.day).round

    if expires_at < now
      # Ya expiró
      add_check("expiry_date", false, {
        expires_at: expires_at.iso8601,
        status: "expired",
        days_expired: days_remaining.abs
      })
    elsif days_remaining <= EXPIRY_CRITICAL_DAYS
      add_check("expiry_date", false, {
        expires_at: expires_at.iso8601,
        status: "critical",
        days_remaining: days_remaining
      })
    elsif days_remaining <= EXPIRY_WARNING_DAYS
      add_check("expiry_date", false, {
        expires_at: expires_at.iso8601,
        status: "warning",
        days_remaining: days_remaining
      })
    else
      add_check("expiry_date", true, {
        expires_at: expires_at.iso8601,
        days_remaining: days_remaining
      })
    end
  end

  # ¿Tiene un certificado digital válido asociado?
  def check_associated_certificate
    cert_data = document.try(:certificate_data) ||
                document.try(:digital_certificate)

    if cert_data.blank?
      add_check("associated_certificate", false, {
        reason: "No tiene certificado digital asociado"
      })
      return
    end

    begin
      cert = OpenSSL::X509::Certificate.new(cert_data)
      valid = cert.not_after > Time.current
      add_check("associated_certificate", valid, {
        issuer: cert.issuer.to_s,
        valid_until: cert.not_after.iso8601,
        serial: cert.serial.to_s
      })
    rescue OpenSSL::X509::CertificateError => e
      add_check("associated_certificate", false, {
        reason: "Certificado no se puede parsear: #{e.message}"
      })
    end
  end

  # ¿Están presentes los documentos soporte?
  def check_support_documents
    rule = load_rule("required_support_docs")
    return unless rule

    required = rule.rule_config.fetch("document_types", [])
    existing = document.try(:support_documents)&.pluck(:document_type) || []
    missing = required - existing

    add_check("support_documents", missing.empty?, {
      required: required,
      existing: existing,
      missing: missing
    })
  end

  # ¿El formato del certificado es correcto?
  def check_certificate_format
    rule = load_rule("certificate_format")
    return unless rule

    required_fields = rule.rule_config.fetch("fields", [])
    missing = required_fields.select do |field|
      document.try(field).blank? &&
        document.try(:metadata)&.dig(field).blank?
    end

    add_check("certificate_format", missing.empty?, {
      required_fields: required_fields,
      missing: missing
    })
  end

  # -----------------------------------------------------------
  # Acciones
  # -----------------------------------------------------------
  def handle_expiry(failure)
    status = failure.dig(:details, :status)

    case status
    when "expired"
      document.update!(status: :expired) if document.respond_to?(:status=)
      alert!(:critical, "Certificación #{document.id} EXPIRADA")
      add_action("mark_expired", failure[:details])

    when "critical"
      alert!(:critical, "Certificación #{document.id} expira en " \
        "#{failure.dig(:details, :days_remaining)} días")
      initiate_renewal if document.try(:auto_renew?)
      add_action("critical_expiry_alert", failure[:details])

    when "warning"
      alert!(:warning, "Certificación #{document.id} expira en " \
        "#{failure.dig(:details, :days_remaining)} días")
      add_action("expiry_warning", failure[:details])
    end
  end

  def handle_missing_approvals(failure)
    alert!(:warning, "Certificación #{document.id} sin aprobaciones completas: " \
      "#{failure.dig(:details, :missing)&.join(', ')}")
    add_action("flag_missing_approvals", failure[:details])
  end

  def handle_missing_certificate(failure)
    alert!(:critical, "Certificación #{document.id} sin certificado digital asociado")
    add_action("flag_no_certificate", failure[:details])
  end

  def handle_missing_support(failure)
    alert!(:warning, "Certificación #{document.id} sin documentos soporte: " \
      "#{failure.dig(:details, :missing)&.join(', ')}")
    add_action("flag_missing_support", failure[:details])
  end

  def handle_wrong_approval_order(failure)
    alert!(:warning, "Orden de aprobación incorrecto en certificación #{document.id}")
    add_action("flag_approval_order", failure[:details])
  end

  def handle_bad_format(failure)
    alert!(:warning, "Formato incorrecto en certificación #{document.id}")
    add_action("flag_format_issue", failure[:details])
  end

  # -----------------------------------------------------------
  # Utilidades
  # -----------------------------------------------------------
  def initiate_renewal
    # Crear solicitud de renovación automática
    add_action("initiate_auto_renewal", {
      certification_id: document.id.to_s,
      requested_at: Time.current.iso8601
    })
  end
end
