# frozen_string_literal: true

u = Identity::User.find_by(email: "legal@valkyria.com")
u.first_name = "Nathalia"
u.last_name = "Mendoza"
u.save!
puts "Updated user: #{u.first_name} #{u.last_name} - #{u.email}"
