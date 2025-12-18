# frozen_string_literal: true

require "rails_helper"

RSpec.describe Hr::Employee, type: :model do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }

  describe "validations" do
    it "is valid with valid attributes" do
      employee = build(:hr_employee, user: user, organization: organization)
      expect(employee).to be_valid
    end

    it "requires user" do
      employee = build(:hr_employee, user: nil, organization: organization)
      expect(employee).not_to be_valid
      expect(employee.errors[:user]).to include("can't be blank")
    end

    it "requires organization" do
      employee = build(:hr_employee, user: user, organization: nil)
      expect(employee).not_to be_valid
      expect(employee.errors[:organization]).to include("can't be blank")
    end

    it "requires unique user_id" do
      create(:hr_employee, user: user, organization: organization)
      duplicate = build(:hr_employee, user: user, organization: organization)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:user_id]).to include("has already been taken")
    end

    it "requires valid employment_status" do
      employee = build(:hr_employee, user: user, organization: organization, employment_status: "invalid")
      expect(employee).not_to be_valid
    end

    it "requires non-negative vacation_balance_days" do
      employee = build(:hr_employee, user: user, organization: organization, vacation_balance_days: -1)
      expect(employee).not_to be_valid
    end
  end

  describe "associations" do
    it "belongs to user" do
      employee = create(:hr_employee, user: user, organization: organization)
      expect(employee.user).to eq(user)
    end

    it "can have a supervisor" do
      supervisor = create(:hr_employee, organization: organization)
      employee = create(:hr_employee, supervisor: supervisor, organization: organization)
      expect(employee.supervisor).to eq(supervisor)
    end

    it "has many subordinates" do
      supervisor = create(:hr_employee, organization: organization)
      subordinate1 = create(:hr_employee, supervisor: supervisor, organization: organization)
      subordinate2 = create(:hr_employee, supervisor: supervisor, organization: organization)

      expect(supervisor.subordinates).to include(subordinate1, subordinate2)
    end
  end

  describe "#supervisor?" do
    it "returns true if has active subordinates" do
      supervisor = create(:hr_employee, organization: organization)
      create(:hr_employee, supervisor: supervisor, organization: organization)

      expect(supervisor.supervisor?).to be true
    end

    it "returns false if no subordinates" do
      employee = create(:hr_employee, organization: organization)
      expect(employee.supervisor?).to be false
    end
  end

  describe "#supervises?" do
    let(:supervisor) { create(:hr_employee, organization: organization) }
    let(:subordinate) { create(:hr_employee, supervisor: supervisor, organization: organization) }
    let(:other) { create(:hr_employee, organization: organization) }

    it "returns true for direct reports" do
      expect(supervisor.supervises?(subordinate)).to be true
    end

    it "returns false for non-reports" do
      expect(supervisor.supervises?(other)).to be false
    end
  end

  describe "vacation balance management" do
    let(:employee) { create(:hr_employee, vacation_balance_days: 15.0, organization: organization) }

    describe "#has_vacation_balance?" do
      it "returns true if has sufficient balance" do
        expect(employee.has_vacation_balance?(10)).to be true
      end

      it "returns false if insufficient balance" do
        expect(employee.has_vacation_balance?(20)).to be false
      end
    end

    describe "#deduct_vacation!" do
      it "deducts days from balance" do
        expect { employee.deduct_vacation!(5) }
          .to change(employee, :vacation_balance_days).from(15.0).to(10.0)
      end

      it "tracks used YTD" do
        expect { employee.deduct_vacation!(5) }
          .to change(employee, :vacation_used_ytd).by(5)
      end

      it "raises error if insufficient balance" do
        expect { employee.deduct_vacation!(20) }
          .to raise_error(Hr::Employee::InsufficientBalanceError)
      end
    end

    describe "#restore_vacation!" do
      before { employee.update!(vacation_used_ytd: 5) }

      it "restores days to balance" do
        expect { employee.restore_vacation!(5) }
          .to change(employee, :vacation_balance_days).by(5)
      end
    end

    describe "#accrue_vacation!" do
      it "adds days to balance and tracks accrued" do
        expect { employee.accrue_vacation!(1.25) }
          .to change(employee, :vacation_balance_days).by(1.25)
          .and change(employee, :vacation_accrued_ytd).by(1.25)
      end
    end
  end

  describe "#supervisor_chain" do
    it "returns chain of supervisors" do
      ceo = create(:hr_employee, organization: organization)
      vp = create(:hr_employee, supervisor: ceo, organization: organization)
      manager = create(:hr_employee, supervisor: vp, organization: organization)
      employee = create(:hr_employee, supervisor: manager, organization: organization)

      expect(employee.supervisor_chain).to eq([manager, vp, ceo])
    end
  end

  describe ".for_user" do
    it "finds employee by user" do
      employee = create(:hr_employee, user: user, organization: organization)
      expect(described_class.for_user(user)).to eq(employee)
    end
  end

  describe ".find_or_create_for_user!" do
    it "finds existing employee" do
      existing = create(:hr_employee, user: user, organization: organization)
      found = described_class.find_or_create_for_user!(user)
      expect(found).to eq(existing)
    end

    it "creates new employee if not exists" do
      expect { described_class.find_or_create_for_user!(user) }
        .to change(described_class, :count).by(1)
    end
  end
end
