# frozen_string_literal: true

namespace :db do
  desc "Drop old sparse indexes and recreate with partial filter expressions"
  task fix_employee_indexes: :environment do
    db = Mongoid.default_client.database
    coll = db["hr_employees"]

    # Drop old sparse indexes that fail on null duplicates
    coll.indexes.each do |idx|
      name = idx["name"]
      next if name == "_id_"

      if name.include?("employee_number") || name.include?("user_id")
        puts "Dropping index: #{name}"
        coll.indexes.drop_one(name)
      end
    end

    puts "Old indexes dropped. Now run rake db:mongoid:create_indexes to rebuild."
  end
end
