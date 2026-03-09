# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AgentNotifier
# Centraliza el envío de notificaciones generadas por agentes.
# Soporta: in-app, email y logging.
# =============================================================
class AgentNotifier
  SEVERITY_CONFIG = {
    critical: { email: true,  in_app: true,  color: "#EF4444" },
    warning:  { email: false, in_app: true,  color: "#F59E0B" },
    info:     { email: false, in_app: false, color: "#3B82F6" }
  }.freeze

  def self.notify(alert)
    config = SEVERITY_CONFIG[alert.alert_type.to_sym] || SEVERITY_CONFIG[:info]

    send_in_app(alert) if config[:in_app]
    send_email(alert) if config[:email]
    log_notification(alert)
  end

  private_class_method

  def self.send_in_app(alert)
    # Log in-app notification — extend with real notification system as needed
    Rails.logger.info("[NOTIFIER] In-app: [#{alert.agent_id}] #{alert.alert_type.upcase} — #{alert.message}")
  rescue StandardError => e
    Rails.logger.error("[NOTIFIER] Error enviando in-app: #{e.message}")
  end

  def self.send_email(alert)
    # Email placeholder — implement AgentMailer when needed
    Rails.logger.info("[NOTIFIER] Email: [#{alert.agent_id}] #{alert.message}")
  rescue StandardError => e
    Rails.logger.error("[NOTIFIER] Error enviando email: #{e.message}")
  end

  def self.log_notification(alert)
    Rails.logger.info(
      "[NOTIFIER] #{alert.alert_type.upcase} | #{alert.agent_id} | #{alert.message}"
    )
  end
end
