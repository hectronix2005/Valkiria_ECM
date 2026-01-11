# frozen_string_literal: true

# Create organization
org = Identity::Organization.find_or_create_by(name: "Valkyria")
org.settings ||= {}
org.save!
puts "Organization: #{org.name}"

# Create admin user
user = Identity::User.find_or_initialize_by(email: "hectorneira2005@hotmail.com")
user.first_name = "Hector"
user.last_name = "Neira"
user.password = "Admin123"
user.organization = org
user.roles = ["admin", "hr"]
user.active = true
user.must_change_password = false
user.save!
puts "User created: #{user.email}"
