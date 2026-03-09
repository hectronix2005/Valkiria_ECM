# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AgentRule
# Reglas configurables para cada agente por tipo de documento.
# Permite personalizar validaciones sin modificar código.
# =============================================================
class AgentRule
  include Mongoid::Document
  include Mongoid::Timestamps

  # -----------------------------------------------------------
  # Campos
  # -----------------------------------------------------------
  field :agent_id,       type: String   # Ej: "doc_validator_agent"
  field :document_type,  type: String   # Ej: "invoice", "contract"
  field :rule_name,      type: String   # Ej: "required_fields"
  field :rule_config,    type: Hash,    default: {}
  field :severity,       type: String,  default: "warning"
  field :is_active,      type: Boolean, default: true
  field :description,    type: String

  # -----------------------------------------------------------
  # Índices
  # -----------------------------------------------------------
  index({ agent_id: 1, document_type: 1, rule_name: 1 }, { unique: true })
  index({ is_active: 1 })

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  validates :agent_id, presence: true
  validates :rule_name, presence: true
  validates :severity, inclusion: { in: %w[critical warning info] }

  # -----------------------------------------------------------
  # Scopes
  # -----------------------------------------------------------
  scope :active,     -> { where(is_active: true) }
  scope :for_agent,  ->(id) { where(agent_id: id) }
  scope :for_type,   ->(type) { where(document_type: type) }
  scope :critical,   -> { where(severity: "critical") }

  # -----------------------------------------------------------
  # Seeds: reglas iniciales recomendadas
  # -----------------------------------------------------------
  def self.seed_defaults!
    rules = [
      # DocValidator
      {
        agent_id: "doc_validator_agent",
        document_type: "invoice",
        rule_name: "required_fields",
        rule_config: {
          "fields" => %w[title amount vendor_name invoice_number due_date]
        },
        severity: "critical",
        description: "Campos obligatorios para facturas"
      },
      {
        agent_id: "doc_validator_agent",
        document_type: "receipt",
        rule_name: "required_fields",
        rule_config: {
          "fields" => %w[title amount vendor_name date category]
        },
        severity: "warning",
        description: "Campos obligatorios para recibos"
      },
      {
        agent_id: "doc_validator_agent",
        document_type: "contract",
        rule_name: "required_fields",
        rule_config: {
          "fields" => %w[title parties start_date end_date]
        },
        severity: "critical",
        description: "Campos obligatorios para contratos"
      },

      # SignatureGuardian
      {
        agent_id: "signature_guardian_agent",
        document_type: "contract",
        rule_name: "required_signers",
        rule_config: {
          "roles" => %w[requester reviewer legal_approver director]
        },
        severity: "critical",
        description: "Firmantes requeridos para contratos"
      },
      {
        agent_id: "signature_guardian_agent",
        document_type: "contract",
        rule_name: "signature_order",
        rule_config: {
          "order" => %w[requester reviewer legal_approver director]
        },
        severity: "warning",
        description: "Orden jerárquico de firmas para contratos"
      },

      # RequestTracker
      {
        agent_id: "request_tracker_agent",
        document_type: "request",
        rule_name: "sla_hours",
        rule_config: {
          "submitted" => 24,
          "assigned" => 8,
          "in_review" => 48,
          "in_progress" => 72
        },
        severity: "warning",
        description: "SLA en horas por estado de solicitud"
      },

      # StorageSentinel
      {
        agent_id: "storage_sentinel_agent",
        document_type: nil,
        rule_name: "folder_structure",
        rule_config: {
          "invoice"       => "documents/invoices/{year}/{month}/",
          "receipt"        => "documents/receipts/{year}/{month}/",
          "contract"      => "documents/contracts/{year}/",
          "certification" => "documents/certifications/{year}/"
        },
        severity: "warning",
        description: "Estructura de carpetas esperada por tipo"
      },

      # CertificationAuditor
      {
        agent_id: "certification_auditor_agent",
        document_type: "certification",
        rule_name: "required_approvals",
        rule_config: {
          "roles" => %w[reviewer approver director]
        },
        severity: "critical",
        description: "Aprobaciones requeridas para certificaciones"
      },

      # ServiceHealth
      # ErrorMonitor
      {
        agent_id: "error_monitor_agent",
        document_type: "system",
        rule_name: "thresholds",
        rule_config: {
          "window_minutes" => 30,
          "recurring_500s_critical" => 5,
          "recurring_500s_warning" => 2,
          "endpoint_critical" => 5,
          "endpoint_warning" => 2,
          "spike_multiplier" => 3.0,
          "spike_min_baseline" => 2,
          "new_class_lookback_days" => 7,
          "fourxx_window_minutes" => 30,
          "fourxx_critical" => 50,
          "fourxx_warning" => 20
        },
        severity: "warning",
        description: "Umbrales configurables para el agente de monitoreo de errores"
      },

      # ServiceHealth
      {
        agent_id: "service_health_agent",
        document_type: "system",
        rule_name: "mongodb",
        rule_config: { "timeout" => 5 },
        severity: "critical",
        description: "Health check para MongoDB"
      },
      {
        agent_id: "service_health_agent",
        document_type: "system",
        rule_name: "redis",
        rule_config: { "timeout" => 5 },
        severity: "critical",
        description: "Health check para Redis"
      },
      {
        agent_id: "service_health_agent",
        document_type: "system",
        rule_name: "sidekiq",
        rule_config: {
          "max_latency_seconds" => 300,
          "max_queue_size" => 1000
        },
        severity: "critical",
        description: "Health check para Sidekiq (procesos, latencia, cola)"
      },
      {
        agent_id: "service_health_agent",
        document_type: "system",
        rule_name: "gotenberg",
        rule_config: {
          "timeout" => 5
        },
        severity: "warning",
        description: "Health check para Gotenberg (PDF generator)"
      },
      {
        agent_id: "service_health_agent",
        document_type: "system",
        rule_name: "vite_frontend",
        rule_config: {
          "enabled" => true,
          "timeout" => 5,
          "environments" => %w[development]
        },
        severity: "warning",
        description: "Health check para Vite dev server (solo en development)"
      },
      {
        agent_id: "service_health_agent",
        document_type: "system",
        rule_name: "rails_api",
        rule_config: {
          "timeout" => 5
        },
        severity: "critical",
        description: "Health check para Rails API"
      }
    ]

    rules.each do |rule_data|
      existing = where(
        agent_id: rule_data[:agent_id],
        document_type: rule_data[:document_type],
        rule_name: rule_data[:rule_name]
      ).first
      if existing
        existing.update(rule_data)
      else
        create!(rule_data)
      end
    end

    Rails.logger.info("[SEED] #{rules.size} reglas de agentes configuradas")
  end
end
