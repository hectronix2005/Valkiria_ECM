# frozen_string_literal: true

require "rails_helper"

RSpec.describe Hr::HrService, type: :service do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:employee) { create(:hr_employee, user: user, organization: organization, vacation_balance_days: 20.0) }
  let(:service) { described_class.new(actor: user, organization: organization) }

  before do
    # Ensure employee exists for user
    employee
  end

  describe "#initialize" do
    it "sets actor and organization" do
      expect(service.actor).to eq(user)
      expect(service.organization).to eq(organization)
    end

    it "finds or creates employee for actor" do
      expect(service.current_employee).to eq(employee)
    end
  end

  describe "vacation requests" do
    describe "#create_vacation_request" do
      it "creates a new vacation request" do
        request = service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date + 4.days
        )

        expect(request).to be_persisted
        expect(request.employee).to eq(employee)
        expect(request.status).to eq(Hr::VacationRequest::STATUS_DRAFT)
      end

      it "calculates business days" do
        monday = Date.current.beginning_of_week + 1.week
        friday = monday + 4.days

        request = service.create_vacation_request(
          start_date: monday,
          end_date: friday
        )

        expect(request.days_requested).to eq(5.0)
      end

      it "allows specifying vacation type" do
        request = service.create_vacation_request(
          start_date: 1.week.from_now.to_date,
          end_date: 1.week.from_now.to_date,
          vacation_type: Hr::VacationRequest::TYPE_SICK
        )

        expect(request.vacation_type).to eq(Hr::VacationRequest::TYPE_SICK)
      end
    end

    describe "#submit_vacation_request" do
      let(:request) do
        service.create_vacation_request(start_date: 1.week.from_now.to_date, end_date: 1.week.from_now.to_date + 2.days)
      end

      it "submits the request for approval" do
        service.submit_vacation_request(request)
        expect(request.status).to eq(Hr::VacationRequest::STATUS_PENDING)
      end

      it "raises error for other employee's request" do
        other_user = create(:user, organization: organization)
        other_employee = create(:hr_employee, user: other_user, organization: organization)
        other_request = create(:vacation_request, employee: other_employee, organization: organization)

        expect { service.submit_vacation_request(other_request) }
          .to raise_error(Hr::HrService::AuthorizationError)
      end
    end

    describe "#approve_vacation_request" do
      let(:subordinate) { create(:hr_employee, supervisor: employee, organization: organization) }
      let(:request) do
        create(:vacation_request, :pending, employee: subordinate, approver: employee, organization: organization)
      end

      it "approves the request" do
        service.approve_vacation_request(request)
        expect(request.reload.status).to eq(Hr::VacationRequest::STATUS_APPROVED)
      end

      it "raises error if not authorized" do
        other_employee = create(:hr_employee, organization: organization)
        other_request = create(:vacation_request, :pending, employee: other_employee, organization: organization)

        expect { service.approve_vacation_request(other_request) }
          .to raise_error(Hr::HrService::AuthorizationError)
      end
    end

    describe "#my_vacation_requests" do
      it "returns current employee's requests" do
        request1 = create(:vacation_request, employee: employee, organization: organization)
        request2 = create(:vacation_request, employee: employee, organization: organization)
        other_request = create(:vacation_request, organization: organization)

        results = service.my_vacation_requests

        expect(results).to include(request1, request2)
        expect(results).not_to include(other_request)
      end
    end

    describe "#pending_approvals" do
      let(:subordinate) { create(:hr_employee, supervisor: employee, organization: organization) }

      it "returns requests pending for current employee" do
        pending_request = create(:vacation_request, :pending, employee: subordinate, approver: employee,
                                                              organization: organization)

        expect(service.pending_approvals).to include(pending_request)
      end
    end

    describe "#vacation_balance" do
      it "returns balance information" do
        balance = service.vacation_balance

        expect(balance[:available]).to eq(employee.vacation_balance_days)
        expect(balance[:used_ytd]).to eq(employee.vacation_used_ytd)
        expect(balance).to have_key(:pending)
      end
    end
  end

  describe "certification requests" do
    describe "#create_certification_request" do
      it "creates a new certification request" do
        request = service.create_certification_request(
          certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT,
          purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK
        )

        expect(request).to be_persisted
        expect(request.employee).to eq(employee)
        expect(request.status).to eq(Hr::EmploymentCertificationRequest::STATUS_PENDING)
      end

      it "allows custom options" do
        request = service.create_certification_request(
          certification_type: Hr::EmploymentCertificationRequest::TYPE_FULL,
          purpose: Hr::EmploymentCertificationRequest::PURPOSE_VISA,
          addressee: "Embassy of Spain",
          include_salary: true
        )

        expect(request.addressee).to eq("Embassy of Spain")
        expect(request.include_salary).to be true
      end
    end

    describe "#my_certification_requests" do
      it "returns current employee's certification requests" do
        request = service.create_certification_request(
          certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT,
          purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK
        )

        expect(service.my_certification_requests).to include(request)
      end
    end

    describe "HR staff operations" do
      let(:hr_user) { create(:user, organization: organization) }
      let!(:hr_employee) { create(:hr_employee, :hr_staff, user: hr_user, organization: organization) }
      let(:hr_service) { described_class.new(actor: hr_user, organization: organization) }
      let(:cert_request) { create(:certification_request, employee: employee, organization: organization) }

      describe "#process_certification_request" do
        it "starts processing the request" do
          hr_service.process_certification_request(cert_request)

          expect(cert_request.reload.status).to eq(Hr::EmploymentCertificationRequest::STATUS_PROCESSING)
        end
      end

      describe "#complete_certification_request" do
        let(:processing_request) do
          create(:certification_request, :processing,
                 employee: employee,
                 processed_by: hr_employee,
                 organization: organization)
        end

        it "completes the request" do
          hr_service.complete_certification_request(processing_request, document_uuid: "test-uuid")

          expect(processing_request.reload.status).to eq(Hr::EmploymentCertificationRequest::STATUS_COMPLETED)
          expect(processing_request.document_uuid).to eq("test-uuid")
        end
      end

      describe "#pending_certifications" do
        it "returns pending certification requests" do
          expect(hr_service.pending_certifications).to include(cert_request)
        end
      end
    end
  end

  describe "statistics" do
    let(:hr_user) { create(:user, organization: organization) }
    let!(:hr_employee) { create(:hr_employee, :hr_staff, user: hr_user, organization: organization) }
    let(:hr_service) { described_class.new(actor: hr_user, organization: organization) }

    before do
      # Create some test data
      create_list(:hr_employee, 3, organization: organization)
      create_list(:vacation_request, 2, :pending, organization: organization)
      create_list(:certification_request, 2, organization: organization)
    end

    describe "#statistics" do
      it "returns comprehensive statistics" do
        stats = hr_service.statistics

        expect(stats[:employees][:total]).to be >= 4 # hr_employee + 3 created
        expect(stats[:vacation_requests][:pending]).to eq(2)
        expect(stats[:certification_requests][:pending]).to eq(2)
      end
    end

    describe "#employee_stats" do
      it "returns employee statistics" do
        stats = hr_service.employee_stats

        expect(stats).to have_key(:total)
        expect(stats).to have_key(:active)
        expect(stats).to have_key(:by_department)
      end
    end

    it "raises error for non-HR staff" do
      expect { service.statistics }
        .to raise_error(Hr::HrService::AuthorizationError)
    end
  end

  describe "#get_team_calendar" do
    let(:subordinate) { create(:hr_employee, supervisor: employee, organization: organization) }
    let!(:vacation) do
      create(:vacation_request, :approved,
             employee: subordinate,
             start_date: Date.current + 7.days,
             end_date: Date.current + 10.days,
             organization: organization)
    end

    it "returns approved vacations for team in date range" do
      calendar = service.get_team_calendar(Date.current, Date.current + 1.month)

      expect(calendar).to include(vacation)
    end
  end
end
