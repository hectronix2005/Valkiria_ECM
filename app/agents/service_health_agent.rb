# frozen_string_literal: true

require "net/http"

# =============================================================
# Valkyria ECM — ServiceHealthAgent
# Monitorea la disponibilidad de servicios de infraestructura:
# MongoDB, Redis, Sidekiq, Gotenberg, Vite (dev), Rails API.
#
# No opera sobre documentos — usa NullDocument sentinel.
# Alertas deduplicadas por servicio; auto-resolve al recuperarse.
#
# Triggers: cron.health_check, manual.test
# =============================================================
class ServiceHealthAgent < BaseAgent
  # Sentinel para satisfacer BaseAgent sin un documento real
  NullDocument = Struct.new(:id, :document_type) do
    def try(*)
      nil
    end
  end

  CRITICAL_SERVICES = %w[mongodb redis sidekiq rails_api].freeze
  WARNING_SERVICES  = %w[gotenberg vite_frontend].freeze
  ALL_SERVICES      = (CRITICAL_SERVICES + WARNING_SERVICES).freeze

  HTTP_OPEN_TIMEOUT  = 5
  HTTP_READ_TIMEOUT  = 5

  def initialize(context = {})
    super(NullDocument.new("system", nil), context)
  end

  # -----------------------------------------------------------
  # Override execute — log sin document.id
  # -----------------------------------------------------------
  def execute
    Rails.logger.info("[AGENT] #{agent_id} ejecutando health check")
    start_time = Time.current

    run_checks
    take_actions
    results[:status] = results[:failures].empty? ? :passed : :failed
    results[:duration_ms] = ((Time.current - start_time) * 1000).round

    log_audit
    results
  rescue StandardError => e
    handle_agent_error(e)
    results
  end

  private

  # -----------------------------------------------------------
  # Health checks
  # -----------------------------------------------------------
  def run_checks
    check_mongodb
    check_redis
    check_sidekiq
    check_rails_api
    check_gotenberg
    check_vite_frontend
  end

  # -----------------------------------------------------------
  # Acciones: alerta deduplicada por servicio caído,
  # auto-resolve por servicio recuperado
  # -----------------------------------------------------------
  def take_actions
    failed_services = results[:failures].map { |f| f[:name] }

    ALL_SERVICES.each do |service|
      if failed_services.include?(service)
        severity = CRITICAL_SERVICES.include?(service) ? :critical : :warning
        deduplicated_alert!(service, severity)
      else
        auto_resolve_alert!(service)
      end
    end
  end

  # -----------------------------------------------------------
  # Checks individuales
  # -----------------------------------------------------------

  def check_mongodb
    rule = load_rule("mongodb")
    timeout = rule&.rule_config&.fetch("timeout", 5) || 5

    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    Mongoid.default_client.database.command(ping: 1)
    latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round

    add_check("mongodb", true, { latency_ms: latency, timeout: timeout })
  rescue StandardError => e
    add_check("mongodb", false, { error: e.message, error_class: e.class.name })
  end

  def check_redis
    rule = load_rule("redis")
    timeout = rule&.rule_config&.fetch("timeout", 5) || 5

    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    pong = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"), timeout: timeout).ping
    latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round

    add_check("redis", pong == "PONG", { response: pong, latency_ms: latency })
  rescue StandardError => e
    add_check("redis", false, { error: e.message, error_class: e.class.name })
  end

  def check_sidekiq
    rule = load_rule("sidekiq")
    config = rule&.rule_config || {}
    max_latency = config.fetch("max_latency_seconds", 300)
    max_queue_size = config.fetch("max_queue_size", 1000)

    stats = Sidekiq::Stats.new
    process_count = Sidekiq::ProcessSet.new.size
    default_latency = Sidekiq::Queue.new("default").latency

    healthy = process_count > 0 &&
              default_latency < max_latency &&
              stats.enqueued < max_queue_size

    add_check("sidekiq", healthy, {
      processes: process_count,
      enqueued: stats.enqueued,
      default_latency: default_latency.round(2),
      max_latency_seconds: max_latency,
      max_queue_size: max_queue_size,
      failed: stats.failed
    })
  rescue StandardError => e
    add_check("sidekiq", false, { error: e.message, error_class: e.class.name })
  end

  def check_rails_api
    rule = load_rule("rails_api")
    config = rule&.rule_config || {}
    url = config.fetch("url", "http://localhost:3100/api/v1/health")
    timeout = config.fetch("timeout", 5)

    reachable, details = http_reachable?(url, timeout)
    add_check("rails_api", reachable, details)
  end

  def check_gotenberg
    rule = load_rule("gotenberg")
    config = rule&.rule_config || {}
    url = config.fetch("url", "http://localhost:3000/health")
    timeout = config.fetch("timeout", 5)

    reachable, details = http_reachable?(url, timeout)
    add_check("gotenberg", reachable, details)
  end

  def check_vite_frontend
    rule = load_rule("vite_frontend")
    config = rule&.rule_config || {}

    # Solo chequear si está habilitado y en los environments configurados
    enabled = config.fetch("enabled", true)
    environments = config.fetch("environments", %w[development])

    unless enabled && environments.include?(Rails.env)
      add_check("vite_frontend", true, { skipped: true, reason: "Not enabled for #{Rails.env}" })
      return
    end

    url = config.fetch("url", "http://localhost:5173")
    timeout = config.fetch("timeout", 5)

    reachable, details = http_reachable?(url, timeout)
    add_check("vite_frontend", reachable, details)
  end

  # -----------------------------------------------------------
  # Deduplicación de alertas
  # -----------------------------------------------------------
  def deduplicated_alert!(service, severity)
    existing = AgentAlert.where(
      agent_id: agent_id,
      "metadata.service" => service,
      resolved: false
    ).first

    if existing
      count = (existing.metadata["occurrence_count"] || 1) + 1
      existing.update!(
        metadata: existing.metadata.merge(
          "occurrence_count" => count,
          "last_seen_at" => Time.current.iso8601
        )
      )
      add_action("deduplicated_alert", { service: service, occurrence_count: count })
    else
      failure = results[:failures].find { |f| f[:name] == service }
      AgentAlert.create!(
        agent_id: agent_id,
        alert_type: severity.to_s,
        message: "Servicio #{service} no disponible",
        metadata: {
          "service" => service,
          "occurrence_count" => 1,
          "first_seen_at" => Time.current.iso8601,
          "last_seen_at" => Time.current.iso8601,
          "details" => failure&.dig(:details) || {}
        }
      )
      add_action("created_alert", { service: service, severity: severity })
    end
  end

  def auto_resolve_alert!(service)
    existing = AgentAlert.where(
      agent_id: agent_id,
      "metadata.service" => service,
      resolved: false
    ).first

    return unless existing

    existing.update!(
      resolved: true,
      resolved_at: Time.current,
      metadata: existing.metadata.merge(
        "auto_resolved" => true,
        "resolved_reason" => "Service recovered",
        "resolved_at" => Time.current.iso8601
      )
    )
    add_action("auto_resolved_alert", { service: service, alert_id: existing.id.to_s })
  end

  # -----------------------------------------------------------
  # Overrides — sin document_id
  # -----------------------------------------------------------
  def alert!(alert_type, message, extra = {})
    AgentAlert.create!(
      agent_id: agent_id,
      alert_type: alert_type.to_s,
      message: message,
      metadata: extra
    )
  end

  def log_audit
    AuditLog.create!(
      agent_id: agent_id,
      event_type: context[:event_type],
      document_id: nil,
      status: results[:status].to_s,
      checks_run: results[:checks],
      failures: results[:failures],
      actions_taken: results[:actions],
      metadata: context.except(:event_type).merge(
        duration_ms: results[:duration_ms]
      )
    )
  end

  def load_rule(rule_name)
    AgentRule.active
             .where(agent_id: agent_id)
             .where(document_type: "system")
             .find_by(rule_name: rule_name)
  end

  # -----------------------------------------------------------
  # HTTP helper
  # -----------------------------------------------------------
  def http_reachable?(url, timeout = 5)
    uri = URI.parse(url)
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = timeout
    http.read_timeout = timeout

    response = http.request(Net::HTTP::Get.new(uri.request_uri))
    latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round

    success = response.code.to_i < 500
    [success, { url: url, status_code: response.code.to_i, latency_ms: latency }]
  rescue StandardError => e
    [false, { url: url, error: e.message, error_class: e.class.name }]
  end
end
