# frozen_string_literal: true

# Create organization
org = Identity::Organization.find_or_create_by(name: "Valkyria")
org.settings ||= {}
org.save!
puts "Organization: #{org.name}"

# Create roles if they don't exist
admin_role = Identity::Role.find_or_create_by(name: "admin") do |r|
  r.display_name = "Administrator"
  r.level = 5
end
puts "Admin role: #{admin_role.name}"

hr_role = Identity::Role.find_or_create_by(name: "hr") do |r|
  r.display_name = "Human Resources"
  r.level = 3
end
puts "HR role: #{hr_role.name}"

employee_role = Identity::Role.find_or_create_by(name: "employee") do |r|
  r.display_name = "Employee"
  r.level = 1
end
puts "Employee role: #{employee_role.name}"

# Create admin user
admin_email = ENV.fetch("ADMIN_EMAIL", "admin@valkyria.com")
admin_password = ENV.fetch("ADMIN_PASSWORD") { SecureRandom.hex(16) }
user = Identity::User.find_or_initialize_by(email: admin_email)
user.first_name = ENV.fetch("ADMIN_FIRST_NAME", "Admin")
user.last_name = ENV.fetch("ADMIN_LAST_NAME", "User")
user.password = admin_password
user.organization = org
user.active = true
user.must_change_password = true
user.save!
puts "Admin password: #{admin_password}" if user.previously_new_record?

# Assign roles
user.roles = [admin_role, hr_role]
user.save!

puts "User created: #{user.email} with roles: #{user.role_names.join(', ')}"
