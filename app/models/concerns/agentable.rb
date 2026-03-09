# frozen_string_literal: true

# =============================================================
# Valkyria ECM — Agentable Concern
# Incluir en cualquier modelo que deba ser monitoreado
# por el sistema de agentes guardian.
#
# Uso:
#   class Document
#     include Mongoid::Document
#     include Agentable
#   end
#
# Esto hará que cada create/update despache automáticamente
# los agentes correspondientes en segundo plano.
# =============================================================
module Agentable
  extend ActiveSupport::Concern

  included do
    # Callbacks de Mongoid
    after_create  :dispatch_created_event
    after_update  :dispatch_updated_event

    # Campo para rastrear cambios de estado
    field :agent_last_checked_at, type: DateTime
  end

  class_methods do
    # Ejecutar un agente manualmente sobre un registro
    # Document.run_agent(DocValidatorAgent, doc_id)
    def run_agent(agent_class, record_id, context = {})
      record = find(record_id)
      agent = agent_class.new(record, context)
      agent.execute
    end
  end

  private

  def dispatch_created_event
    event = "#{model_event_name}.created"
    AgentOrchestrator.dispatch(event, self, build_context)
  end

  def dispatch_updated_event
    event = "#{model_event_name}.updated"

    # Si cambió el status, despachar evento específico
    if respond_to?(:status_changed?) && status_changed?
      status_event = "#{model_event_name}.status_changed"
      AgentOrchestrator.dispatch(status_event, self, build_context.merge(
        previous_status: status_was
      ))
    end

    AgentOrchestrator.dispatch(event, self, build_context)
  end

  def build_context
    {
      changed_fields: changed_attributes.keys,
      user_id: Current.try(:user)&.id&.to_s,
      timestamp: Time.current.iso8601,
      model_class: self.class.name
    }
  end

  def model_event_name
    self.class.name.underscore # "document", "request", etc.
  end

  # Para Mongoid: verificar si el campo status cambió
  def status_changed?
    return false unless respond_to?(:status)
    changes.key?("status") || previous_changes.key?("status")
  end

  def status_was
    changes.dig("status", 0) || previous_changes.dig("status", 0)
  end
end
