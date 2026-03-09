# frozen_string_literal: true

# =============================================================
# Valkyria ECM — RequestTrackerAgent
# Monitorea el ciclo de vida de solicitudes: detecta estancadas,
# valida transiciones de estado y verifica asignaciones.
#
# Triggers: request.created, request.status_changed,
#           request.assigned, cron.every_30min
# =============================================================
class RequestTrackerAgent < BaseAgent
  # Transiciones de estado válidas por defecto
  DEFAULT_VALID_TRANSITIONS = {
    "draft"       => %w[submitted cancelled],
    "submitted"   => %w[in_review assigned cancelled],
    "assigned"    => %w[in_review in_progress cancelled],
    "in_review"   => %w[approved rejected returned],
    "in_progress" => %w[completed cancelled],
    "approved"    => %w[completed],
    "rejected"    => %w[draft submitted],
    "returned"    => %w[draft submitted],
    "completed"   => %w[archived],
    "cancelled"   => [],
    "archived"    => []
  }.freeze

  # SLAs por defecto (en horas) por estado
  DEFAULT_SLA_HOURS = {
    "submitted"   => 24,
    "assigned"    => 8,
    "in_review"   => 48,
    "in_progress" => 72,
    "approved"    => 24
  }.freeze

  private

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  def run_checks
    check_required_fields
    check_assigned_to_valid_user
    check_sla_compliance
    check_valid_state_transition
    check_required_attachments
    check_no_duplicates
  end

  # -----------------------------------------------------------
  # Acciones correctivas
  # -----------------------------------------------------------
  def take_actions
    results[:failures].each do |failure|
      case failure[:name]
      when "sla_compliance"
        handle_sla_breach(failure)
      when "assigned_to_valid_user"
        handle_invalid_assignment(failure)
      when "valid_state_transition"
        handle_invalid_transition(failure)
      when "required_fields"
        handle_incomplete_request(failure)
      when "required_attachments"
        handle_missing_attachments(failure)
      when "no_duplicates"
        handle_duplicate_request(failure)
      end
    end
  end

  # -----------------------------------------------------------
  # Checks individuales
  # -----------------------------------------------------------

  # ¿La solicitud tiene todos los campos requeridos?
  def check_required_fields
    rule = load_rule("required_fields")
    return unless rule

    fields = rule.rule_config.fetch("fields", [])
    missing = fields.select do |field|
      document.try(field).blank?
    end

    add_check("required_fields", missing.empty?, {
      required: fields,
      missing: missing
    })
  end

  # ¿Está asignada a un usuario válido y activo?
  def check_assigned_to_valid_user
    assignee_id = document.try(:assigned_to) || document.try(:assignee_id)
    return add_check("assigned_to_valid_user", true, { note: "Sin asignar aún" }) if assignee_id.blank?

    # Verificar que el usuario exista y esté activo
    user = User.find_by(id: assignee_id)
    valid = user.present? && user.try(:active?)

    add_check("assigned_to_valid_user", valid, {
      assignee_id: assignee_id,
      user_found: user.present?,
      user_active: user&.try(:active?)
    })
  end

  # ¿El tiempo en el estado actual cumple con el SLA?
  def check_sla_compliance
    current_status = document.try(:status)&.to_s
    return unless current_status.present?

    # Obtener SLA personalizado o usar default
    rule = load_rule("sla_hours")
    sla_config = rule&.rule_config || DEFAULT_SLA_HOURS
    max_hours = sla_config[current_status]

    return unless max_hours # No hay SLA para este estado

    # Calcular tiempo en estado actual
    status_changed_at = document.try(:status_changed_at) ||
                        document.try(:updated_at) ||
                        document.try(:created_at)

    return unless status_changed_at

    hours_in_state = ((Time.current - status_changed_at) / 1.hour).round(1)
    within_sla = hours_in_state <= max_hours

    add_check("sla_compliance", within_sla, {
      current_status: current_status,
      hours_in_state: hours_in_state,
      max_hours: max_hours,
      exceeded_by: within_sla ? 0 : (hours_in_state - max_hours).round(1)
    })
  end

  # ¿La transición de estado es válida?
  def check_valid_state_transition
    return unless context[:event_type] == "request.status_changed"

    previous_status = context[:previous_status]&.to_s
    new_status = document.try(:status)&.to_s

    return unless previous_status.present? && new_status.present?

    # Obtener transiciones válidas
    rule = load_rule("valid_transitions")
    transitions = rule&.rule_config || DEFAULT_VALID_TRANSITIONS

    allowed = transitions.fetch(previous_status, [])
    valid = allowed.include?(new_status)

    add_check("valid_state_transition", valid, {
      from: previous_status,
      to: new_status,
      allowed_transitions: allowed
    })
  end

  # ¿Están presentes los documentos adjuntos requeridos?
  def check_required_attachments
    rule = load_rule("required_attachments")
    return unless rule

    required_types = rule.rule_config.fetch("attachment_types", [])
    existing_types = document.try(:attachments)&.pluck(:attachment_type) || []

    missing = required_types - existing_types

    add_check("required_attachments", missing.empty?, {
      required: required_types,
      existing: existing_types,
      missing: missing
    })
  end

  # ¿No hay solicitudes duplicadas para el mismo proceso?
  def check_no_duplicates
    return unless document.respond_to?(:document_type) && document.respond_to?(:requester_id)

    # Buscar solicitudes similares recientes (últimas 24 horas)
    scope = document.class
                    .where(document_type: document.document_type)
                    .where(requester_id: document.requester_id)
                    .where(:created_at.gte => 24.hours.ago)
                    .where(:id.ne => document.id)
                    .where(:status.nin => %w[cancelled archived])

    duplicates = scope.to_a

    add_check("no_duplicates", duplicates.empty?, {
      duplicate_count: duplicates.size,
      duplicate_ids: duplicates.map(&:id).map(&:to_s)
    })
  end

  # -----------------------------------------------------------
  # Acciones
  # -----------------------------------------------------------
  def handle_sla_breach(failure)
    exceeded_by = failure.dig(:details, :exceeded_by) || 0
    severity = exceeded_by > 24 ? :critical : :warning

    alert!(severity, "SLA excedido en solicitud #{document.id}: " \
      "#{exceeded_by}h de más en estado '#{failure.dig(:details, :current_status)}'")

    # Intentar escalar
    escalate_request if exceeded_by > 24
    add_action("sla_breach_alert", failure[:details])
  end

  def handle_invalid_assignment(failure)
    alert!(:warning, "Solicitud #{document.id} asignada a usuario inválido/inactivo")
    add_action("flag_invalid_assignment", failure[:details])
  end

  def handle_invalid_transition(failure)
    alert!(:critical, "Transición de estado inválida en solicitud #{document.id}: " \
      "#{failure.dig(:details, :from)} → #{failure.dig(:details, :to)}")
    add_action("block_invalid_transition", failure[:details])
  end

  def handle_incomplete_request(failure)
    alert!(:warning, "Solicitud #{document.id} incompleta: campos faltantes #{failure.dig(:details, :missing)}")
    add_action("flag_incomplete", failure[:details])
  end

  def handle_missing_attachments(failure)
    alert!(:warning, "Solicitud #{document.id} sin adjuntos requeridos: #{failure.dig(:details, :missing)}")
    add_action("flag_missing_attachments", failure[:details])
  end

  def handle_duplicate_request(failure)
    alert!(:info, "Posible solicitud duplicada: #{document.id}")
    add_action("flag_duplicate", failure[:details])
  end

  # -----------------------------------------------------------
  # Utilidades
  # -----------------------------------------------------------
  def escalate_request
    # Buscar supervisor del asignado actual
    assignee_id = document.try(:assigned_to) || document.try(:assignee_id)
    return unless assignee_id

    user = User.find_by(id: assignee_id)
    supervisor_id = user&.try(:supervisor_id)

    if supervisor_id
      document.update(escalated_to: supervisor_id)
      add_action("escalate_to_supervisor", { supervisor_id: supervisor_id.to_s })
    end
  end
end
