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
user = Identity::User.find_or_initialize_by(email: "hectorneira2005@hotmail.com")
user.first_name = "Hector"
user.last_name = "Neira"
user.password = "Admin123"
user.organization = org
user.active = true
user.must_change_password = false
user.save!

# Assign roles
user.roles = [admin_role, hr_role]
user.save!

puts "User created: #{user.email} with roles: #{user.role_names.join(', ')}"
