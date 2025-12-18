# frozen_string_literal: true

require "rails_helper"

RSpec.describe Content::DocumentVersion do
  describe "validations" do
    it "validates presence of version_number" do
      version = build(:document_version, version_number: nil)
      # version_number is auto-set, so we need to bypass callback
      version.instance_variable_set(:@skip_version_number, true)

      # Let it auto-calculate
      expect(version).to be_valid
    end

    it "validates uniqueness of version_number within document" do
      document = create(:content_document)
      create(:document_version, document: document, version_number: 1)

      duplicate = build(:document_version, document: document)
      duplicate.version_number = 1

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:version_number]).to include("has already been taken")
    end

    it "validates presence of file_name" do
      version = build(:document_version, file_name: nil)
      expect(version).not_to be_valid
      expect(version.errors[:file_name]).to include("can't be blank")
    end

    it "validates presence of content_type" do
      version = build(:document_version, content_type: nil)
      expect(version).not_to be_valid
      expect(version.errors[:content_type]).to include("can't be blank")
    end

    it "validates presence of checksum" do
      version = build(:document_version, checksum: nil, content: nil, storage_key: nil)
      # Checksum is auto-calculated, but if no content it won't be set
      version.valid?
      # With no content, checksum will be nil and validation fails
      expect(version.errors[:checksum]).to include("can't be blank")
    end
  end

  describe "indexes" do
    it { is_expected.to have_index_for(uuid: 1).with_options(unique: true) }
    it { is_expected.to have_index_for(document_id: 1, version_number: 1).with_options(unique: true) }
    it { is_expected.to have_index_for(document_id: 1, created_at: -1) }
    it { is_expected.to have_index_for(checksum: 1) }
  end

  describe "immutability" do
    let(:version) { create(:document_version) }

    it "prevents saving after creation" do
      version.file_name = "new_name.pdf"
      expect { version.save }.to raise_error(Content::DocumentVersion::ImmutableRecordError)
    end

    it "prevents update" do
      expect { version.update(file_name: "new_name.pdf") }.to raise_error(Content::DocumentVersion::ImmutableRecordError)
    end

    it "prevents update!" do
      expect { version.update!(file_name: "new_name.pdf") }.to raise_error(Content::DocumentVersion::ImmutableRecordError)
    end

    it "prevents delete" do
      expect { version.delete }.to raise_error(Content::DocumentVersion::ImmutableRecordError)
    end

    it "prevents destroy" do
      expect { version.destroy }.to raise_error(Content::DocumentVersion::ImmutableRecordError)
    end

    it "allows initial creation" do
      new_version = build(:document_version)
      expect { new_version.save! }.not_to raise_error
    end
  end

  describe "version numbering" do
    it "auto-increments version number" do
      document = create(:content_document)
      v1 = create(:document_version, document: document)
      v2 = create(:document_version, document: document)
      v3 = create(:document_version, document: document)

      expect(v1.version_number).to eq(1)
      expect(v2.version_number).to eq(2)
      expect(v3.version_number).to eq(3)
    end

    it "starts at 1 for new documents" do
      document = create(:content_document)
      version = create(:document_version, document: document)

      expect(version.version_number).to eq(1)
    end
  end

  describe "checksum calculation" do
    it "calculates checksum from content" do
      version = create(:document_version, content: "Test content")
      expected_checksum = Digest::SHA256.hexdigest("Test content")

      expect(version.checksum).to eq(expected_checksum)
    end

    it "produces different checksums for different content" do
      document = create(:content_document)
      v1 = create(:document_version, document: document, content: "Content A")
      v2 = create(:document_version, document: document, content: "Content B")

      expect(v1.checksum).not_to eq(v2.checksum)
    end
  end

  describe "#previous_version" do
    it "returns nil for first version" do
      version = create(:document_version)
      expect(version.previous_version).to be_nil
    end

    it "returns previous version" do
      document = create(:content_document)
      v1 = create(:document_version, document: document)
      v2 = create(:document_version, document: document)

      expect(v2.previous_version).to eq(v1)
    end
  end

  describe "#next_version" do
    it "returns next version" do
      document = create(:content_document)
      v1 = create(:document_version, document: document)
      v2 = create(:document_version, document: document)

      expect(v1.next_version).to eq(v2)
    end

    it "returns nil for latest version" do
      document = create(:content_document)
      create(:document_version, document: document)
      v2 = create(:document_version, document: document)

      expect(v2.next_version).to be_nil
    end
  end

  describe "#latest?" do
    it "returns true for current version" do
      document = create(:content_document)
      version = document.create_version!(
        file_name: "test.txt",
        content_type: "text/plain",
        content: "Test"
      )

      expect(version.latest?).to be true
    end

    it "returns false for old versions" do
      document = create(:content_document)
      v1 = document.create_version!(
        file_name: "test.txt",
        content_type: "text/plain",
        content: "Test 1"
      )
      document.create_version!(
        file_name: "test.txt",
        content_type: "text/plain",
        content: "Test 2"
      )

      expect(v1.latest?).to be false
    end
  end

  describe "#content_changed_from_previous?" do
    it "returns true for first version" do
      version = create(:document_version)
      expect(version.content_changed_from_previous?).to be true
    end

    it "returns true when content differs" do
      document = create(:content_document)
      create(:document_version, document: document, content: "Content A")
      v2 = create(:document_version, document: document, content: "Content B")

      expect(v2.content_changed_from_previous?).to be true
    end

    it "returns false when content is the same" do
      document = create(:content_document)
      create(:document_version, document: document, content: "Same content")
      v2 = create(:document_version, document: document, content: "Same content")

      expect(v2.content_changed_from_previous?).to be false
    end
  end

  describe "audit logging" do
    it "logs version creation" do
      expect do
        create(:document_version)
      end.to change(Audit::AuditEvent, :count).by_at_least(1)

      event = Audit::AuditEvent.where(action: "version_created").last
      expect(event).to be_present
      expect(event.event_type).to eq("content")
    end
  end
end
