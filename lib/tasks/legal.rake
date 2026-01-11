# frozen_string_literal: true

namespace :legal do
  namespace :contracts do
    desc "Reset signature status to pending for a specific contract"
    task :reset_signatures, [:contract_number] => :environment do |_t, args|
      contract_number = args[:contract_number]

      unless contract_number
        puts "Usage: bundle exec rake legal:contracts:reset_signatures[CON-2026-00008]"
        exit 1
      end

      contract = Legal::Contract.find_by(contract_number: contract_number)
      unless contract
        puts "Contract #{contract_number} not found"
        exit 1
      end

      puts "Found contract: #{contract.title}"
      puts "Current status: #{contract.status}"

      doc = contract.generated_document
      unless doc
        puts "Contract has no generated document"
        exit 1
      end

      puts "\nDocument signatures before reset:"
      doc.signatures.each do |sig|
        puts "  - #{sig['signatory_label']}: #{sig['status']} (#{sig['user_name']})"
      end

      # Reset all signatures to pending
      doc.signatures.each do |sig|
        sig["status"] = "pending"
        sig["signed_at"] = nil
        sig["signed_by_name"] = nil
        sig["signature_id"] = nil
      end
      doc.status = Templates::GeneratedDocument::PENDING_SIGNATURES
      doc.save!

      puts "\nDocument signatures after reset:"
      doc.signatures.each do |sig|
        puts "  - #{sig['signatory_label']}: #{sig['status']} (#{sig['user_name']})"
      end

      # If contract was in pending_signatures but all signatures are now pending,
      # and approvals aren't complete, revert to pending_approval
      if contract.pending_signatures?
        all_approvals_complete = contract.approvals.all?(&:approved?)
        unless all_approvals_complete
          contract.status = "pending_approval"
          # Find next pending approver
          pending_approval = contract.approvals.find(&:pending?)
          contract.current_approver_role = pending_approval&.role
          contract.save!
          puts "\nContract reverted to pending_approval (next approver: #{contract.current_approver_role})"
        else
          puts "\nContract remains in pending_signatures (all approvals are complete)"
        end
      end

      puts "\nDone! Contract #{contract_number} signatures have been reset."
    end

    desc "Show contract status and signatures"
    task :show, [:contract_number] => :environment do |_t, args|
      contract_number = args[:contract_number]

      unless contract_number
        puts "Usage: bundle exec rake legal:contracts:show[CON-2026-00008]"
        exit 1
      end

      contract = Legal::Contract.find_by(contract_number: contract_number)
      unless contract
        puts "Contract #{contract_number} not found"
        exit 1
      end

      puts "=" * 60
      puts "CONTRACT: #{contract.contract_number}"
      puts "=" * 60
      puts "Title: #{contract.title}"
      puts "Type: #{contract.type_label}"
      puts "Status: #{contract.status} (#{contract.status_label})"
      puts "Amount: #{contract.currency} #{contract.amount}"
      puts "Third Party: #{contract.third_party&.display_name}"
      puts "Requested By: #{contract.requested_by&.full_name}"
      puts "Approval Level: #{contract.approval_level_label}"
      puts "Current Approver: #{contract.current_approver_role || 'N/A'}"

      puts "\n--- APPROVALS ---"
      contract.approvals.order(order: :asc).each do |a|
        status_symbol = case a.status
                        when "approved" then "✓"
                        when "rejected" then "✗"
                        else "○"
                        end
        puts "#{status_symbol} #{a.role_label} (#{a.role}): #{a.status}"
        puts "    Decided by: #{a.approver_name}" if a.approver_name
        puts "    At: #{a.decided_at}" if a.decided_at
      end

      doc = contract.generated_document
      if doc
        puts "\n--- DOCUMENT SIGNATURES ---"
        puts "Document status: #{doc.status}"
        doc.signatures.each do |sig|
          status_symbol = sig["status"] == "signed" ? "✓" : "○"
          puts "#{status_symbol} #{sig['signatory_label']}: #{sig['status']}"
          puts "    User: #{sig['user_name']}"
          if sig["signed_at"]
            puts "    Signed at: #{sig['signed_at']}"
            puts "    Signed by: #{sig['signed_by_name']}"
          end
        end
      else
        puts "\n--- NO DOCUMENT ---"
      end

      puts "\n--- HISTORY (last 10) ---"
      contract.history.last(10).each do |h|
        puts "#{h['timestamp']}: #{h['action']} by #{h['actor_name'] || 'system'}"
        puts "    #{h['details'].inspect}" if h['details'].present?
      end
      puts "=" * 60
    end
  end
end
