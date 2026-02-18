# frozen_string_literal: true

class ErrorDiagnosticService
  STATIC_ASSET_EXTENSIONS = %w[.ico .map .txt .png .jpg .jpeg .gif .svg .woff .woff2 .ttf .eot .css .js].freeze
  KNOWN_NOISE_PATHS = %w[favicon.ico robots.txt apple-touch-icon apple-touch-icon-precomposed.png sitemap.xml].freeze
  BOT_PATTERNS = /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider/i

  # Main entry point: analyze an ErrorLog, store diagnosis in metadata
  def self.diagnose(error_log)
    category = classify_category(error_log)
    priority = classify_priority(error_log)
    similar_count = count_similar_recent(error_log)
    actions = suggest_actions(error_log, similar_count)
    auto_resolve_reason = check_auto_resolve(error_log)

    # Elevate priority if recurring pattern
    if similar_count > 10 && error_log.severity == "error" && priority == "medium"
      priority = "high"
    end

    diagnosis = {
      "category" => category,
      "priority" => priority,
      "suggested_actions" => actions,
      "similar_count_24h" => similar_count,
      "auto_resolved" => auto_resolve_reason.present?,
      "auto_resolve_reason" => auto_resolve_reason,
      "diagnosed_at" => Time.current.iso8601
    }.compact

    merged_metadata = (error_log.metadata || {}).merge("diagnosis" => diagnosis)
    update_attrs = { metadata: merged_metadata }

    if auto_resolve_reason.present? && !error_log.resolved
      update_attrs[:resolved] = true
      update_attrs[:resolved_at] = Time.current
      update_attrs[:resolved_by] = "system:auto-diagnosis"
    end

    error_log.update(update_attrs)
    error_log
  end

  # Classify error into a functional category
  def self.classify_category(log)
    case log.event_type
    when "auth_failure" then "authentication"
    when "not_found" then "routing"
    when "validation_error" then "validation"
    when "frontend_error" then "frontend"
    when "process_failure"
      classify_process_failure_category(log)
    when "exception"
      classify_exception_category(log)
    when "api_error" then "integration"
    else
      "uncategorized"
    end
  end

  # Assign priority based on severity and context
  def self.classify_priority(log)
    return "critical" if log.severity == "fatal"

    if log.http_status && log.http_status >= 500
      return "high"
    end

    case log.severity
    when "error" then "medium"
    when "warning" then "low"
    when "info" then "low"
    else "medium"
    end
  end

  # Suggest resolution actions based on error type
  def self.suggest_actions(log, similar_count = nil)
    actions = []

    case log.event_type
    when "exception"
      actions << "Revisar backtrace completo para identificar la causa raiz"
      actions << "Reproducir el error en ambiente de desarrollo"
      if log.error_class&.match?(/Mongoid|Mongo/)
        actions << "Verificar conexion y estado de MongoDB"
      end
    when "auth_failure"
      actions << "Verificar que el token de autenticacion sea valido"
      actions << "Confirmar que el usuario tiene los permisos necesarios"
    when "not_found"
      actions << "Verificar que la ruta o recurso solicitado existe"
      actions << "Revisar si el recurso fue eliminado o movido"
    when "validation_error"
      actions << "Revisar los parametros enviados en el request"
      actions << "Verificar las reglas de validacion del modelo"
    when "process_failure"
      actions << "Revisar la logica del proceso que fallo"
      if log.metadata&.dig("missing_variables").present?
        actions << "Configurar el mapeo de variables faltantes en Administracion"
      end
    when "frontend_error"
      actions << "Revisar la consola del navegador para mas detalles"
      actions << "Verificar compatibilidad del navegador del usuario"
    when "api_error"
      actions << "Revisar la respuesta del servidor para detalles del error"
      actions << "Verificar los parametros del request"
    end

    similar = similar_count || count_similar_recent(log)
    if similar > 5
      actions << "Patron recurrente (#{similar} en 24h) - investigar causa raiz"
    end

    actions
  end

  # Count similar errors (same error_class) in last 24 hours
  def self.count_similar_recent(log)
    return 0 unless log.error_class.present?

    System::ErrorLog
      .where(error_class: log.error_class)
      .where(:created_at.gte => 24.hours.ago)
      .where(:id.ne => log.id)
      .count
  end

  # Check if this error matches a known benign pattern for auto-resolution
  def self.check_auto_resolve(log)
    # 1. 404 on static assets
    if log.event_type == "not_found" && log.request_path.present?
      path = log.request_path.downcase
      if STATIC_ASSET_EXTENSIONS.any? { |ext| path.end_with?(ext) }
        return "404 en recurso estatico (#{File.extname(path)})"
      end
      if KNOWN_NOISE_PATHS.any? { |p| path.include?(p) }
        return "404 en archivo comun no configurado (#{File.basename(path)})"
      end
    end

    # 2. Auth failure from bots/crawlers
    if log.event_type == "auth_failure" && log.user_agent.present?
      if log.user_agent.match?(BOT_PATTERNS)
        return "Fallo de autenticacion por bot/crawler"
      end
    end

    # 3. Info-severity non-exception (informational noise)
    if log.severity == "info" && log.event_type != "exception"
      return "Evento informativo (no requiere accion)"
    end

    # 4. Repeated validation error from same user within 5 minutes
    if log.event_type == "validation_error" && log.user_id.present?
      recent_same = System::ErrorLog
        .where(event_type: "validation_error", user_id: log.user_id, error_class: log.error_class)
        .where(:created_at.gte => 5.minutes.ago)
        .where(:id.ne => log.id)
        .count
      if recent_same >= 1
        return "Error de validacion repetido del mismo usuario (#{recent_same + 1} en 5 min)"
      end
    end

    # 5. Auth failures with failed login attempts (expected user error, not security issue)
    if log.event_type == "auth_failure" && log.message&.match?(/Login fallido.*Contrase[nñ]a incorrecta/i)
      return "Intento de login con contrasena incorrecta (error de usuario)"
    end

    # 6. Transient network timeouts (Net::ReadTimeout, Net::OpenTimeout)
    if log.event_type == "exception" && log.error_class&.match?(/Net::ReadTimeout|Net::OpenTimeout/)
      return "Timeout de red transitorio (#{log.error_class})"
    end

    # 7. Process failures with 422 status (expected validation at business level)
    if log.event_type == "process_failure" && log.http_status == 422
      return "Fallo de proceso esperado (validacion de negocio, HTTP 422)"
    end

    # 8. Frontend errors mirroring backend 500s (symptom, not root cause)
    if log.event_type == "frontend_error" && log.error_class == "HttpError500"
      return "Error frontend reflejo de error backend 500 (resolver causa raiz en backend)"
    end

    nil
  end

  # Aggregation: group errors by error_class for pattern analysis
  def self.patterns(days: 7, limit: 50)
    cutoff = days.days.ago

    pipeline = [
      { "$match" => { "created_at" => { "$gte" => cutoff } } },
      {
        "$group" => {
          "_id" => "$error_class",
          "count" => { "$sum" => 1 },
          "unresolved_count" => {
            "$sum" => { "$cond" => [{ "$eq" => ["$resolved", false] }, 1, 0] }
          },
          "severities" => { "$addToSet" => "$severity" },
          "event_types" => { "$addToSet" => "$event_type" },
          "first_seen" => { "$min" => "$created_at" },
          "last_seen" => { "$max" => "$created_at" },
          "example_id" => { "$last" => { "$toString" => "$_id" } }
        }
      },
      { "$sort" => { "count" => -1 } },
      { "$limit" => limit }
    ]

    results = System::ErrorLog.collection.aggregate(pipeline).to_a

    results.map do |r|
      {
        error_class: r["_id"],
        count: r["count"],
        unresolved_count: r["unresolved_count"],
        severities: r["severities"],
        event_types: r["event_types"],
        first_seen: r["first_seen"]&.iso8601,
        last_seen: r["last_seen"]&.iso8601,
        example_id: r["example_id"]
      }
    end
  end

  # --- Private helpers ---

  def self.classify_process_failure_category(log)
    if log.metadata&.dig("missing_variables").present?
      "business_logic"
    elsif log.error_class&.match?(/timeout|connection/i)
      "network"
    else
      "business_logic"
    end
  end
  private_class_method :classify_process_failure_category

  def self.classify_exception_category(log)
    case log.error_class
    when /Mongoid|Mongo|BSON/
      "database"
    when /Net::|Timeout|HTTP|Socket|Connection|Faraday|RestClient/
      "network"
    when /NoMethodError|NameError|TypeError|ArgumentError|SyntaxError|LoadError/
      "code_defect"
    when /ActiveRecord|PG::|Mysql2/
      "database"
    else
      "system"
    end
  end
  private_class_method :classify_exception_category
end
