# frozen_string_literal: true

namespace :agents do
  desc "Remove hardcoded localhost URLs from agent rules and resolve stale alerts"
  task fix_production_urls: :environment do
    # Remove hardcoded URLs so code defaults (ENV-aware) take effect
    %w[rails_api gotenberg vite_frontend].each do |svc|
      rule = AgentRule.find_by(agent_id: "service_health_agent", rule_name: svc)
      next unless rule

      config = rule.rule_config.dup
      config.delete("url")
      rule.update!(rule_config: config)
      puts "Fixed #{svc}: #{config}"
    rescue Mongoid::Errors::DocumentNotFound
      puts "#{svc}: rule not found, skipping"
    end

    # Resolve all stale alerts
    count = AgentAlert.where(resolved: false).update_all(resolved: true, resolved_at: Time.current)
    puts "Resolved #{count} stale alerts"
  end
end
