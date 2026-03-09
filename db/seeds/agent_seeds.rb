# frozen_string_literal: true

# =============================================================
# db/seeds/agent_seeds.rb
# Ejecutar: rails runner "load 'db/seeds/agent_seeds.rb'"
# O incluir en db/seeds.rb
# =============================================================

puts "🛡️  Configurando sistema de agentes guardian..."

AgentRule.seed_defaults!

puts "✅ Reglas de agentes configuradas exitosamente"
puts ""
puts "Resumen de reglas:"
puts "  Total: #{AgentRule.count}"
puts "  Activas: #{AgentRule.active.count}"
puts "  Críticas: #{AgentRule.critical.count}"
puts ""
puts "Por agente:"
AgentRule.active.group_by(&:agent_id).each do |agent_id, rules|
  puts "  #{agent_id}: #{rules.size} reglas"
end
puts ""
puts "🚀 Sistema guardian listo. Los agentes se activarán con Sidekiq."
