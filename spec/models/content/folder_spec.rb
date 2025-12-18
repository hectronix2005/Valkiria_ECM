# frozen_string_literal: true

require "rails_helper"

RSpec.describe Content::Folder do
  describe "validations" do
    subject { build(:content_folder) }

    it { is_expected.to be_valid }

    it "validates presence of name" do
      folder = build(:content_folder, name: nil)
      expect(folder).not_to be_valid
      expect(folder.errors[:name]).to include("can't be blank")
    end

    it "validates name length" do
      folder = build(:content_folder, name: "a" * 256)
      expect(folder).not_to be_valid
      expect(folder.errors[:name]).to include("is too long (maximum is 255 characters)")
    end

    it "validates name does not contain slashes" do
      folder = build(:content_folder, name: "invalid/name")
      expect(folder).not_to be_valid
      expect(folder.errors[:name]).to include("cannot contain slashes")
    end

    it "validates path uniqueness within organization" do
      org = create(:organization)
      create(:content_folder, name: "Test", organization: org)
      duplicate = build(:content_folder, name: "Test", organization: org)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:path]).to include("has already been taken")
    end

    it "validates parent is not self" do
      folder = create(:content_folder)
      folder.parent_id = folder.id
      expect(folder).not_to be_valid
      expect(folder.errors[:parent_id]).to include("cannot be self")
    end

    it "validates max depth" do
      # Create folders up to max depth
      parent = create(:content_folder)
      current = parent
      (Content::Folder::MAX_DEPTH - 1).times do
        current = create(:content_folder, parent: current)
      end

      # Try to create one more level - should fail
      too_deep = build(:content_folder, parent: current)
      expect(too_deep).not_to be_valid
      expect(too_deep.errors[:parent_id]).to include("maximum folder depth (#{Content::Folder::MAX_DEPTH}) exceeded")
    end
  end

  describe "indexes" do
    it { is_expected.to have_index_for(uuid: 1).with_options(unique: true) }
    it { is_expected.to have_index_for(name: 1) }
    it { is_expected.to have_index_for(path: 1).with_options(unique: true) }
    it { is_expected.to have_index_for(parent_id: 1) }
    it { is_expected.to have_index_for(organization_id: 1) }
    it { is_expected.to have_index_for(depth: 1) }
  end

  describe "associations" do
    let(:folder) { create(:content_folder) }

    it "can have a parent folder" do
      parent = create(:content_folder, name: "Parent")
      child = create(:content_folder, name: "Child", parent: parent)
      expect(child.parent).to eq(parent)
    end

    it "has many children folders" do
      child1 = create(:content_folder, name: "Child 1", parent: folder)
      child2 = create(:content_folder, name: "Child 2", parent: folder)
      expect(folder.children).to include(child1, child2)
    end

    it "has many documents" do
      doc = create(:content_document, folder: folder)
      expect(folder.documents).to include(doc)
    end

    it "can belong to organization" do
      org = create(:organization)
      folder.organization = org
      folder.save!
      expect(folder.reload.organization).to eq(org)
    end
  end

  describe "path building" do
    it "builds root path for folders without parent" do
      folder = create(:content_folder, name: "Root Folder")
      expect(folder.path).to eq("/Root Folder")
      expect(folder.depth).to eq(0)
    end

    it "builds nested path for child folders" do
      parent = create(:content_folder, name: "Parent")
      child = create(:content_folder, name: "Child", parent: parent)

      expect(child.path).to eq("/Parent/Child")
      expect(child.depth).to eq(1)
    end

    it "updates path when parent changes" do
      parent1 = create(:content_folder, name: "Parent1")
      parent2 = create(:content_folder, name: "Parent2")
      child = create(:content_folder, name: "Child", parent: parent1)

      expect(child.path).to eq("/Parent1/Child")

      child.update!(parent: parent2)
      expect(child.reload.path).to eq("/Parent2/Child")
    end
  end

  describe "#ancestors" do
    it "returns empty array for root folder" do
      folder = create(:content_folder)
      expect(folder.ancestors).to eq([])
    end

    it "returns all ancestors in order" do
      grandparent = create(:content_folder, name: "Grandparent")
      parent = create(:content_folder, name: "Parent", parent: grandparent)
      child = create(:content_folder, name: "Child", parent: parent)

      expect(child.ancestors).to eq([grandparent, parent])
    end
  end

  describe "#descendants" do
    it "returns all descendants recursively" do
      root = create(:content_folder, name: "Root")
      child1 = create(:content_folder, name: "Child1", parent: root)
      child2 = create(:content_folder, name: "Child2", parent: root)
      grandchild = create(:content_folder, name: "Grandchild", parent: child1)

      descendants = root.descendants
      expect(descendants).to include(child1, child2, grandchild)
      expect(descendants.size).to eq(3)
    end
  end

  describe "#move_to" do
    it "moves folder to new parent" do
      parent1 = create(:content_folder, name: "Parent1")
      parent2 = create(:content_folder, name: "Parent2")
      child = create(:content_folder, name: "Child", parent: parent1)

      result = child.move_to(parent2)
      expect(result).to be true
      expect(child.reload.parent).to eq(parent2)
      expect(child.path).to eq("/Parent2/Child")
    end

    it "prevents moving folder to itself" do
      folder = create(:content_folder)
      result = folder.move_to(folder)
      expect(result).to be false
    end

    it "prevents moving folder to its own descendant" do
      parent = create(:content_folder, name: "Parent")
      child = create(:content_folder, name: "Child", parent: parent)
      grandchild = create(:content_folder, name: "Grandchild", parent: child)

      result = parent.move_to(grandchild)
      expect(result).to be false
    end
  end

  describe "#document_count" do
    it "counts documents in folder" do
      folder = create(:content_folder)
      create_list(:content_document, 3, folder: folder)

      expect(folder.document_count).to eq(3)
    end

    it "counts documents including descendants" do
      parent = create(:content_folder)
      child = create(:content_folder, parent: parent)
      create_list(:content_document, 2, folder: parent)
      create_list(:content_document, 3, folder: child)

      expect(parent.document_count(include_descendants: true)).to eq(5)
    end
  end

  describe "scopes" do
    it ".root_folders returns only root folders" do
      root = create(:content_folder)
      create(:content_folder, parent: root)

      expect(described_class.root_folders).to eq([root])
    end

    it ".by_organization filters by organization" do
      org1 = create(:organization)
      org2 = create(:organization)
      folder1 = create(:content_folder, organization: org1)
      create(:content_folder, organization: org2)

      expect(described_class.by_organization(org1.id)).to eq([folder1])
    end
  end
end
