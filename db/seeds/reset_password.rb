# frozen_string_literal: true

# Reset passwords for key users — requires ADMIN_PASSWORD env var
unless ENV["ADMIN_PASSWORD"].present?
  puts "ERROR: Set ADMIN_PASSWORD environment variable to reset passwords."
  puts "Usage: ADMIN_PASSWORD=YourSecurePassword rails db:seed:reset_password"
  exit 1
end

new_password = ENV["ADMIN_PASSWORD"]
%w[admin@valkyria.com].each do |email|
  u = Identity::User.find_by(email: email)
  next unless u

  u.password = new_password
  u.must_change_password = true
  u.save!
  puts "Password reset for: #{u.email} (must change on next login)"
end
