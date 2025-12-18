# frozen_string_literal: true

require "rails_helper"

RSpec.describe "HR Permissions E2E", type: :feature do
  let(:organization) { create(:organization) }

  # Create role hierarchy
  let!(:regular_employee) { create(:hr_employee, organization: organization, job_title: "Developer") }
  let!(:supervisor) { create(:hr_employee, organization: organization, job_title: "Team Lead") }
  let!(:hr_staff) { create(:hr_employee, :hr_staff, organization: organization) }
  let!(:hr_manager) { create(:hr_employee, :hr_manager, organization: organization) }

  before do
    # Set up hierarchy
    regular_employee.update!(supervisor: supervisor)
  end

  describe "Employee permissions" do
    let(:service) { Hr::HrService.new(actor: regular_employee.user, organization: organization) }

    describe "vacation requests" do
      it "can create their own vacation request" do
        request = service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 4.days
        )

        expect(request).to be_persisted
        expect(request.employee).to eq(regular_employee)
      end

      it "can submit their own vacation request" do
        request = service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 4.days
        )

        service.submit_vacation_request(request)
        expect(request.reload.status).to eq(Hr::VacationRequest::STATUS_PENDING)
      end

      it "can view their own requests" do
        request = create(:vacation_request, employee: regular_employee, organization: organization)
        expect(request.can_view?(regular_employee)).to be true
      end

      it "cannot view other employees' requests" do
        other_employee = create(:hr_employee, organization: organization)
        other_request = create(:vacation_request, employee: other_employee, organization: organization)

        expect(other_request.can_view?(regular_employee)).to be false
      end

      it "cannot approve any requests" do
        request = create(:vacation_request, :pending, employee: regular_employee, organization: organization)
        expect(request.can_approve?(regular_employee)).to be false
      end

      it "can cancel their own draft request" do
        request = service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 4.days
        )

        expect { service.cancel_vacation_request(request) }.not_to raise_error
      end

      it "can cancel their own pending request" do
        request = service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 4.days
        )
        service.submit_vacation_request(request)

        expect { service.cancel_vacation_request(request) }.not_to raise_error
      end

      it "cannot cancel other employees' requests" do
        other_employee = create(:hr_employee, organization: organization)
        other_request = create(:vacation_request, :pending, employee: other_employee, organization: organization)

        expect { service.cancel_vacation_request(other_request) }
          .to raise_error(Hr::HrService::AuthorizationError)
      end
    end

    describe "certification requests" do
      it "can create their own certification request" do
        request = service.create_certification_request(
          certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT,
          purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK
        )

        expect(request).to be_persisted
        expect(request.employee).to eq(regular_employee)
      end

      it "can cancel their own pending request" do
        request = service.create_certification_request(
          certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT,
          purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK
        )

        expect { service.cancel_certification_request(request) }.not_to raise_error
      end

      it "cannot process certification requests" do
        request = create(:certification_request, employee: regular_employee, organization: organization)

        expect { service.process_certification_request(request) }
          .to raise_error(Hr::HrService::AuthorizationError)
      end

      it "cannot view pending certifications list" do
        expect { service.pending_certifications }
          .to raise_error(Hr::HrService::AuthorizationError)
      end
    end
  end

  describe "Supervisor permissions" do
    let(:service) { Hr::HrService.new(actor: supervisor.user, organization: organization) }

    describe "vacation requests" do
      it "can view subordinate's requests" do
        request = create(:vacation_request, employee: regular_employee, organization: organization)
        expect(request.can_view?(supervisor)).to be true
      end

      it "can approve subordinate's vacation request" do
        request = create(:vacation_request, :pending,
                         employee: regular_employee,
                         approver: supervisor,
                         organization: organization)

        service.approve_vacation_request(request, reason: "Approved")
        expect(request.reload.status).to eq(Hr::VacationRequest::STATUS_APPROVED)
      end

      it "can reject subordinate's vacation request" do
        request = create(:vacation_request, :pending,
                         employee: regular_employee,
                         approver: supervisor,
                         organization: organization)

        service.reject_vacation_request(request, reason: "Team too busy")
        expect(request.reload.status).to eq(Hr::VacationRequest::STATUS_REJECTED)
      end

      it "cannot approve non-subordinate's requests" do
        other_employee = create(:hr_employee, organization: organization)
        other_request = create(:vacation_request, :pending, employee: other_employee, organization: organization)

        expect { service.approve_vacation_request(other_request) }
          .to raise_error(Hr::HrService::AuthorizationError)
      end

      it "sees subordinate requests in pending_approvals" do
        request = create(:vacation_request, :pending,
                         employee: regular_employee,
                         approver: supervisor,
                         organization: organization)

        expect(service.pending_approvals).to include(request)
      end

      it "does not see non-subordinate requests in pending_approvals" do
        other_employee = create(:hr_employee, organization: organization)
        other_request = create(:vacation_request, :pending, employee: other_employee, organization: organization)

        expect(service.pending_approvals).not_to include(other_request)
      end
    end

    describe "certification requests" do
      it "can view subordinate's certification requests" do
        request = create(:certification_request, employee: regular_employee, organization: organization)
        expect(request.can_view?(supervisor)).to be true
      end

      it "cannot process certification requests (not HR)" do
        expect(supervisor.hr_staff?).to be false

        request = create(:certification_request, employee: regular_employee, organization: organization)
        expect { service.process_certification_request(request) }
          .to raise_error(Hr::HrService::AuthorizationError)
      end
    end
  end

  describe "HR Staff permissions" do
    let(:service) { Hr::HrService.new(actor: hr_staff.user, organization: organization) }

    describe "vacation requests" do
      it "can view all vacation requests in organization" do
        request = create(:vacation_request, employee: regular_employee, organization: organization)
        expect(request.can_view?(hr_staff)).to be true
      end

      it "can approve requests when employee has no supervisor" do
        no_supervisor_employee = create(:hr_employee, organization: organization, supervisor: nil)
        request = create(:vacation_request, :pending,
                         employee: no_supervisor_employee,
                         organization: organization)

        expect(request.can_approve?(hr_staff)).to be true
      end
    end

    describe "certification requests" do
      it "can view all certification requests" do
        request = create(:certification_request, employee: regular_employee, organization: organization)
        expect(request.can_view?(hr_staff)).to be true
      end

      it "can start processing certification requests" do
        request = create(:certification_request, employee: regular_employee, organization: organization)
        service.process_certification_request(request)

        expect(request.reload.status).to eq(Hr::EmploymentCertificationRequest::STATUS_PROCESSING)
        expect(request.processed_by).to eq(hr_staff)
      end

      it "can complete certification requests" do
        request = create(:certification_request, :processing,
                         employee: regular_employee,
                         processed_by: hr_staff,
                         organization: organization)

        service.complete_certification_request(request, document_uuid: SecureRandom.uuid)
        expect(request.reload.status).to eq(Hr::EmploymentCertificationRequest::STATUS_COMPLETED)
      end

      it "can reject certification requests" do
        request = create(:certification_request, employee: regular_employee, organization: organization)
        service.reject_certification_request(request, reason: "Invalid employment status")

        expect(request.reload.status).to eq(Hr::EmploymentCertificationRequest::STATUS_REJECTED)
      end

      it "can view pending certifications list" do
        pending = create(:certification_request, employee: regular_employee, organization: organization)

        expect(service.pending_certifications).to include(pending)
      end
    end

    describe "statistics" do
      it "can view HR statistics" do
        stats = service.statistics

        expect(stats).to have_key(:employees)
        expect(stats).to have_key(:vacation_requests)
        expect(stats).to have_key(:certification_requests)
      end
    end
  end

  describe "HR Manager permissions" do
    let(:service) { Hr::HrService.new(actor: hr_manager.user, organization: organization) }

    describe "vacation requests" do
      it "can approve any request in organization" do
        request = create(:vacation_request, :pending,
                         employee: regular_employee,
                         organization: organization)

        expect(request.can_approve?(hr_manager)).to be true
        service.approve_vacation_request(request)
        expect(request.reload.status).to eq(Hr::VacationRequest::STATUS_APPROVED)
      end

      it "sees all pending requests in pending_approvals" do
        request1 = create(:vacation_request, :pending, employee: regular_employee, organization: organization)
        other_employee = create(:hr_employee, organization: organization)
        request2 = create(:vacation_request, :pending, employee: other_employee, organization: organization)

        pending = service.pending_approvals
        expect(pending).to include(request1, request2)
      end
    end

    describe "certification requests" do
      it "can process any certification request" do
        request = create(:certification_request, employee: regular_employee, organization: organization)
        service.process_certification_request(request)

        expect(request.reload.processed_by).to eq(hr_manager)
      end
    end

    describe "team visibility" do
      it "can see all employees as subordinates" do
        subordinates = service.get_subordinates

        expect(subordinates).to include(regular_employee)
        expect(subordinates).to include(supervisor)
      end

      it "can view team calendar for all employees" do
        vacation = create(:vacation_request, :approved, employee: regular_employee, organization: organization)

        calendar = service.get_team_calendar(Date.current, 1.month.from_now.to_date)
        expect(calendar).to include(vacation)
      end
    end
  end

  describe "Cross-organization isolation" do
    let(:other_org) { create(:organization) }
    let(:other_employee) { create(:hr_employee, organization: other_org) }
    let(:service) { Hr::HrService.new(actor: hr_manager.user, organization: organization) }

    it "HR manager cannot see requests from other organization" do
      other_request = create(:vacation_request, :pending, employee: other_employee, organization: other_org)

      expect(service.pending_approvals).not_to include(other_request)
    end

    it "HR manager cannot approve requests from other organization" do
      other_request = create(:vacation_request, :pending, employee: other_employee, organization: other_org)

      # Even though hr_manager is HR manager, they shouldn't be able to approve cross-org
      expect(other_request.can_approve?(hr_manager)).to be false
    end
  end

  describe "Audit trail for all actions" do
    let(:service) { Hr::HrService.new(actor: supervisor.user, organization: organization) }

    it "logs vacation request creation" do
      expect do
        service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 4.days
        )
      end.to change { Audit::AuditEvent.where(action: "vacation_request_created").count }.by(1)
    end

    it "logs vacation request submission" do
      request = service.create_vacation_request(
        start_date: 1.week.from_now.to_date,
        end_date: 1.week.from_now.to_date + 4.days
      )

      expect { service.submit_vacation_request(request) }
        .to change { Audit::AuditEvent.where(action: "vacation_request_submitted").count }.by(1)
    end

    it "logs vacation request approval" do
      subordinate_request = create(:vacation_request, :pending,
                                   employee: regular_employee,
                                   approver: supervisor,
                                   organization: organization)

      expect { service.approve_vacation_request(subordinate_request) }
        .to change { Audit::AuditEvent.where(action: "vacation_request_approved").count }.by(1)
    end

    it "logs vacation request rejection" do
      subordinate_request = create(:vacation_request, :pending,
                                   employee: regular_employee,
                                   approver: supervisor,
                                   organization: organization)

      expect { service.reject_vacation_request(subordinate_request, reason: "Busy period") }
        .to change { Audit::AuditEvent.where(action: "vacation_request_rejected").count }.by(1)
    end

    it "logs certification request creation" do
      expect do
        service.create_certification_request(
          certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT,
          purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK
        )
      end.to change { Audit::AuditEvent.where(action: "certification_request_created").count }.by(1)
    end

    it "audit events include HR tag" do
      service.create_vacation_request(
        start_date: 1.week.from_now.to_date,
        end_date: 1.week.from_now.to_date + 4.days
      )

      event = Audit::AuditEvent.where(action: "vacation_request_created").last
      expect(event.tags).to include("hr")
      expect(event.event_type).to eq("hr")
    end
  end

  describe "Vacation balance enforcement" do
    let(:low_balance_employee) { create(:hr_employee, :low_balance, organization: organization) }
    let(:service) { Hr::HrService.new(actor: low_balance_employee.user, organization: organization) }

    it "prevents creating request exceeding balance" do
      expect do
        service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 9.days, # 10 days
          vacation_type: Hr::VacationRequest::TYPE_VACATION
        )
      end.to raise_error(Mongoid::Errors::Validations)
    end

    it "allows sick leave regardless of balance" do
      zero_balance = create(:hr_employee, :no_balance, organization: organization)
      zero_service = Hr::HrService.new(actor: zero_balance.user, organization: organization)

      request = zero_service.create_vacation_request(
        start_date: Date.current + 1.day,
        end_date: Date.current + 3.days,
        vacation_type: Hr::VacationRequest::TYPE_SICK,
        reason: "Medical"
      )

      expect(request).to be_persisted
    end

    it "deducts balance when request is approved" do
      supervisor_service = Hr::HrService.new(actor: supervisor.user, organization: organization)
      low_balance_employee.update!(supervisor: supervisor)

      request = create(:vacation_request, :pending,
                       employee: low_balance_employee,
                       approver: supervisor,
                       days_requested: 1.0,
                       organization: organization)

      original_balance = low_balance_employee.vacation_balance_days

      supervisor_service.approve_vacation_request(request)

      expect(low_balance_employee.reload.vacation_balance_days).to eq(original_balance - 1.0)
    end

    it "restores balance when approved request is cancelled" do
      low_balance_employee.update!(vacation_balance_days: 10.0)

      request = create(:vacation_request, :approved,
                       employee: low_balance_employee,
                       days_requested: 5.0,
                       organization: organization)

      # Simulate balance already deducted
      low_balance_employee.update!(vacation_balance_days: 5.0, vacation_used_ytd: 5.0)

      service.cancel_vacation_request(request, reason: "Plans changed")

      expect(low_balance_employee.reload.vacation_balance_days).to eq(10.0)
    end
  end
end
