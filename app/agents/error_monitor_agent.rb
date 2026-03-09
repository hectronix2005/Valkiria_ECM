# frozen_string_literal: true

require "net/http"

# =============================================================
# Valkyria ECM — ErrorMonitorAgent
# Monitorea la colección System::ErrorLog para detectar patrones
# de errores: 500s recurrentes, endpoints rotos, picos de errores,
# clases de error nuevas, tasas elevadas de 4xx, y conectividad
# de servicios (Rails API / Vite frontend).
#
# No opera sobre documentos — usa NullDocument sentinel.
# Alertas deduplicadas por pattern_key; auto-resolve al desaparecer.
#
# Triggers: cron.error_monitor, manual.test
# =============================================================
class ErrorMonitorAgent < BaseAgent
  # Sentinel para satisfacer BaseAgent sin un documento real
  NullDocument = Struct.new(:id, :document_type) do
    def try(*)
      nil
    end
  end

  CHECK_NAMES = %w[
    server_connectivity
    recurring_500s
    endpoint_failures
    error_spikes
    new_error_classes
    elevated_4xx_rate
    auth_health
  ].freeze

  # Servicios a verificar con HTTP ping
  def self.services
    if Rails.env.production?
      app_host = ENV.fetch("APP_HOST", "localhost:3100")
      {
        "rails_api" => { url: "https://#{app_host}/api/v1/health", severity: :critical }
      }
    else
      {
        "rails_api"     => { url: "http://localhost:3100/api/v1/health", severity: :critical },
        "vite_frontend" => { url: "http://localhost:5173",               severity: :warning }
      }
    end
  end

  CONNECTION_ERROR_PATTERNS = /ECONNREFUSED|Connection refused|Connection reset|connection timed out|No route to host/i

  HTTP_TIMEOUT = 5

  # Defaults — overrideable via AgentRule thresholds
  DEFAULTS = {
    "window_minutes"              => 30,
    "recurring_500s_critical"     => 5,
    "recurring_500s_warning"      => 2,
    "endpoint_critical"           => 5,
    "endpoint_warning"            => 2,
    "spike_multiplier"            => 3.0,
    "spike_min_baseline"          => 2,
    "new_class_lookback_days"     => 7,
    "fourxx_window_minutes"       => 30,
    "fourxx_critical"             => 50,
    "fourxx_warning"              => 20,
    "connectivity_timeout"        => 5
  }.freeze

  def initialize(context = {})
    super(NullDocument.new("system", nil), context)
  end

  # -----------------------------------------------------------
  # Override execute — log sin document.id
  # -----------------------------------------------------------
  def execute
    Rails.logger.info("[AGENT] #{agent_id} ejecutando error monitor")
    start_time = Time.current

    @thresholds = load_thresholds
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
  # Checks
  # -----------------------------------------------------------
  def run_checks
    check_server_connectivity
    check_recurring_500s
    check_endpoint_failures
    check_error_spikes
    check_new_error_classes
    check_elevated_4xx_rate
    check_auth_health
  end

  # -----------------------------------------------------------
  # Acciones: alerta deduplicada por pattern_key,
  # auto-resolve cuando el patrón desaparece
  # -----------------------------------------------------------
  def take_actions
    active_patterns = results[:failures].map { |f| f[:details][:pattern_key] }.compact

    # Auto-resolve alertas cuyo patrón ya no aparece
    AgentAlert.where(agent_id: agent_id, resolved: false).each do |alert|
      pattern_key = alert.metadata["pattern_key"]
      next if pattern_key.blank?
      next if active_patterns.include?(pattern_key)

      alert.update!(
        resolved: true,
        resolved_at: Time.current,
        metadata: alert.metadata.merge(
          "auto_resolved" => true,
          "resolved_reason" => "Pattern no longer active",
          "resolved_at" => Time.current.iso8601
        )
      )
      add_action("auto_resolved_alert", { pattern_key: pattern_key, alert_id: alert.id.to_s })
    end

    # Crear/deduplicar alertas para patrones activos
    results[:failures].each do |failure|
      pattern_key = failure[:details][:pattern_key]
      severity = failure[:details][:severity] || :warning
      deduplicated_alert!(pattern_key, severity, failure)
    end
  end

  # -----------------------------------------------------------
  # Check 1: Errores 500 recurrentes agrupados por error_class
  # -----------------------------------------------------------
  def check_recurring_500s
    window = threshold("window_minutes").minutes.ago
    critical_threshold = threshold("recurring_500s_critical")
    warning_threshold  = threshold("recurring_500s_warning")

    errors_by_class = System::ErrorLog
      .where(:http_status => 500, :resolved => false, :created_at.gte => window)
      .group_by(&:error_class)

    if errors_by_class.empty?
      add_check("recurring_500s", true, { message: "No recurring 500s", window_minutes: threshold("window_minutes") })
      return
    end

    errors_by_class.each do |error_class, errors|
      count = errors.size
      next if count < warning_threshold

      severity = count >= critical_threshold ? :critical : :warning
      pattern_key = "recurring_500s:#{error_class}"

      add_check("recurring_500s", false, {
        pattern_key: pattern_key,
        severity: severity,
        error_class: error_class,
        count: count,
        critical_threshold: critical_threshold,
        warning_threshold: warning_threshold,
        sample_message: errors.first&.message&.truncate(200),
        window_minutes: threshold("window_minutes")
      })
    end

    # If no failures were added, mark as passed
    unless results[:failures].any? { |f| f[:name] == "recurring_500s" }
      add_check("recurring_500s", true, { message: "All error classes below threshold", window_minutes: threshold("window_minutes") })
    end
  end

  # -----------------------------------------------------------
  # Check 2: Endpoints con fallos repetidos
  # -----------------------------------------------------------
  def check_endpoint_failures
    window = threshold("window_minutes").minutes.ago
    critical_threshold = threshold("endpoint_critical")
    warning_threshold  = threshold("endpoint_warning")

    errors = System::ErrorLog
      .where(:http_status.gte => 500, :created_at.gte => window)
      .where(:request_method.ne => nil, :request_path.ne => nil)

    grouped = errors.group_by { |e| "#{e.request_method}:#{e.request_path}" }

    if grouped.empty?
      add_check("endpoint_failures", true, { message: "No endpoint failures", window_minutes: threshold("window_minutes") })
      return
    end

    grouped.each do |endpoint, errs|
      count = errs.size
      next if count < warning_threshold

      severity = count >= critical_threshold ? :critical : :warning
      pattern_key = "endpoint_failures:#{endpoint}"
      error_classes = errs.map(&:error_class).compact.tally.sort_by { |_, v| -v }.first(3)

      add_check("endpoint_failures", false, {
        pattern_key: pattern_key,
        severity: severity,
        endpoint: endpoint,
        count: count,
        error_classes: error_classes.to_h,
        sample_message: errs.first&.message&.truncate(200),
        window_minutes: threshold("window_minutes")
      })
    end

    unless results[:failures].any? { |f| f[:name] == "endpoint_failures" }
      add_check("endpoint_failures", true, { message: "All endpoints below threshold", window_minutes: threshold("window_minutes") })
    end
  end

  # -----------------------------------------------------------
  # Check 3: Pico de errores vs baseline 24h
  # -----------------------------------------------------------
  def check_error_spikes
    window = threshold("window_minutes")
    multiplier = threshold("spike_multiplier").to_f
    min_baseline = threshold("spike_min_baseline")

    now = Time.current
    current_count = System::ErrorLog
      .where(:http_status.gte => 500, :created_at.gte => now - window.minutes)
      .count

    # Baseline: average errors per same-length window over past 24h
    baseline_start = now - 24.hours
    baseline_total = System::ErrorLog
      .where(:http_status.gte => 500, :created_at.gte => baseline_start, :created_at.lt => now - window.minutes)
      .count

    windows_in_baseline = [(24 * 60 - window) / window.to_f, 1].max
    baseline_avg = (baseline_total / windows_in_baseline).round(1)

    effective_baseline = [baseline_avg, min_baseline].max
    spike_detected = current_count > (effective_baseline * multiplier)

    if spike_detected
      pattern_key = "error_spikes:global"
      add_check("error_spikes", false, {
        pattern_key: pattern_key,
        severity: :critical,
        current_count: current_count,
        baseline_avg: baseline_avg,
        effective_baseline: effective_baseline,
        multiplier: multiplier,
        threshold: (effective_baseline * multiplier).round(1),
        window_minutes: window
      })
    else
      add_check("error_spikes", true, {
        message: "No error spike detected",
        current_count: current_count,
        baseline_avg: baseline_avg,
        window_minutes: window
      })
    end
  end

  # -----------------------------------------------------------
  # Check 4: Clases de error nunca vistas en últimos N días
  # -----------------------------------------------------------
  def check_new_error_classes
    lookback_days = threshold("new_class_lookback_days")
    window = threshold("window_minutes").minutes.ago

    recent_classes = System::ErrorLog
      .where(:http_status.gte => 500, :created_at.gte => window)
      .distinct(:error_class)
      .compact

    if recent_classes.empty?
      add_check("new_error_classes", true, { message: "No recent 500 errors" })
      return
    end

    known_classes = System::ErrorLog
      .where(:http_status.gte => 500, :created_at.lt => window, :created_at.gte => lookback_days.days.ago)
      .distinct(:error_class)
      .compact

    new_classes = recent_classes - known_classes

    if new_classes.empty?
      add_check("new_error_classes", true, { message: "No new error classes", recent_classes: recent_classes.size })
    else
      new_classes.each do |error_class|
        pattern_key = "new_error_classes:#{error_class}"
        sample = System::ErrorLog.where(error_class: error_class, :created_at.gte => window).first

        add_check("new_error_classes", false, {
          pattern_key: pattern_key,
          severity: :warning,
          error_class: error_class,
          sample_message: sample&.message&.truncate(200),
          sample_path: sample&.request_path,
          lookback_days: lookback_days
        })
      end
    end
  end

  # -----------------------------------------------------------
  # Check 5: Tasa elevada de errores 4xx
  # -----------------------------------------------------------
  def check_elevated_4xx_rate
    window = threshold("fourxx_window_minutes").minutes.ago
    critical_threshold = threshold("fourxx_critical")
    warning_threshold  = threshold("fourxx_warning")

    count = System::ErrorLog
      .where(:http_status.gte => 400, :http_status.lt => 500, :created_at.gte => window)
      .count

    if count >= critical_threshold
      add_check("elevated_4xx_rate", false, {
        pattern_key: "elevated_4xx_rate:global",
        severity: :critical,
        count: count,
        critical_threshold: critical_threshold,
        window_minutes: threshold("fourxx_window_minutes")
      })
    elsif count >= warning_threshold
      add_check("elevated_4xx_rate", false, {
        pattern_key: "elevated_4xx_rate:global",
        severity: :warning,
        count: count,
        warning_threshold: warning_threshold,
        window_minutes: threshold("fourxx_window_minutes")
      })
    else
      add_check("elevated_4xx_rate", true, {
        message: "4xx rate normal",
        count: count,
        window_minutes: threshold("fourxx_window_minutes")
      })
    end
  end

  # -----------------------------------------------------------
  # Check 7: Auth health — detect users with repeated login
  # failures and no successful login. Catches situations where
  # a user's password was changed/corrupted and they can't access
  # the system (not just a one-off typo).
  # -----------------------------------------------------------
  def check_auth_health
    window = 24.hours.ago

    # Find users with auth failures in the last 24h
    auth_failures = System::ErrorLog
      .where(event_type: "auth_failure", :created_at.gte => window)
      .to_a

    # Group by user email
    by_email = auth_failures.group_by { |e| e.user_email }

    blocked_users = []
    by_email.each do |email, failures|
      next if email.blank?

      wrong_password = failures.select { |f| f.metadata&.dig("reason") == "wrong_password" }
      next if wrong_password.size < 2 # At least 2 failed attempts

      # Check if user had any successful login since the first failure
      first_failure_at = wrong_password.map(&:created_at).min
      user = Identity::User.where(email: email).first
      next unless user

      last_login = user.respond_to?(:last_sign_in_at) ? user.last_sign_in_at : nil
      has_logged_in_since = last_login && last_login > first_failure_at

      unless has_logged_in_since
        blocked_users << {
          email: email,
          user_name: user.full_name,
          failed_attempts: wrong_password.size,
          first_failure: first_failure_at.iso8601,
          last_failure: wrong_password.map(&:created_at).max.iso8601,
          account_locked: user.respond_to?(:access_locked?) ? user.access_locked? : false,
          last_successful_login: last_login&.iso8601
        }
      end
    end

    if blocked_users.any?
      severity = blocked_users.any? { |u| u[:failed_attempts] >= 5 } ? :critical : :warning

      add_check("auth_health", false, {
        pattern_key: "auth_health:blocked_users",
        severity: severity,
        blocked_users: blocked_users,
        message: "#{blocked_users.size} usuario(s) con intentos de login fallidos repetidos sin login exitoso"
      })
    else
      add_check("auth_health", true, {
        message: "No blocked users detected",
        auth_failures_24h: auth_failures.size
      })
    end
  end

  # -----------------------------------------------------------
  # Check 6: Conectividad de servicios (HTTP ping + error logs)
  # -----------------------------------------------------------
  def check_server_connectivity
    window = threshold("window_minutes").minutes.ago

    # Errores de conexión recientes en los logs
    conn_errors = System::ErrorLog
      .where(:created_at.gte => window)
      .any_of(
        { :message => CONNECTION_ERROR_PATTERNS },
        { "metadata.diagnosis.error" => CONNECTION_ERROR_PATTERNS }
      )

    conn_error_count = conn_errors.count
    conn_error_services = conn_errors.map { |e| e.request_path }.compact.uniq.first(5)

    # HTTP ping directo a cada servicio
    self.class.services.each do |service_name, config|
      rule_config = load_service_config(service_name)
      url = rule_config.fetch("url", config[:url])
      timeout = rule_config.fetch("timeout", HTTP_TIMEOUT)
      svc_severity = config[:severity]

      # En dev, vite_frontend es opcional (puede no estar corriendo)
      if service_name == "vite_frontend"
        environments = rule_config.fetch("environments", %w[development])
        unless environments.include?(Rails.env)
          add_check("server_connectivity", true, {
            service: service_name, skipped: true,
            reason: "Not enabled for #{Rails.env}"
          })
          next
        end
      end

      reachable, details = http_reachable?(url, timeout)

      if reachable
        add_check("server_connectivity", true, {
          service: service_name,
          **details,
          connection_errors_in_logs: conn_error_count
        })
      else
        pattern_key = "server_connectivity:#{service_name}"
        add_check("server_connectivity", false, {
          pattern_key: pattern_key,
          severity: svc_severity,
          service: service_name,
          **details,
          connection_errors_in_logs: conn_error_count,
          affected_paths: conn_error_services
        })
      end
    end
  end

  # -----------------------------------------------------------
  # HTTP helper
  # -----------------------------------------------------------
  def http_reachable?(url, timeout = HTTP_TIMEOUT)
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

  # -----------------------------------------------------------
  # Deduplicación de alertas por pattern_key
  # -----------------------------------------------------------
  def deduplicated_alert!(pattern_key, severity, failure)
    existing = AgentAlert.where(
      agent_id: agent_id,
      "metadata.pattern_key" => pattern_key,
      resolved: false
    ).first

    if existing
      count = (existing.metadata["occurrence_count"] || 1) + 1
      existing.update!(
        metadata: existing.metadata.merge(
          "occurrence_count" => count,
          "last_seen_at" => Time.current.iso8601,
          "details" => failure[:details]
        )
      )
      add_action("deduplicated_alert", { pattern_key: pattern_key, occurrence_count: count })
    else
      AgentAlert.create!(
        agent_id: agent_id,
        alert_type: severity.to_s,
        message: build_alert_message(failure),
        metadata: {
          "pattern_key" => pattern_key,
          "check_name" => failure[:name],
          "occurrence_count" => 1,
          "first_seen_at" => Time.current.iso8601,
          "last_seen_at" => Time.current.iso8601,
          "details" => failure[:details]
        }
      )
      add_action("created_alert", { pattern_key: pattern_key, severity: severity })
    end
  end

  def build_alert_message(failure)
    details = failure[:details]
    case failure[:name]
    when "server_connectivity"
      "Servicio #{details[:service]} no disponible: #{details[:error] || "HTTP #{details[:status_code]}"}"
    when "recurring_500s"
      "#{details[:error_class]}: #{details[:count]} errores 500 en #{details[:window_minutes]}min"
    when "endpoint_failures"
      "Endpoint #{details[:endpoint]}: #{details[:count]} fallos en #{details[:window_minutes]}min"
    when "error_spikes"
      "Pico de errores: #{details[:current_count]} (baseline: #{details[:baseline_avg]}, umbral: #{details[:threshold]})"
    when "new_error_classes"
      "Nueva clase de error detectada: #{details[:error_class]}"
    when "elevated_4xx_rate"
      "Tasa elevada de 4xx: #{details[:count]} en #{details[:window_minutes]}min"
    when "auth_health"
      users = details[:blocked_users] || []
      users.map { |u| "#{u[:user_name]} (#{u[:email]}): #{u[:failed_attempts]} intentos fallidos sin login exitoso" }.join("; ")
    else
      "Error monitor: #{failure[:name]}"
    end
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
             .where(agent_id: agent_id, document_type: "system", rule_name: rule_name)
             .first
  end

  def load_service_config(service_name)
    rule = AgentRule.active
                    .where(document_type: "system", rule_name: service_name)
                    .any_of({ agent_id: agent_id }, { agent_id: "service_health_agent" })
                    .first
    rule&.rule_config || {}
  end

  # -----------------------------------------------------------
  # Thresholds helpers
  # -----------------------------------------------------------
  def load_thresholds
    rule = load_rule("thresholds")
    DEFAULTS.merge(rule&.rule_config || {})
  end

  def threshold(key)
    @thresholds[key] || DEFAULTS[key]
  end
end
