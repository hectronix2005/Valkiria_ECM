# frozen_string_literal: true

# Reset passwords for key users
%w[hectorneira2005@hotmail.com legal@valkyria.com admin@valkyria.com].each do |email|
  u = Identity::User.find_by(email: email)
  next unless u

  u.password = "Admin123"
  u.must_change_password = false
  u.save!
  puts "Password reset for: #{u.email}"
end
