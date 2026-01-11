# frozen_string_literal: true

u = Identity::User.find_by(email: "hectorneira2005@hotmail.com")
u.password = "Admin123"
u.must_change_password = false
u.save!
puts "Password reset for: #{u.email}"
