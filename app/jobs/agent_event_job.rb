# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AgentEventJob
# Job de Sidekiq para ejecutar un agente en segundo plano.
# Se encola cada vez que un evento dispara un agente.
# =============================================================
class AgentEventJob
  include Sidekiq::Job

  sidekiq_options(
    queue: :agents,
    retry: 3,
    dead: true,
    backtrace: true
  )

  # @param agent_class_name [String] Nombre de la clase del agente
  # @param document_id [String] ID del documento a evaluar
  # @param context [Hash] Contexto del evento (must include "model_class")
  def perform(agent_class_name, document_id, context = {})
    context = context.symbolize_keys
    document = find_document(context[:model_class], document_id)
    return unless document

    agent_class = agent_class_name.constantize
    agent = agent_class.new(document, context)
    result = agent.execute

    log_result(agent_class_name, document_id, result)
  rescue NameError => e
    Rails.logger.error("[AGENT_JOB] Clase no encontrada: #{agent_class_name} — #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[AGENT_JOB] Error ejecutando #{agent_class_name}: #{e.message}")
    Rails.logger.error(e.backtrace&.first(5)&.join("\n"))
    raise # Re-raise para que Sidekiq haga retry
  end

  private

  def find_document(model_class_name, document_id)
    klass = model_class_name&.constantize
    klass&.find(document_id)
  rescue NameError
    Rails.logger.warn("[AGENT_JOB] Clase de modelo no encontrada: #{model_class_name}")
    nil
  rescue Mongoid::Errors::DocumentNotFound
    Rails.logger.warn("[AGENT_JOB] Documento no encontrado: #{model_class_name}##{document_id}")
    nil
  end

  def log_result(agent_name, doc_id, result)
    status = result[:status]
    failures = result[:failures]&.size || 0

    if failures > 0
      Rails.logger.warn(
        "[AGENT_JOB] #{agent_name} encontró #{failures} problemas " \
        "en documento #{doc_id} — status: #{status}"
      )
    else
      Rails.logger.info(
        "[AGENT_JOB] #{agent_name} completado OK para documento #{doc_id}"
      )
    end
  end
end
