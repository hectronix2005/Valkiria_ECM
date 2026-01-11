# frozen_string_literal: true

# Database Synchronization Tasks for VALKYRIA ECM
# Provides bidirectional sync between local MongoDB and production (MongoDB Atlas)
#
# Usage:
#   rake db:sync:to_production      # Sync local → production (DESTRUCTIVE for production)
#   rake db:sync:from_production    # Sync production → local (DESTRUCTIVE for local)
#   rake db:sync:backup:local       # Backup local database
#   rake db:sync:backup:production  # Backup production database
#   rake db:sync:status             # Show sync status and database info

namespace :db do
  namespace :sync do
    # Configuration
    LOCAL_DB = "valkyria_ecm_development"
    LOCAL_HOST = "localhost:27017"
    BACKUP_DIR = Rails.root.join("tmp", "db_backups")
    DUMP_DIR = Rails.root.join("tmp", "mongo_sync")

    # Collections to sync (order matters for references)
    COLLECTIONS = %w[
      organizations
      permissions
      roles
      departments
      users
      hr_employees
      hr_vacation_requests
      hr_certification_requests
      legal_third_party_types
      legal_third_parties
      legal_contracts
      generated_documents
      templates
      template_signatories
      signatory_types
      variable_mappings
      content_documents
      user_signatures
      audit_events
      fs.files
      fs.chunks
    ].freeze

    desc "Show database sync status and info"
    task status: :environment do
      puts "\n" + "=" * 60
      puts "DATABASE SYNC STATUS"
      puts "=" * 60

      # Local info
      puts "\n📁 LOCAL DATABASE:"
      puts "   Host: #{LOCAL_HOST}"
      puts "   Database: #{LOCAL_DB}"

      local_counts = {}
      COLLECTIONS.each do |col|
        count = `mongosh --quiet --eval "db.#{col}.countDocuments()" #{LOCAL_DB} 2>/dev/null`.strip
        local_counts[col] = count.to_i if count =~ /^\d+$/
      end
      puts "   Total collections with data: #{local_counts.count { |_, v| v > 0 }}"

      # Production info
      puts "\n☁️  PRODUCTION DATABASE (MongoDB Atlas):"
      prod_uri = fetch_production_uri
      if prod_uri
        db_name = prod_uri.match(%r{/([^/?]+)\?})&.[](1) || "unknown"
        puts "   Database: #{db_name}"
        puts "   Status: Connected via MONGODB_URI"
      else
        puts "   Status: ⚠️  Cannot fetch MONGODB_URI from Heroku"
      end

      # Collection comparison
      puts "\n📊 COLLECTION COUNTS:"
      puts "   #{"Collection".ljust(30)} | #{"Local".rjust(8)} | #{"Production".rjust(10)}"
      puts "   " + "-" * 55

      COLLECTIONS.each do |col|
        local = local_counts[col] || 0
        puts "   #{col.ljust(30)} | #{local.to_s.rjust(8)} |"
      end

      puts "\n" + "=" * 60
      puts "Use 'rake db:sync:to_production' or 'rake db:sync:from_production'"
      puts "=" * 60 + "\n"
    end

    desc "Sync local database TO production (⚠️ DESTRUCTIVE for production)"
    task to_production: :environment do
      puts "\n" + "=" * 60
      puts "⚠️  SYNC LOCAL → PRODUCTION"
      puts "=" * 60
      puts "\nThis will OVERWRITE production data with local data!"
      puts "Production database will be completely replaced.\n"

      unless confirm_action("sync LOCAL → PRODUCTION")
        puts "Aborted."
        next
      end

      # Step 1: Backup production first
      puts "\n📦 Step 1: Backing up production database..."
      Rake::Task["db:sync:backup:production"].invoke

      # Step 2: Dump local database
      puts "\n📤 Step 2: Dumping local database..."
      dump_local_database

      # Step 3: Restore to production
      puts "\n📥 Step 3: Restoring to production..."
      restore_to_production

      # Step 4: Run post-sync tasks
      puts "\n🔧 Step 4: Running post-sync tasks on production..."
      run_production_post_sync

      puts "\n✅ Sync complete! Production now matches local."
      puts "=" * 60 + "\n"
    end

    desc "Sync production database TO local (⚠️ DESTRUCTIVE for local)"
    task from_production: :environment do
      puts "\n" + "=" * 60
      puts "⚠️  SYNC PRODUCTION → LOCAL"
      puts "=" * 60
      puts "\nThis will OVERWRITE local data with production data!"
      puts "Local database will be completely replaced.\n"

      unless confirm_action("sync PRODUCTION → LOCAL")
        puts "Aborted."
        next
      end

      # Step 1: Backup local first
      puts "\n📦 Step 1: Backing up local database..."
      Rake::Task["db:sync:backup:local"].invoke

      # Step 2: Dump production database
      puts "\n📤 Step 2: Dumping production database..."
      dump_production_database

      # Step 3: Restore to local
      puts "\n📥 Step 3: Restoring to local..."
      restore_to_local

      puts "\n✅ Sync complete! Local now matches production."
      puts "=" * 60 + "\n"
    end

    desc "Sync specific collection to production"
    task :collection_to_production, [:collection] => :environment do |_t, args|
      collection = args[:collection]
      unless collection
        puts "Usage: rake db:sync:collection_to_production[collection_name]"
        puts "Available collections: #{COLLECTIONS.join(', ')}"
        next
      end

      puts "\n📤 Syncing collection '#{collection}' to production..."

      unless confirm_action("sync collection '#{collection}' to production")
        puts "Aborted."
        next
      end

      sync_collection_to_production(collection)
      puts "✅ Collection '#{collection}' synced to production."
    end

    desc "Sync specific collection from production"
    task :collection_from_production, [:collection] => :environment do |_t, args|
      collection = args[:collection]
      unless collection
        puts "Usage: rake db:sync:collection_from_production[collection_name]"
        puts "Available collections: #{COLLECTIONS.join(', ')}"
        next
      end

      puts "\n📥 Syncing collection '#{collection}' from production..."

      unless confirm_action("sync collection '#{collection}' from production")
        puts "Aborted."
        next
      end

      sync_collection_from_production(collection)
      puts "✅ Collection '#{collection}' synced from local."
    end

    desc "Generate PDF previews for templates uploaded in production"
    task generate_previews: :environment do
      puts "\n" + "=" * 60
      puts "🖼️  GENERATE PDF PREVIEWS"
      puts "=" * 60
      puts "\nThis will:"
      puts "  1. Sync templates from production"
      puts "  2. Generate PDF previews locally (requires LibreOffice)"
      puts "  3. Sync previews back to production\n"

      # Step 1: Sync from production
      puts "\n📥 Step 1: Syncing templates and files from production..."
      %w[templates fs.files fs.chunks].each do |col|
        sync_collection_from_production(col)
        puts "   ✓ #{col}"
      end

      # Step 2: Find templates without previews
      puts "\n🔍 Step 2: Finding templates without PDF previews..."
      templates_without_preview = Templates::Template.where(:file_id.ne => nil, :preview_file_id => nil)
        .select { |t| t.file_name&.end_with?(".docx") }

      if templates_without_preview.empty?
        puts "   ✓ All templates already have PDF previews!"
        puts "\n" + "=" * 60
        next
      end

      puts "   Found #{templates_without_preview.count} template(s) without preview:"
      templates_without_preview.each { |t| puts "   - #{t.name}" }

      # Step 3: Generate previews
      puts "\n🖨️  Step 3: Generating PDF previews (using LibreOffice)..."
      generated = 0
      templates_without_preview.each do |template|
        print "   Generating: #{template.name}..."

        content = template.file_content
        unless content
          puts " ⚠️  No file content, skipped"
          next
        end

        begin
          pdf_content = template.send(:convert_docx_to_pdf_for_dimensions, content)
          if pdf_content
            template.store_pdf_preview!(pdf_content)
            template.save!
            generated += 1
            puts " ✓ (#{pdf_content.bytesize} bytes)"
          else
            puts " ⚠️  Conversion failed"
          end
        rescue StandardError => e
          puts " ❌ Error: #{e.message}"
        end
      end

      puts "   Generated #{generated} preview(s)"

      # Step 4: Sync back to production
      if generated > 0
        puts "\n📤 Step 4: Syncing previews to production..."
        %w[templates fs.files fs.chunks].each do |col|
          sync_collection_to_production(col)
          puts "   ✓ #{col}"
        end
        puts "\n✅ Done! #{generated} PDF preview(s) generated and synced to production."
      else
        puts "\n⚠️  No previews were generated."
      end

      puts "=" * 60 + "\n"
    end

    namespace :backup do
      desc "Backup local database"
      task local: :environment do
        timestamp = Time.now.strftime("%Y%m%d_%H%M%S")
        backup_path = BACKUP_DIR.join("local_#{timestamp}")
        FileUtils.mkdir_p(backup_path)

        puts "📦 Backing up local database to #{backup_path}..."
        system("mongodump --host #{LOCAL_HOST} --db #{LOCAL_DB} --out #{backup_path}")

        if $?.success?
          puts "✅ Local backup saved to: #{backup_path}"

          # Cleanup old backups (keep last 5)
          cleanup_old_backups("local_")
        else
          puts "❌ Backup failed!"
        end
      end

      desc "Backup production database"
      task production: :environment do
        timestamp = Time.now.strftime("%Y%m%d_%H%M%S")
        backup_path = BACKUP_DIR.join("production_#{timestamp}")
        FileUtils.mkdir_p(backup_path)

        prod_uri = fetch_production_uri
        unless prod_uri
          puts "❌ Cannot fetch production URI from Heroku"
          next
        end

        puts "📦 Backing up production database to #{backup_path}..."
        system("mongodump --uri=\"#{prod_uri}\" --out #{backup_path}")

        if $?.success?
          puts "✅ Production backup saved to: #{backup_path}"
          cleanup_old_backups("production_")
        else
          puts "❌ Backup failed!"
        end
      end

      desc "List available backups"
      task list: :environment do
        puts "\n📦 AVAILABLE BACKUPS:"
        puts "-" * 50

        if BACKUP_DIR.exist?
          backups = Dir.glob(BACKUP_DIR.join("*")).sort.reverse
          if backups.any?
            backups.each do |backup|
              size = `du -sh #{backup} 2>/dev/null`.split.first || "?"
              name = File.basename(backup)
              puts "  #{name} (#{size})"
            end
          else
            puts "  No backups found."
          end
        else
          puts "  Backup directory does not exist."
        end
        puts ""
      end

      desc "Restore local from backup"
      task :restore_local, [:backup_name] => :environment do |_t, args|
        backup_name = args[:backup_name]
        unless backup_name
          puts "Usage: rake db:sync:backup:restore_local[backup_name]"
          Rake::Task["db:sync:backup:list"].invoke
          next
        end

        backup_path = BACKUP_DIR.join(backup_name, LOCAL_DB)
        unless backup_path.exist?
          puts "❌ Backup not found: #{backup_path}"
          next
        end

        unless confirm_action("restore local database from '#{backup_name}'")
          puts "Aborted."
          next
        end

        puts "📥 Restoring local database from #{backup_name}..."
        system("mongorestore --host #{LOCAL_HOST} --db #{LOCAL_DB} --drop #{backup_path}")

        puts $?.success? ? "✅ Local database restored!" : "❌ Restore failed!"
      end
    end

    # Helper methods
    def confirm_action(action)
      return true if ENV["FORCE"] == "true"

      print "\n⚠️  Are you sure you want to #{action}? (yes/no): "
      response = $stdin.gets&.strip&.downcase
      response == "yes"
    end

    def fetch_production_uri
      @production_uri ||= `heroku config:get MONGODB_URI -a valkyria 2>/dev/null`.strip
      @production_uri.empty? ? nil : @production_uri
    end

    def dump_local_database
      FileUtils.rm_rf(DUMP_DIR)
      FileUtils.mkdir_p(DUMP_DIR)

      system("mongodump --host #{LOCAL_HOST} --db #{LOCAL_DB} --out #{DUMP_DIR}")
      raise "Local dump failed!" unless $?.success?

      puts "   ✓ Local database dumped to #{DUMP_DIR}"
    end

    def dump_production_database
      FileUtils.rm_rf(DUMP_DIR)
      FileUtils.mkdir_p(DUMP_DIR)

      prod_uri = fetch_production_uri
      raise "Cannot fetch production URI!" unless prod_uri

      # Extract database name from URI
      db_name = prod_uri.match(%r{/([^/?]+)\?})&.[](1)
      raise "Cannot extract database name from URI!" unless db_name

      system("mongodump --uri=\"#{prod_uri}\" --out #{DUMP_DIR}")
      raise "Production dump failed!" unless $?.success?

      # Rename to match local db name for easier restore
      prod_dump = DUMP_DIR.join(db_name)
      local_dump = DUMP_DIR.join(LOCAL_DB)
      FileUtils.mv(prod_dump, local_dump) if prod_dump.exist? && prod_dump != local_dump

      puts "   ✓ Production database dumped to #{DUMP_DIR}"
    end

    def restore_to_production
      prod_uri = fetch_production_uri
      raise "Cannot fetch production URI!" unless prod_uri

      db_name = prod_uri.match(%r{/([^/?]+)\?})&.[](1)
      raise "Cannot extract database name from URI!" unless db_name

      dump_path = DUMP_DIR.join(LOCAL_DB)
      raise "Dump not found at #{dump_path}" unless dump_path.exist?

      system("mongorestore --uri=\"#{prod_uri}\" --nsFrom=\"#{LOCAL_DB}.*\" --nsTo=\"#{db_name}.*\" --drop #{dump_path}")
      raise "Production restore failed!" unless $?.success?

      puts "   ✓ Data restored to production"
    end

    def restore_to_local
      dump_path = DUMP_DIR.join(LOCAL_DB)
      raise "Dump not found at #{dump_path}" unless dump_path.exist?

      system("mongorestore --host #{LOCAL_HOST} --db #{LOCAL_DB} --drop #{dump_path}")
      raise "Local restore failed!" unless $?.success?

      puts "   ✓ Data restored to local"
    end

    def run_production_post_sync
      # Reset passwords for key users after sync
      puts "   Running password reset for key users..."
      system('heroku run "rails runner db/seeds/reset_password.rb" -a valkyria')
      puts "   ✓ Post-sync tasks completed"
    end

    def sync_collection_to_production(collection)
      prod_uri = fetch_production_uri
      raise "Cannot fetch production URI!" unless prod_uri

      db_name = prod_uri.match(%r{/([^/?]+)\?})&.[](1)
      temp_dir = Rails.root.join("tmp", "collection_sync")
      FileUtils.rm_rf(temp_dir)
      FileUtils.mkdir_p(temp_dir)

      # Dump specific collection
      system("mongodump --host #{LOCAL_HOST} --db #{LOCAL_DB} --collection #{collection} --out #{temp_dir}")
      raise "Collection dump failed!" unless $?.success?

      # Restore to production
      dump_path = temp_dir.join(LOCAL_DB)
      system("mongorestore --uri=\"#{prod_uri}\" --nsFrom=\"#{LOCAL_DB}.#{collection}\" --nsTo=\"#{db_name}.#{collection}\" --drop #{dump_path}")
      raise "Collection restore failed!" unless $?.success?

      FileUtils.rm_rf(temp_dir)
    end

    def sync_collection_from_production(collection)
      prod_uri = fetch_production_uri
      raise "Cannot fetch production URI!" unless prod_uri

      db_name = prod_uri.match(%r{/([^/?]+)\?})&.[](1)
      temp_dir = Rails.root.join("tmp", "collection_sync")
      FileUtils.rm_rf(temp_dir)
      FileUtils.mkdir_p(temp_dir)

      # Dump specific collection from production
      system("mongodump --uri=\"#{prod_uri}\" --collection #{collection} --out #{temp_dir}")
      raise "Collection dump failed!" unless $?.success?

      # Restore to local
      dump_path = temp_dir.join(db_name)
      system("mongorestore --host #{LOCAL_HOST} --db #{LOCAL_DB} --collection #{collection} --drop #{dump_path}/#{collection}.bson")
      raise "Collection restore failed!" unless $?.success?

      FileUtils.rm_rf(temp_dir)
    end

    def cleanup_old_backups(prefix, keep: 5)
      return unless BACKUP_DIR.exist?

      backups = Dir.glob(BACKUP_DIR.join("#{prefix}*")).sort.reverse
      return if backups.size <= keep

      backups[keep..].each do |old_backup|
        puts "   🗑️  Removing old backup: #{File.basename(old_backup)}"
        FileUtils.rm_rf(old_backup)
      end
    end
  end
end
