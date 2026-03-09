# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AgentAlert
# Alertas generadas por los agentes guardian.
# Se pueden resolver manualmente o automáticamente.
# =============================================================
class AgentAlert
  include Mongoid::Document
  include Mongoid::Timestamps::Created

  # -----------------------------------------------------------
  # Campos
  # -----------------------------------------------------------
  field :agent_id,      type: String
  field :alert_type,    type: String    # critical | warning | info
  field :message,       type: String
  field :document_id,   type: BSON::ObjectId
  field :resolved,      type: Boolean,  default: false
  field :resolved_by,   type: BSON::ObjectId
  field :resolved_at,   type: DateTime
  field :metadata,      type: Hash,     default: {}

  # -----------------------------------------------------------
  # Índices
  # -----------------------------------------------------------
  index({ resolved: 1, alert_type: 1, created_at: -1 })
  index({ agent_id: 1, created_at: -1 })
  index({ document_id: 1 })
  index({ agent_id: 1, "metadata.service" => 1, resolved: 1 })
  index({ agent_id: 1, "metadata.pattern_key" => 1, resolved: 1 })

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  validates :agent_id, presence: true
  validates :alert_type, presence: true, inclusion: { in: %w[critical warning info] }
  validates :message, presence: true

  # -----------------------------------------------------------
  # Scopes
  # -----------------------------------------------------------
  scope :unresolved,  -> { where(resolved: false) }
  scope :resolved,    -> { where(resolved: true) }
  scope :critical,    -> { where(alert_type: "critical") }
  scope :warnings,    -> { where(alert_type: "warning") }
  scope :for_agent,   ->(id) { where(agent_id: id) }
  scope :recent,      -> { order(created_at: :desc) }

  # -----------------------------------------------------------
  # Callbacks
  # -----------------------------------------------------------
  after_create :send_notification

  # -----------------------------------------------------------
  # Métodos de instancia
  # -----------------------------------------------------------
  def resolve!(user_id = nil)
    update!(
      resolved: true,
      resolved_by: user_id,
      resolved_at: Time.current
    )
  end

  def critical?
    alert_type == "critical"
  end

  # -----------------------------------------------------------
  # Métodos de clase
  # -----------------------------------------------------------
  def self.dashboard_summary
    {
      total_unresolved: unresolved.count,
      critical: unresolved.critical.count,
      warnings: unresolved.warnings.count,
      by_agent: unresolved.group_by(&:agent_id)
                          .transform_values(&:count),
      oldest_unresolved: unresolved.order(created_at: :asc).first&.created_at
    }
  end

  private

  def send_notification
    AgentNotifier.notify(self)
  rescue StandardError => e
    Rails.logger.error("[ALERT] Error enviando notificación: #{e.message}")
  end
end
