# frozen_string_literal: true

# =============================================================
# Valkyria ECM — AgentScanJob
# Job periódico (cron) que ejecuta un agente sobre un conjunto
# de documentos. Usado para auditorías y escaneos masivos.
#
# Configurado en config/sidekiq_cron.yml
# =============================================================
class AgentScanJob
  include Sidekiq::Job

  sidekiq_options(
    queue: :agents,
    retry: 1
  )

  # @param agent_class_name [String] Nombre del agente a ejecutar
  # @param options [Hash] Opciones opcionales del scan
  def perform(agent_class_name, options = {})
    agent_class = agent_class_name.constantize
    options = options.symbolize_keys

    Rails.logger.info("[SCAN_JOB] Iniciando scan con #{agent_class_name}")
    start_time = Time.current

    scope = build_scope(agent_class, options)
    total = scope.count
    processed = 0
    failures = 0

    scope.each do |document|
      result = run_agent(agent_class, document)
      processed += 1
      failures += 1 if result && result[:status] == :failed
    end

    duration = (Time.current - start_time).round(2)
    log_scan_summary(agent_class_name, total, processed, failures, duration)
  rescue NameError => e
    Rails.logger.error("[SCAN_JOB] Clase no encontrada: #{agent_class_name} — #{e.message}")
  end

  private

  def run_agent(agent_class, document)
    context = {
      event_type: "cron.scan",
      scan_type: "scheduled",
      scanned_at: Time.current.iso8601
    }

    agent = agent_class.new(document, context)
    agent.execute
  rescue StandardError => e
    Rails.logger.error("[SCAN_JOB] Error en #{agent_class.name} para #{document.id}: #{e.message}")
    nil
  end

  def build_scope(agent_class, options)
    base_scope = case agent_class.name
                 when "StorageSentinelAgent"
                   ::Templates::GeneratedDocument.where(:created_at.gte => (options[:days_back] || 7).days.ago)
                 when "CertificationAuditorAgent"
                   ::Hr::EmploymentCertificationRequest
                     .where(:status.nin => %w[cancelled])
                     .where(:updated_at.gte => (options[:days_back] || 7).days.ago)
                 when "RequestTrackerAgent"
                   if options[:scope] == "certifications"
                     ::Hr::EmploymentCertificationRequest
                       .where(:status.nin => %w[completed cancelled rejected])
                       .where(:updated_at.gte => (options[:days_back] || 7).days.ago)
                   else
                     ::Hr::VacationRequest
                       .where(:status.nin => %w[enjoyed cancelled rejected])
                       .where(:updated_at.gte => (options[:days_back] || 7).days.ago)
                   end
                 when "DocValidatorAgent"
                   ::Templates::GeneratedDocument.where(:updated_at.gte => (options[:days_back] || 1).days.ago)
                 when "SignatureGuardianAgent"
                   ::Templates::GeneratedDocument
                     .where(:signatures.ne => nil)
                     .where(:updated_at.gte => (options[:days_back] || 7).days.ago)
                 else
                   ::Templates::GeneratedDocument.where(:updated_at.gte => 24.hours.ago)
                 end

    base_scope = base_scope.limit(options[:limit]) if options[:limit]
    base_scope
  end

  def log_scan_summary(agent_name, total, processed, failures, duration)
    summary = "[SCAN_JOB] #{agent_name} completado: " \
              "#{processed}/#{total} procesados, " \
              "#{failures} con problemas, " \
              "#{duration}s de duración"

    if failures > 0
      Rails.logger.warn(summary)
    else
      Rails.logger.info(summary)
    end
  end
end
