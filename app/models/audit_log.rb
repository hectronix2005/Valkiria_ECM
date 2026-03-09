# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AuditLog
# Registro de cada ejecución de un agente guardian.
# Almacena validaciones ejecutadas, fallos y acciones tomadas.
# =============================================================
class AuditLog
  include Mongoid::Document
  include Mongoid::Timestamps::Created

  # -----------------------------------------------------------
  # Campos
  # -----------------------------------------------------------
  field :agent_id,      type: String    # Ej: "doc_validator_agent"
  field :event_type,    type: String    # Ej: "document.created"
  field :document_id,   type: BSON::ObjectId
  field :status,        type: String    # passed | failed | error
  field :checks_run,    type: Array,  default: []
  field :failures,      type: Array,  default: []
  field :actions_taken,  type: Array,  default: []
  field :metadata,      type: Hash,   default: {}

  # -----------------------------------------------------------
  # Índices
  # -----------------------------------------------------------
  index({ agent_id: 1, created_at: -1 })
  index({ document_id: 1, created_at: -1 })
  index({ status: 1, created_at: -1 })
  index({ event_type: 1 })

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  validates :agent_id, presence: true
  validates :status, presence: true, inclusion: { in: %w[passed failed error] }

  # -----------------------------------------------------------
  # Scopes
  # -----------------------------------------------------------
  scope :recent,       -> { order(created_at: :desc) }
  scope :passed,       -> { where(status: "passed") }
  scope :failed,       -> { where(status: "failed") }
  scope :errors,       -> { where(status: "error") }
  scope :for_agent,    ->(id) { where(agent_id: id) }
  scope :for_document, ->(id) { where(document_id: id) }
  scope :since,        ->(time) { where(:created_at.gte => time) }

  # -----------------------------------------------------------
  # Métodos de clase para reportes
  # -----------------------------------------------------------
  def self.summary(hours: 24)
    since_time = hours.hours.ago
    logs = since(since_time)

    {
      total: logs.count,
      passed: logs.passed.count,
      failed: logs.failed.count,
      errors: logs.errors.count,
      by_agent: logs.group_by(&:agent_id).transform_values(&:count),
      failure_rate: calculate_failure_rate(logs)
    }
  end

  def self.calculate_failure_rate(logs)
    total = logs.count
    return 0.0 if total.zero?

    ((logs.failed.count.to_f / total) * 100).round(2)
  end
end
