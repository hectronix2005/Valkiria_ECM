# frozen_string_literal: true

require "rails_helper"

RSpec.describe Hr::VacationRequest, type: :model do
  let(:organization) { create(:organization) }
  let(:employee) { create(:hr_employee, vacation_balance_days: 20.0, organization: organization) }
  let(:supervisor) { create(:hr_employee, organization: organization) }

  before do
    employee.update!(supervisor: supervisor)
  end

  describe "validations" do
    it "is valid with valid attributes" do
      request = build(:vacation_request, employee: employee, organization: organization)
      expect(request).to be_valid
    end

    it "requires employee" do
      request = build(:vacation_request, employee: nil, organization: organization)
      expect(request).not_to be_valid
      expect(request.errors[:employee]).to include("can't be blank")
    end

    it "requires start_date" do
      request = build(:vacation_request, employee: employee, organization: organization, start_date: nil)
      expect(request).not_to be_valid
    end

    it "requires end_date after start_date" do
      request = build(:vacation_request,
                      employee: employee,
                      organization: organization,
                      start_date: 1.week.from_now,
                      end_date: 1.day.from_now)
      expect(request).not_to be_valid
      expect(request.errors[:end_date]).to include("must be after or equal to start date")
    end

    it "prevents start_date in the past" do
      request = build(:vacation_request,
                      employee: employee,
                      organization: organization,
                      start_date: 1.day.ago,
                      end_date: Date.current)
      expect(request).not_to be_valid
      expect(request.errors[:start_date]).to include("cannot be in the past")
    end

    it "validates sufficient balance for vacation type" do
      # Employee with recent hire_date has ~2 days accrued (50 days / 365.25 * 15 ≈ 2.05)
      low_balance = create(:hr_employee, hire_date: 50.days.ago, organization: organization)
      request = build(:vacation_request,
                      employee: low_balance,
                      organization: organization,
                      days_requested: 5.0)
      expect(request).not_to be_valid
      expect(request.errors[:days_requested]).to include("exceeds available vacation balance")
    end

    it "does not require balance for sick leave" do
      # Employee with no accrued days (hired today)
      low_balance = create(:hr_employee, hire_date: Date.current, organization: organization)
      request = build(:vacation_request, :sick_leave,
                      employee: low_balance,
                      organization: organization)
      expect(request).to be_valid
    end
  end

  describe "callbacks" do
    it "generates request number on create" do
      request = create(:vacation_request, employee: employee, organization: organization)
      expect(request.request_number).to match(/\AVAC-\d{4}-\d{5}\z/)
    end

    it "creates audit event on create" do
      expect do
        create(:vacation_request, employee: employee, organization: organization)
      end.to change { Audit::AuditEvent.where(action: "vacation_request_created").count }.by(1)
    end
  end

  describe "#submit!" do
    let(:request) { create(:vacation_request, employee: employee, organization: organization) }

    it "changes status to pending" do
      request.submit!(actor: employee)
      expect(request.status).to eq(Hr::VacationRequest::STATUS_PENDING)
    end

    it "sets submitted_at" do
      request.submit!(actor: employee)
      expect(request.submitted_at).to be_present
    end

    it "assigns approver (supervisor)" do
      request.submit!(actor: employee)
      expect(request.approver).to eq(supervisor)
    end

    it "raises error if not draft" do
      request.submit!(actor: employee)
      expect { request.submit!(actor: employee) }
        .to raise_error(Hr::VacationRequest::InvalidStateError)
    end

    it "creates audit event" do
      expect { request.submit!(actor: employee) }
        .to change { Audit::AuditEvent.where(action: "vacation_request_submitted").count }.by(1)
    end
  end

  describe "#approve!" do
    let(:request) do
      create(:vacation_request, :pending,
             employee: employee,
             approver: supervisor,
             organization: organization)
    end

    it "changes status to approved" do
      request.approve!(actor: supervisor)
      expect(request.status).to eq(Hr::VacationRequest::STATUS_APPROVED)
    end

    it "deducts vacation balance" do
      expect { request.approve!(actor: supervisor) }
        .to change { employee.reload.vacation_balance_days }.by(-5.0)
    end

    it "records approver name" do
      request.approve!(actor: supervisor)
      expect(request.approved_by_name).to eq(supervisor.full_name)
    end

    it "raises error if not pending" do
      request.approve!(actor: supervisor)
      expect { request.approve!(actor: supervisor) }
        .to raise_error(Hr::VacationRequest::InvalidStateError)
    end

    it "raises error if not authorized" do
      other_employee = create(:hr_employee, organization: organization)
      expect { request.approve!(actor: other_employee) }
        .to raise_error(Hr::VacationRequest::AuthorizationError)
    end

    it "creates audit event" do
      expect { request.approve!(actor: supervisor) }
        .to change { Audit::AuditEvent.where(action: "vacation_request_approved").count }.by(1)
    end
  end

  describe "#reject!" do
    let(:request) do
      create(:vacation_request, :pending,
             employee: employee,
             approver: supervisor,
             organization: organization)
    end

    it "changes status to rejected" do
      request.reject!(actor: supervisor, reason: "Busy period")
      expect(request.status).to eq(Hr::VacationRequest::STATUS_REJECTED)
    end

    it "does not deduct vacation balance" do
      expect { request.reject!(actor: supervisor, reason: "Busy period") }
        .not_to(change { employee.reload.vacation_balance_days })
    end

    it "requires reason" do
      expect { request.reject!(actor: supervisor, reason: "") }
        .to raise_error(Hr::VacationRequest::ValidationError)
    end

    it "creates audit event" do
      expect { request.reject!(actor: supervisor, reason: "Busy period") }
        .to change { Audit::AuditEvent.where(action: "vacation_request_rejected").count }.by(1)
    end
  end

  describe "#cancel!" do
    context "when pending" do
      let(:request) do
        create(:vacation_request, :pending,
               employee: employee,
               organization: organization)
      end

      it "changes status to cancelled" do
        request.cancel!(actor: employee)
        expect(request.status).to eq(Hr::VacationRequest::STATUS_CANCELLED)
      end

      it "does not affect balance" do
        expect { request.cancel!(actor: employee) }
          .not_to(change { employee.reload.vacation_balance_days })
      end
    end

    context "when approved" do
      let(:request) do
        create(:vacation_request, :approved,
               employee: employee,
               organization: organization,
               days_requested: 5.0)
      end

      before do
        # Simulate the deduction that happened when approved
        employee.update!(vacation_balance_days: 15.0, vacation_used_ytd: 5.0)
      end

      it "restores vacation balance" do
        expect { request.cancel!(actor: employee) }
          .to change { employee.reload.vacation_balance_days }.by(5.0)
      end
    end

    context "when rejected" do
      let(:request) do
        create(:vacation_request, :rejected,
               employee: employee,
               organization: organization)
      end

      it "raises error" do
        expect { request.cancel!(actor: employee) }
          .to raise_error(Hr::VacationRequest::InvalidStateError)
      end
    end
  end

  describe "#can_approve?" do
    let(:request) do
      create(:vacation_request, :pending,
             employee: employee,
             approver: supervisor,
             organization: organization)
    end

    it "returns true for supervisor" do
      expect(request.can_approve?(supervisor)).to be true
    end

    it "returns true for HR manager" do
      hr_manager = create(:hr_employee, :hr_manager, organization: organization)
      expect(request.can_approve?(hr_manager)).to be true
    end

    it "returns false for regular employee" do
      other = create(:hr_employee, organization: organization)
      expect(request.can_approve?(other)).to be false
    end

    it "returns false for the requester" do
      expect(request.can_approve?(employee)).to be false
    end
  end

  describe "#can_view?" do
    let(:request) { create(:vacation_request, employee: employee, organization: organization) }

    it "returns true for the employee" do
      expect(request.can_view?(employee)).to be true
    end

    it "returns true for the supervisor" do
      expect(request.can_view?(supervisor)).to be true
    end

    it "returns true for HR staff" do
      hr = create(:hr_employee, :hr_staff, organization: organization)
      expect(request.can_view?(hr)).to be true
    end

    it "returns false for unrelated employee" do
      other = create(:hr_employee, organization: organization)
      expect(request.can_view?(other)).to be false
    end
  end

  describe "scopes" do
    let!(:pending) { create(:vacation_request, :pending, employee: employee, organization: organization) }
    let!(:approved) { create(:vacation_request, :approved, employee: employee, organization: organization) }
    let!(:rejected) { create(:vacation_request, :rejected, employee: employee, organization: organization) }

    it ".pending returns pending requests" do
      expect(described_class.pending).to include(pending)
      expect(described_class.pending).not_to include(approved, rejected)
    end

    it ".approved returns approved requests" do
      expect(described_class.approved).to include(approved)
    end

    it ".for_approval_by returns requests pending for specific approver" do
      pending.update!(approver: supervisor)
      expect(described_class.for_approval_by(supervisor)).to include(pending)
    end
  end

  describe "#business_days" do
    it "calculates correct business days excluding weekends" do
      # Monday to Friday = 5 business days
      monday = Date.current.beginning_of_week
      friday = monday + 4.days

      request = build(:vacation_request,
                      employee: employee,
                      organization: organization,
                      start_date: monday,
                      end_date: friday,
                      days_requested: nil)

      expect(request.business_days).to eq(5)
    end
  end
end
