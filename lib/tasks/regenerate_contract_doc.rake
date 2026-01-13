# frozen_string_literal: true

namespace :contracts do
  desc "Regenerate document for a contract by UUID"
  task :regenerate_document, [:uuid] => :environment do |_t, args|
    uuid = args[:uuid]
    abort "Please provide a contract UUID" if uuid.blank?

    contract = Legal::Contract.find_by(uuid: uuid)
    abort "Contract not found: #{uuid}" unless contract

    template = Templates::Template.find_by(uuid: contract.template_id)
    abort "Template not found: #{contract.template_id}" unless template

    puts "Contract: #{contract.title}"
    puts "Template: #{template.name}"

    context = {
      third_party: contract.third_party,
      contract: contract,
      organization: contract.organization,
      user: contract.requested_by
    }

    puts "Generating document..."
    service = Templates::RobustDocumentGeneratorService.new(template, context)
    doc = service.generate!

    puts "Document UUID: #{doc.uuid}"
    puts "Draft file ID: #{doc.draft_file_id}"
    puts "Original draft file ID: #{doc.original_draft_file_id}"
    puts "Status: #{doc.status}"

    contract.update!(document_uuid: doc.uuid)
    puts "Contract updated with new document"

    if template.signatories.any?
      doc.initialize_signatures!
      puts "Signatures initialized"
    end

    puts "DONE!"
  end
end
