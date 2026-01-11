# frozen_string_literal: true

u = Identity::User.find_by(email: "legal@valkyria.com")
u.password = "Admin123"
u.must_change_password = false
u.save!
puts "Password reset for: #{u.email}"
