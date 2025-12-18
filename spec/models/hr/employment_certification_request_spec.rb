# frozen_string_literal: true

require "rails_helper"

RSpec.describe Hr::EmploymentCertificationRequest, type: :model do
  let(:organization) { create(:organization) }
  let(:employee) { create(:hr_employee, organization: organization) }
  let(:hr_staff) { create(:hr_employee, :hr_staff, organization: organization) }

  describe "validations" do
    it "is valid with valid attributes" do
      request = build(:certification_request, employee: employee, organization: organization)
      expect(request).to be_valid
    end

    it "requires employee" do
      request = build(:certification_request, employee: nil, organization: organization)
      expect(request).not_to be_valid
      expect(request.errors[:employee]).to include("can't be blank")
    end

    it "requires valid certification_type" do
      request = build(:certification_request,
                      employee: employee,
                      organization: organization,
                      certification_type: "invalid")
      expect(request).not_to be_valid
    end

    it "requires valid purpose" do
      request = build(:certification_request,
                      employee: employee,
                      organization: organization,
                      purpose: "invalid")
      expect(request).not_to be_valid
    end

    it "requires valid language" do
      request = build(:certification_request,
                      employee: employee,
                      organization: organization,
                      language: "fr")
      expect(request).not_to be_valid
    end
  end

  describe "callbacks" do
    it "generates request number on create" do
      request = create(:certification_request, employee: employee, organization: organization)
      expect(request.request_number).to match(/\ACERT-\d{4}-\d{5}\z/)
    end

    it "sets submitted_at on create" do
      request = create(:certification_request, employee: employee, organization: organization)
      expect(request.submitted_at).to be_present
    end

    it "creates audit event on create" do
      expect do
        create(:certification_request, employee: employee, organization: organization)
      end.to change { Audit::AuditEvent.where(action: "certification_request_created").count }.by(1)
    end
  end

  describe "#start_processing!" do
    let(:request) { create(:certification_request, employee: employee, organization: organization) }

    it "changes status to processing" do
      request.start_processing!(actor: hr_staff)
      expect(request.status).to eq(Hr::EmploymentCertificationRequest::STATUS_PROCESSING)
    end

    it "sets processor" do
      request.start_processing!(actor: hr_staff)
      expect(request.processed_by).to eq(hr_staff)
    end

    it "raises error if not pending" do
      request.start_processing!(actor: hr_staff)
      expect { request.start_processing!(actor: hr_staff) }
        .to raise_error(Hr::EmploymentCertificationRequest::InvalidStateError)
    end

    it "raises error if not HR staff" do
      regular_employee = create(:hr_employee, organization: organization)
      expect { request.start_processing!(actor: regular_employee) }
        .to raise_error(Hr::EmploymentCertificationRequest::AuthorizationError)
    end

    it "creates audit event" do
      expect { request.start_processing!(actor: hr_staff) }
        .to change { Audit::AuditEvent.where(action: "certification_processing_started").count }.by(1)
    end
  end

  describe "#complete!" do
    let(:request) do
      create(:certification_request, :processing, processed_by: hr_staff, employee: employee,
                                                  organization: organization)
    end
    let(:doc_uuid) { SecureRandom.uuid }

    it "changes status to completed" do
      request.complete!(actor: hr_staff, document_uuid: doc_uuid)
      expect(request.status).to eq(Hr::EmploymentCertificationRequest::STATUS_COMPLETED)
    end

    it "sets completed_at" do
      request.complete!(actor: hr_staff)
      expect(request.completed_at).to be_present
    end

    it "stores document reference" do
      request.complete!(actor: hr_staff, document_uuid: doc_uuid)
      expect(request.document_uuid).to eq(doc_uuid)
    end

    it "raises error if not processing" do
      pending_request = create(:certification_request, employee: employee, organization: organization)
      expect { pending_request.complete!(actor: hr_staff) }
        .to raise_error(Hr::EmploymentCertificationRequest::InvalidStateError)
    end

    it "creates audit event" do
      expect { request.complete!(actor: hr_staff) }
        .to change { Audit::AuditEvent.where(action: "certification_completed").count }.by(1)
    end
  end

  describe "#reject!" do
    let(:request) { create(:certification_request, employee: employee, organization: organization) }

    it "changes status to rejected" do
      request.reject!(actor: hr_staff, reason: "Employment not verified")
      expect(request.status).to eq(Hr::EmploymentCertificationRequest::STATUS_REJECTED)
    end

    it "stores rejection reason" do
      request.reject!(actor: hr_staff, reason: "Employment not verified")
      expect(request.rejection_reason).to eq("Employment not verified")
    end

    it "requires reason" do
      expect { request.reject!(actor: hr_staff, reason: "") }
        .to raise_error(Hr::EmploymentCertificationRequest::ValidationError)
    end

    it "cannot reject completed requests" do
      completed = create(:certification_request, :completed, employee: employee, organization: organization)
      expect { completed.reject!(actor: hr_staff, reason: "Test") }
        .to raise_error(Hr::EmploymentCertificationRequest::InvalidStateError)
    end

    it "creates audit event" do
      expect { request.reject!(actor: hr_staff, reason: "Test reason") }
        .to change { Audit::AuditEvent.where(action: "certification_rejected").count }.by(1)
    end
  end

  describe "#cancel!" do
    let(:request) { create(:certification_request, employee: employee, organization: organization) }

    it "changes status to cancelled" do
      request.cancel!(actor: employee)
      expect(request.status).to eq(Hr::EmploymentCertificationRequest::STATUS_CANCELLED)
    end

    it "allows employee to cancel their own request" do
      expect { request.cancel!(actor: employee) }.not_to raise_error
    end

    it "allows HR to cancel any request" do
      expect { request.cancel!(actor: hr_staff) }.not_to raise_error
    end

    it "prevents non-owner from cancelling" do
      other = create(:hr_employee, organization: organization)
      expect { request.cancel!(actor: other) }
        .to raise_error(Hr::EmploymentCertificationRequest::AuthorizationError)
    end

    it "cannot cancel completed requests" do
      completed = create(:certification_request, :completed, employee: employee, organization: organization)
      expect { completed.cancel!(actor: employee) }
        .to raise_error(Hr::EmploymentCertificationRequest::InvalidStateError)
    end

    it "creates audit event" do
      expect { request.cancel!(actor: employee) }
        .to change { Audit::AuditEvent.where(action: "certification_cancelled").count }.by(1)
    end
  end

  describe "#can_view?" do
    let(:request) { create(:certification_request, employee: employee, organization: organization) }
    let(:supervisor) { create(:hr_employee, organization: organization) }

    before do
      employee.update!(supervisor: supervisor)
    end

    it "returns true for the employee" do
      expect(request.can_view?(employee)).to be true
    end

    it "returns true for HR staff" do
      expect(request.can_view?(hr_staff)).to be true
    end

    it "returns true for supervisor" do
      expect(request.can_view?(supervisor)).to be true
    end

    it "returns false for unrelated employee" do
      other = create(:hr_employee, organization: organization)
      expect(request.can_view?(other)).to be false
    end
  end

  describe "#estimated_days" do
    it "returns 1 for employment type" do
      request = build(:certification_request,
                      certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT)
      expect(request.estimated_days).to eq(1)
    end

    it "returns 2 for salary type" do
      request = build(:certification_request,
                      certification_type: Hr::EmploymentCertificationRequest::TYPE_SALARY)
      expect(request.estimated_days).to eq(2)
    end

    it "returns 3 for full type" do
      request = build(:certification_request,
                      certification_type: Hr::EmploymentCertificationRequest::TYPE_FULL)
      expect(request.estimated_days).to eq(3)
    end
  end

  describe "#certification_content" do
    let(:request) do
      create(:certification_request,
             employee: employee,
             organization: organization,
             include_position: true,
             include_department: true,
             include_start_date: true)
    end

    it "includes employee information" do
      content = request.certification_content

      expect(content[:employee_name]).to eq(employee.full_name)
      expect(content[:job_title]).to eq(employee.job_title)
      expect(content[:department]).to eq(employee.department)
      expect(content[:hire_date]).to eq(employee.hire_date)
    end
  end

  describe "scopes" do
    let!(:pending) { create(:certification_request, employee: employee, organization: organization) }
    let!(:processing) { create(:certification_request, :processing, employee: employee, organization: organization) }
    let!(:completed) { create(:certification_request, :completed, employee: employee, organization: organization) }

    it ".pending returns pending requests" do
      expect(described_class.pending).to include(pending)
      expect(described_class.pending).not_to include(processing, completed)
    end

    it ".for_processing returns pending and processing requests" do
      expect(described_class.for_processing).to include(pending, processing)
      expect(described_class.for_processing).not_to include(completed)
    end
  end
end
