# frozen_string_literal: true

# =============================================================
# Valkyria ECM — ErrorMonitorJob
# Job dedicado para ErrorMonitorAgent.
# No itera documentos — simplemente ejecuta el agente una vez.
#
# Configurado en config/sidekiq_cron.yml (cada 5 minutos)
# =============================================================
class ErrorMonitorJob
  include Sidekiq::Job

  sidekiq_options(
    queue: :agents,
    retry: 1
  )

  def perform
    Rails.logger.info("[ERROR_MONITOR_JOB] Iniciando error monitor scan")
    start_time = Time.current

    agent = ErrorMonitorAgent.new(event_type: "cron.error_monitor")
    result = agent.execute

    duration = (Time.current - start_time).round(2)
    checks = result[:checks]&.size || 0
    failures = result[:failures]&.size || 0

    level = failures > 0 ? :warn : :info
    Rails.logger.public_send(level,
      "[ERROR_MONITOR_JOB] Completado: #{checks} checks, #{failures} fallos, #{duration}s")
  rescue StandardError => e
    Rails.logger.error("[ERROR_MONITOR_JOB] Error: #{e.message}")
    Rails.logger.error(e.backtrace&.first(5)&.join("\n"))
  end
end
