# frozen_string_literal: true

namespace :variables do
  desc "Normalize all variable names to uppercase without accents"
  task normalize: :environment do
    puts "Normalizing variable mappings..."

    # Normalize existing mappings
    Templates::VariableMapping.all.each do |mapping|
      old_name = mapping.name
      new_name = Templates::VariableNormalizer.normalize(old_name)

      if old_name != new_name
        mapping.set(name: new_name)
        puts "  Mapping: '#{old_name}' -> '#{new_name}'"
      end
    end

    puts "\nNormalizing template variables..."

    # Normalize template variables and mappings
    Templates::Template.all.each do |template|
      next if template.variables.blank?

      # Normalize variables array
      old_variables = template.variables
      new_variables = old_variables.map { |v| Templates::VariableNormalizer.normalize(v) }.uniq

      # Normalize variable_mappings keys
      old_mappings = template.variable_mappings || {}
      new_mappings = {}

      old_mappings.each do |key, value|
        normalized_key = Templates::VariableNormalizer.normalize(key)
        new_mappings[normalized_key] = value
      end

      if old_variables != new_variables || old_mappings != new_mappings
        template.set(
          variables: new_variables,
          variable_mappings: new_mappings
        )
        puts "  Template '#{template.name}':"
        puts "    Variables: #{old_variables.size} -> #{new_variables.size}"
        puts "    Mappings updated: #{new_mappings.keys.join(', ')}"
      end
    end

    puts "\nDone!"
  end

  desc "Re-seed system mappings with normalized names"
  task reseed_system: :environment do
    puts "Deleting existing system mappings..."
    Templates::VariableMapping.system_mappings.delete_all

    puts "Creating new system mappings..."
    Templates::VariableMapping.seed_system_mappings!

    count = Templates::VariableMapping.system_mappings.count
    puts "Created #{count} system mappings"
  end

  desc "Show current state of variables and mappings"
  task status: :environment do
    puts "=== Variable Mappings ==="
    Templates::VariableMapping.ordered.each do |m|
      status = m.is_system ? "[SYSTEM]" : "[CUSTOM]"
      active = m.active ? "" : "(inactive)"
      puts "  #{status} #{m.name} => #{m.key} #{active}"
    end

    puts "\n=== Template Variables ==="
    Templates::Template.all.each do |t|
      next if t.variables.blank?

      puts "\n#{t.name} (#{t.status}):"
      t.variables.each do |v|
        mapping = t.variable_mappings[v]
        status = mapping ? "-> #{mapping}" : "(unmapped)"
        puts "  {{#{v}}} #{status}"
      end
    end
  end
end
