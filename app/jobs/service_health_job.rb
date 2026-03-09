# frozen_string_literal: true

# =============================================================
# Valkyria ECM — ServiceHealthJob
# Job dedicado para ServiceHealthAgent.
# No itera documentos — simplemente ejecuta el agente una vez.
#
# Configurado en config/sidekiq_cron.yml (cada 2 minutos)
# =============================================================
class ServiceHealthJob
  include Sidekiq::Job

  sidekiq_options(
    queue: :agents,
    retry: 1
  )

  def perform
    Rails.logger.info("[HEALTH_JOB] Iniciando health check")
    start_time = Time.current

    agent = ServiceHealthAgent.new(event_type: "cron.health_check")
    result = agent.execute

    duration = (Time.current - start_time).round(2)
    checks = result[:checks]&.size || 0
    failures = result[:failures]&.size || 0

    level = failures > 0 ? :warn : :info
    Rails.logger.public_send(level,
      "[HEALTH_JOB] Completado: #{checks} checks, #{failures} fallos, #{duration}s")
  rescue StandardError => e
    Rails.logger.error("[HEALTH_JOB] Error: #{e.message}")
    Rails.logger.error(e.backtrace&.first(5)&.join("\n"))
  end
end
