# frozen_string_literal: true

# Production seed — safe to run multiple times (idempotent)
# Creates: permissions, roles, organization, and admin user
#
# Usage:
#   ADMIN_PASSWORD=SecurePass123! heroku run rails runner db/seeds/production_admin.rb
#   Or without password (one will be auto-generated):
#   heroku run rails runner db/seeds/production_admin.rb

puts "=" * 60
puts "VALKYRIA ECM — Production Seed"
puts "=" * 60

# 1. Seed all permissions
puts "\n--- Permissions ---"
Identity::Permission.seed_defaults!
puts "Permissions: #{Identity::Permission.count} total"

# 2. Seed all roles (11 system roles with permissions)
puts "\n--- Roles ---"
Identity::Role.seed_defaults!
Identity::Role.all.each do |r|
  puts "  #{r.name} (level #{r.level}) — #{r.permissions.count} permissions"
end

# 3. Create organization
puts "\n--- Organization ---"
org = Identity::Organization.find_or_create_by(name: "Valkyria")
org.settings ||= {}
org.active = true
org.save!
puts "Organization: #{org.name} (#{org.id})"

# 4. Create admin user
puts "\n--- Admin User ---"
admin_email = ENV.fetch("ADMIN_EMAIL", "admin@valkyria.com")
admin_password = ENV.fetch("ADMIN_PASSWORD") { SecureRandom.hex(16) }

admin_role = Identity::Role.find_by(name: "admin")
hr_role = Identity::Role.find_by(name: "hr")

user = Identity::User.find_or_initialize_by(email: admin_email)
is_new = user.new_record?
user.first_name = ENV.fetch("ADMIN_FIRST_NAME", "Admin")
user.last_name = ENV.fetch("ADMIN_LAST_NAME", "Valkyria")
user.password = admin_password
user.organization = org
user.active = true
user.must_change_password = true
user.save!

# Assign admin + hr roles
user.roles = [admin_role, hr_role].compact
user.save!

if is_new
  puts "CREATED: #{user.email}"
  puts "PASSWORD: #{admin_password}"
  puts "(must_change_password: true)"
else
  puts "UPDATED: #{user.email} (password reset)"
end
puts "Roles: #{user.role_names.join(', ')}"

puts "\n" + "=" * 60
puts "Production seed complete!"
puts "=" * 60
