# frozen_string_literal: true

# Service Diagnostics for VALKYRIA ECM
# Checks all required services and reports status with actionable suggestions.
# Does NOT depend on :environment so it works even if Rails fails to boot.
#
# Usage:
#   rake diagnose          # Run all service checks
#   bin/diagnose           # Shortcut wrapper

require "socket"
require "timeout"
require "net/http"
require "uri"

desc "Diagnose service health (MongoDB, Redis, Rails, Vite, Gotenberg)"
task :diagnose do
  # ── ANSI colors ──────────────────────────────────────────────
  GREEN  = "\e[32m"
  RED    = "\e[31m"
  YELLOW = "\e[33m"
  GRAY   = "\e[90m"
  BOLD   = "\e[1m"
  RESET  = "\e[0m"

  # ── Helpers ──────────────────────────────────────────────────
  def tcp_open?(host, port, timeout: 5)
    Timeout.timeout(timeout) do
      sock = TCPSocket.new(host, port)
      sock.close
      true
    end
  rescue StandardError
    false
  end

  def http_ok?(url, timeout: 5)
    uri = URI.parse(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = timeout
    http.read_timeout = timeout
    response = http.get(uri.request_uri)
    response.code.to_i < 400
  rescue StandardError
    false
  end

  def redis_ping?(host, port, timeout: 5)
    Timeout.timeout(timeout) do
      sock = TCPSocket.new(host, port)
      sock.write("*1\r\n$4\r\nPING\r\n")
      response = sock.gets
      sock.close
      response&.include?("+PONG")
    end
  rescue StandardError
    false
  end

  # ── Port configuration consistency check ─────────────────────
  def detect_configured_ports
    root = File.expand_path("../..", __dir__)
    mismatches = []
    ports_found = {}

    # puma.rb
    puma_path = File.join(root, "config", "puma.rb")
    if File.exist?(puma_path)
      content = File.read(puma_path)
      if (m = content.match(/port\s+ENV\.fetch\(\s*["']PORT["']\s*,\s*(\d+)\s*\)/))
        ports_found["config/puma.rb"] = m[1].to_i
      end
    end

    # vite.config.js
    vite_path = File.join(root, "frontend", "vite.config.js")
    if File.exist?(vite_path)
      content = File.read(vite_path)
      if (m = content.match(/target:\s*['"]https?:\/\/[\w.]+:(\d+)['"]/))
        ports_found["frontend/vite.config.js"] = m[1].to_i
      end
    end

    # README.md
    readme_path = File.join(root, "README.md")
    if File.exist?(readme_path)
      content = File.read(readme_path)
      if (m = content.match(/Backend API\s*\|\s*https?:\/\/[\w.]+:(\d+)/))
        ports_found["README.md"] = m[1].to_i
      end
    end

    # Dockerfile
    dockerfile_path = File.join(root, "Dockerfile")
    if File.exist?(dockerfile_path)
      content = File.read(dockerfile_path)
      if (m = content.match(/EXPOSE\s+(\d+)/))
        ports_found["Dockerfile"] = m[1].to_i
      end
    end

    unique_ports = ports_found.values.uniq
    if unique_ports.size > 1
      ports_found.each do |file, port|
        mismatches << "  #{file}: port #{port}"
      end
    end

    { ports: ports_found, mismatches: mismatches }
  end

  # ── Service checks (run in parallel with threads) ────────────
  results = {}
  mutex = Mutex.new

  checks = {
    mongodb: -> {
      ok = tcp_open?("localhost", 27017)
      {
        status: ok ? :ok : :fail,
        label: "MongoDB",
        detail: ok ? "localhost:27017 reachable" : "Cannot connect to localhost:27017",
        suggestion: ok ? nil : "Start MongoDB: brew services start mongodb-community"
      }
    },

    redis: -> {
      port_open = tcp_open?("localhost", 6379)
      pong = port_open ? redis_ping?("localhost", 6379) : false
      status = pong ? :ok : (port_open ? :warn : :fail)
      detail = if pong
                 "localhost:6379 reachable, PONG received"
               elsif port_open
                 "Port open but PING failed"
               else
                 "Cannot connect to localhost:6379"
               end
      {
        status: status,
        label: "Redis",
        detail: detail,
        suggestion: pong ? nil : "Start Redis: brew services start redis"
      }
    },

    rails: -> {
      on_3000 = tcp_open?("127.0.0.1", 3000)
      healthy = on_3000 ? http_ok?("http://127.0.0.1:3000/up") : false
      on_3001 = !on_3000 ? tcp_open?("127.0.0.1", 3001) : false

      if on_3000 && healthy
        { status: :ok, label: "Rails/Puma", detail: "127.0.0.1:3000 healthy (/up OK)", suggestion: nil }
      elsif on_3000
        { status: :warn, label: "Rails/Puma", detail: "Port 3000 open but /up returned error", suggestion: "Check Rails logs: tail -f log/development.log" }
      elsif on_3001
        { status: :warn, label: "Rails/Puma", detail: "Not on :3000 but FOUND on :3001 (port mismatch!)", suggestion: "Config says 3000 but Puma is on 3001. Restart Rails: bundle exec rails s -b 127.0.0.1" }
      else
        { status: :fail, label: "Rails/Puma", detail: "No server on 127.0.0.1:3000", suggestion: "Start Rails: bundle exec rails s -b 127.0.0.1" }
      end
    },

    vite: -> {
      ok = tcp_open?("127.0.0.1", 5173)
      {
        status: ok ? :ok : :fail,
        label: "Vite Dev Server",
        detail: ok ? "127.0.0.1:5173 reachable" : "No server on 127.0.0.1:5173",
        suggestion: ok ? nil : "Start Vite: cd frontend && npm run dev"
      }
    },

    gotenberg: -> {
      gotenberg_url = ENV["GOTENBERG_URL"]
      if gotenberg_url.nil? || gotenberg_url.strip.empty?
        { status: :skip, label: "Gotenberg", detail: "GOTENBERG_URL not set", suggestion: nil }
      else
        health_url = "#{gotenberg_url.chomp('/')}/health"
        ok = http_ok?(health_url)
        {
          status: ok ? :ok : :fail,
          label: "Gotenberg",
          detail: ok ? "#{health_url} OK" : "Cannot reach #{health_url}",
          suggestion: ok ? nil : "Start Gotenberg: docker run -p 3100:3000 gotenberg/gotenberg:8"
        }
      end
    }
  }

  threads = checks.map do |key, check_proc|
    Thread.new do
      result = check_proc.call
      mutex.synchronize { results[key] = result }
    end
  end

  threads.each(&:join)

  # ── Port configuration analysis ─────────────────────────────
  port_info = detect_configured_ports

  # ── Output ───────────────────────────────────────────────────
  puts ""
  puts "#{BOLD}VALKYRIA ECM — Service Diagnostics#{RESET}"
  puts "=" * 50

  status_icon = { ok: "#{GREEN}OK#{RESET}", fail: "#{RED}FAIL#{RESET}", warn: "#{YELLOW}WARN#{RESET}", skip: "#{GRAY}SKIP#{RESET}" }
  counters = { ok: 0, fail: 0, warn: 0, skip: 0 }

  display_order = [:mongodb, :redis, :rails, :vite, :gotenberg]
  display_order.each do |key|
    r = results[key]
    next unless r

    counters[r[:status]] += 1
    icon = status_icon[r[:status]]
    puts ""
    puts "  [#{icon}] #{BOLD}#{r[:label]}#{RESET}"
    puts "       #{r[:detail]}"
    puts "       #{YELLOW}-> #{r[:suggestion]}#{RESET}" if r[:suggestion]
  end

  # Port mismatch warnings
  unless port_info[:mismatches].empty?
    puts ""
    puts "  [#{YELLOW}WARN#{RESET}] #{BOLD}Port Configuration Mismatch#{RESET}"
    puts "       Different Rails ports configured across files:"
    port_info[:mismatches].each { |line| puts "       #{line}" }
    puts "       #{YELLOW}-> All files should agree on the same port (typically 3000)#{RESET}"
    counters[:warn] += 1
  end

  # Summary
  puts ""
  puts "=" * 50
  parts = []
  parts << "#{GREEN}#{counters[:ok]} OK#{RESET}" if counters[:ok] > 0
  parts << "#{YELLOW}#{counters[:warn]} WARN#{RESET}" if counters[:warn] > 0
  parts << "#{RED}#{counters[:fail]} FAIL#{RESET}" if counters[:fail] > 0
  parts << "#{GRAY}#{counters[:skip]} SKIP#{RESET}" if counters[:skip] > 0
  puts "Summary: #{parts.join('  ')}"
  puts ""

  exit 1 if counters[:fail] > 0
end
