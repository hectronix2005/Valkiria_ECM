# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AgentOrchestrator
# Servicio central que despacha los agentes correctos según
# el tipo de evento. Es el "cerebro" del sistema guardian.
#
# Uso:
#   AgentOrchestrator.dispatch("document.created", document)
#   AgentOrchestrator.scan_all(StorageSentinelAgent)
# =============================================================
class AgentOrchestrator
  # Registro completo de TODOS los agentes guardian (event-driven + cron-only)
  # Se usan strings para evitar NameError por autoloading de Zeitwerk
  ALL_AGENT_NAMES = %w[
    DocValidatorAgent
    SignatureGuardianAgent
    RequestTrackerAgent
    StorageSentinelAgent
    CertificationAuditorAgent
    ServiceHealthAgent
    ErrorMonitorAgent
  ].freeze

  def self.all_agents
    ALL_AGENT_NAMES.map(&:constantize)
  end

  # Mapeo: evento → nombres de agentes que deben ejecutarse
  # Event names are auto-generated from model class: MyModule::MyModel → "my_module/my_model.created"
  AGENT_MAP = {
    # Documentos generados desde templates (Templates::GeneratedDocument)
    "templates/generated_document.created"        => %w[DocValidatorAgent SignatureGuardianAgent],
    "templates/generated_document.updated"        => %w[DocValidatorAgent SignatureGuardianAgent],
    "templates/generated_document.status_changed" => %w[SignatureGuardianAgent],

    # Firmas digitales (Identity::UserSignature)
    "identity/user_signature.created"             => %w[SignatureGuardianAgent],
    "identity/user_signature.updated"             => %w[SignatureGuardianAgent],

    # HR - Vacaciones (Hr::VacationRequest)
    "hr/vacation_request.created"                 => %w[RequestTrackerAgent DocValidatorAgent],
    "hr/vacation_request.updated"                 => %w[RequestTrackerAgent],
    "hr/vacation_request.status_changed"          => %w[RequestTrackerAgent],

    # HR - Certificaciones (Hr::EmploymentCertificationRequest)
    "hr/employment_certification_request.created"        => %w[RequestTrackerAgent DocValidatorAgent],
    "hr/employment_certification_request.updated"        => %w[RequestTrackerAgent],
    "hr/employment_certification_request.status_changed" => %w[RequestTrackerAgent],

    # Legal - Contratos (Legal::Contract)
    "legal/contract.created"                      => %w[DocValidatorAgent SignatureGuardianAgent],
    "legal/contract.updated"                      => %w[DocValidatorAgent],
    "legal/contract.status_changed"               => %w[RequestTrackerAgent SignatureGuardianAgent]
  }.freeze

  # -----------------------------------------------------------
  # Despachar agentes para un evento específico (event-driven)
  # -----------------------------------------------------------
  def self.dispatch(event_type, document, context = {})
    agent_names = AGENT_MAP[event_type]

    if agent_names.blank?
      Rails.logger.debug("[ORCHESTRATOR] No hay agentes para evento: #{event_type}")
      return
    end

    Rails.logger.info("[ORCHESTRATOR] Despachando #{agent_names.size} agentes " \
      "para evento '#{event_type}' en documento #{document.id}")

    agent_names.each do |agent_name|
      AgentEventJob.perform_async(
        agent_name,
        document.id.to_s,
        context.merge(event_type: event_type).stringify_keys
      )
    end
  end

  # -----------------------------------------------------------
  # Escaneo masivo para jobs periódicos (cron)
  # -----------------------------------------------------------
  def self.scan_all(agent_class, scope: nil)
    documents = scope || default_scan_scope(agent_class)

    Rails.logger.info("[ORCHESTRATOR] Iniciando scan con #{agent_class.name} " \
      "sobre #{documents.count} documentos")

    documents.find_each do |doc|
      AgentEventJob.perform_async(
        agent_class.name,
        doc.id.to_s,
        { event_type: "cron.scan", scan_type: "full" }
      )
    end
  end

  # -----------------------------------------------------------
  # Ejecutar agente de forma síncrona (útil para consola/debug)
  # -----------------------------------------------------------
  def self.run_now(event_type, document, context = {})
    agent_names = AGENT_MAP[event_type] || []
    results = {}

    agent_names.each do |agent_name|
      agent_class = agent_name.constantize
      agent = agent_class.new(document, context.merge(event_type: event_type))
      results[agent_name] = agent.execute
    end

    results
  end

  # -----------------------------------------------------------
  # Resumen del estado de los agentes
  # -----------------------------------------------------------
  def self.health_report(hours: 24)
    since = hours.hours.ago

    {
      period: "Últimas #{hours} horas",
      registered_agents: ALL_AGENT_NAMES,
      total_executions: AuditLog.where(:created_at.gte => since).count,
      passed: AuditLog.where(:created_at.gte => since, status: :passed).count,
      failed: AuditLog.where(:created_at.gte => since, status: :failed).count,
      errors: AuditLog.where(:created_at.gte => since, status: :error).count,
      active_alerts: AgentAlert.where(resolved: false).count,
      critical_alerts: AgentAlert.where(resolved: false, alert_type: :critical).count,
      by_agent: AuditLog.where(:created_at.gte => since)
                        .group_by(&:agent_id)
                        .transform_values(&:count)
    }
  end

  # -----------------------------------------------------------
  # Eventos registrados disponibles
  # -----------------------------------------------------------
  def self.available_events
    AGENT_MAP.keys.sort
  end

  def self.agents_for(event_type)
    AGENT_MAP[event_type] || []
  end

  def self.registered_agents
    ALL_AGENT_NAMES.map do |agent_name|
      agent_id = agent_name.underscore
      events = AGENT_MAP.select { |_, names| names.include?(agent_name) }.keys
      rules = AgentRule.active.where(agent_id: agent_id).count

      {
        name: agent_name,
        agent_id: agent_id,
        events: events,
        cron_only: events.empty?,
        rules_count: rules
      }
    end
  end

  private_class_method

  def self.default_scan_scope(agent_class)
    case agent_class.name
    when "StorageSentinelAgent"
      ::Templates::GeneratedDocument.where(:created_at.gte => 7.days.ago)
    when "CertificationAuditorAgent"
      ::Hr::EmploymentCertificationRequest.where(:status.nin => %w[cancelled])
                                          .where(:updated_at.gte => 7.days.ago)
    when "RequestTrackerAgent"
      ::Hr::VacationRequest.where(:status.nin => %w[enjoyed cancelled rejected])
                           .where(:updated_at.gte => 7.days.ago)
    else
      ::Templates::GeneratedDocument.where(:updated_at.gte => 24.hours.ago)
    end
  end
end
