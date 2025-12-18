# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationPolicy do
  let(:user) { double("User", id: BSON::ObjectId.new, admin?: false, super_admin?: false) }
  let(:record) { double("Record") }
  let(:policy) { described_class.new(user, record) }

  describe "#initialize" do
    it "sets user and record" do
      expect(policy.user).to eq(user)
      expect(policy.record).to eq(record)
    end
  end

  describe "default permissions" do
    it "denies index" do
      expect(policy.index?).to be false
    end

    it "denies show" do
      expect(policy.show?).to be false
    end

    it "denies create" do
      expect(policy.create?).to be false
    end

    it "denies new (delegates to create)" do
      expect(policy.new?).to eq(policy.create?)
    end

    it "denies update" do
      expect(policy.update?).to be false
    end

    it "denies edit (delegates to update)" do
      expect(policy.edit?).to eq(policy.update?)
    end

    it "denies destroy" do
      expect(policy.destroy?).to be false
    end
  end

  describe "helper methods" do
    describe "#admin?" do
      it "returns false when user is not admin" do
        expect(policy.send(:admin?)).to be false
      end

      it "returns true when user is admin" do
        allow(user).to receive(:admin?).and_return(true)
        expect(policy.send(:admin?)).to be true
      end

      it "returns false when user is nil" do
        nil_policy = described_class.new(nil, record)
        expect(nil_policy.send(:admin?)).to be_falsey
      end
    end

    describe "#owner?" do
      context "when record has created_by_id" do
        it "returns true when user owns record" do
          allow(record).to receive(:respond_to?).with(:created_by_id).and_return(true)
          allow(record).to receive(:created_by_id).and_return(user.id)
          expect(policy.send(:owner?)).to be true
        end

        it "returns false when user does not own record" do
          allow(record).to receive(:respond_to?).with(:created_by_id).and_return(true)
          allow(record).to receive(:created_by_id).and_return(BSON::ObjectId.new)
          expect(policy.send(:owner?)).to be false
        end
      end

      context "when record does not have created_by_id" do
        it "returns false" do
          allow(record).to receive(:respond_to?).with(:created_by_id).and_return(false)
          expect(policy.send(:owner?)).to be false
        end
      end
    end

    describe "#same_organization?" do
      let(:org_id) { BSON::ObjectId.new }

      before do
        allow(user).to receive(:organization_id).and_return(org_id)
      end

      it "returns true when same organization" do
        allow(record).to receive(:respond_to?).with(:organization_id).and_return(true)
        allow(record).to receive(:organization_id).and_return(org_id)
        expect(policy.send(:same_organization?)).to be true
      end

      it "returns false when different organization" do
        allow(record).to receive(:respond_to?).with(:organization_id).and_return(true)
        allow(record).to receive(:organization_id).and_return(BSON::ObjectId.new)
        expect(policy.send(:same_organization?)).to be false
      end
    end
  end

  describe ApplicationPolicy::Scope do
    let(:scope) { double("Scope") }
    let(:policy_scope) { described_class.new(user, scope) }

    describe "#resolve" do
      it "raises NotImplementedError" do
        expect { policy_scope.resolve }
          .to raise_error(NotImplementedError, /must define #resolve/)
      end
    end
  end
end
