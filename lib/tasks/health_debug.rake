# frozen_string_literal: true

namespace :agents do
  desc "Run service_health_agent checks manually and print results"
  task health_debug: :environment do
    agent = ServiceHealthAgent.new("manual_debug")

    %w[check_mongodb check_redis check_sidekiq check_rails_api check_gotenberg check_vite_frontend].each do |method|
      begin
        agent.send(method)
      rescue StandardError => e
        puts "#{method}: EXCEPTION #{e.class}: #{e.message}"
      end
    end

    checks = agent.results[:checks] || []
    checks.each do |result|
      status = result[:passed] ? "PASS" : "FAIL"
      puts "#{status} | #{result[:name]} | #{result[:details].inspect}"
    end

    puts "\nTotal: #{checks.size} checks, #{checks.count { |r| !r[:passed] }} failures"
  end
end
