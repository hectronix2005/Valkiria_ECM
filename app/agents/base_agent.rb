# frozen_string_literal: true

# =============================================================
# Valkyria ECM — BaseAgent
# Clase base abstracta para todos los agentes guardian.
# Cada agente hereda de aquí e implementa #run_checks y #take_actions.
#
# Uso:
#   agent = DocValidatorAgent.new(document, event_type: "document.created")
#   result = agent.execute
#   # => { checks: [...], failures: [...], actions: [...], status: :passed }
# =============================================================
class BaseAgent
  attr_reader :document, :context, :results

  def initialize(document, context = {})
    @document = document
    @context = context
    @results = {
      checks: [],
      failures: [],
      actions: [],
      status: nil
    }
  end

  # Punto de entrada principal — NO sobreescribir
  def execute
    Rails.logger.info("[AGENT] #{agent_id} ejecutando para documento #{document.id}")
    run_checks
    take_actions if results[:failures].any?
    results[:status] = results[:failures].empty? ? :passed : :failed
    log_audit
    results
  rescue StandardError => e
    handle_agent_error(e)
    results
  end

  private

  # -----------------------------------------------------------
  # Métodos abstractos — cada agente DEBE implementar estos
  # -----------------------------------------------------------
  def run_checks
    raise NotImplementedError, "#{self.class.name} debe implementar #run_checks"
  end

  def take_actions
    raise NotImplementedError, "#{self.class.name} debe implementar #take_actions"
  end

  # -----------------------------------------------------------
  # Helpers para registrar resultados
  # -----------------------------------------------------------
  def add_check(name, passed, details = {})
    entry = {
      name: name,
      passed: passed,
      details: details,
      checked_at: Time.current.iso8601
    }
    results[:checks] << entry
    results[:failures] << entry unless passed
  end

  def add_action(name, result_data = {})
    results[:actions] << {
      name: name,
      result: result_data,
      executed_at: Time.current.iso8601
    }
  end

  # -----------------------------------------------------------
  # Alertas
  # -----------------------------------------------------------
  def alert!(alert_type, message, extra = {})
    AgentAlert.create!(
      agent_id: agent_id,
      alert_type: alert_type,
      message: message,
      document_id: document.id,
      metadata: extra
    )
  end

  # -----------------------------------------------------------
  # Registro de auditoría
  # -----------------------------------------------------------
  def log_audit
    AuditLog.create!(
      agent_id: agent_id,
      event_type: context[:event_type],
      document_id: document.id,
      status: results[:status],
      checks_run: results[:checks],
      failures: results[:failures],
      actions_taken: results[:actions],
      metadata: context.except(:event_type)
    )
  end

  # -----------------------------------------------------------
  # Reglas configurables desde la BD
  # -----------------------------------------------------------
  def load_rule(rule_name)
    AgentRule.active
             .where(agent_id: agent_id)
             .where(document_type: document.try(:document_type))
             .where(rule_name: rule_name)
             .first
  end

  def rule_severity(check_name)
    rule = AgentRule.active
                    .where(agent_id: agent_id)
                    .where(rule_name: check_name)
                    .first
    rule&.severity&.to_sym || :warning
  end

  # -----------------------------------------------------------
  # Identificador del agente
  # -----------------------------------------------------------
  def agent_id
    self.class.name.underscore
  end

  # -----------------------------------------------------------
  # Manejo de errores
  # -----------------------------------------------------------
  def handle_agent_error(error)
    Rails.logger.error("[AGENT] Error en #{agent_id}: #{error.message}")
    Rails.logger.error(error.backtrace&.first(10)&.join("\n"))

    results[:status] = :error
    results[:failures] << {
      name: "agent_execution_error",
      passed: false,
      details: { error: error.message, class: error.class.name }
    }

    alert!(:critical, "Error de ejecución: #{error.message}", {
      backtrace: error.backtrace&.first(5)
    })
  end
end
