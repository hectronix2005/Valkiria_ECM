# frozen_string_literal: true

module Api
  module V1
    module Hr
      # Employment certification requests management
      class CertificationsController < BaseController
        before_action :set_certification, only: [:show, :update, :cancel]

        # GET /api/v1/hr/certifications
        def index
          @certifications = policy_scope(::Hr::EmploymentCertificationRequest)
            .order(created_at: :desc)

          @certifications = apply_filters(@certifications)
          @certifications = paginate(@certifications)

          render json: {
            data: @certifications.map { |c| certification_json(c) },
            meta: pagination_meta(@certifications)
          }
        end

        # GET /api/v1/hr/certifications/:id
        def show
          authorize @certification

          render json: { data: certification_json(@certification, detailed: true) }
        end

        # POST /api/v1/hr/certifications
        def create
          @certification = ::Hr::EmploymentCertificationRequest.new(certification_params)
          @certification.employee = current_employee
          @certification.organization = current_organization

          authorize @certification

          if @certification.save
            render json: { data: certification_json(@certification) }, status: :created
          else
            render json: { errors: @certification.errors.full_messages }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/hr/certifications/:id
        def update
          authorize @certification

          unless @certification.pending?
            return render json: { error: "Can only update pending requests" }, status: :unprocessable_content
          end

          if @certification.update(certification_params)
            render json: { data: certification_json(@certification) }
          else
            render json: { errors: @certification.errors.full_messages }, status: :unprocessable_content
          end
        end

        # POST /api/v1/hr/certifications/:id/cancel
        def cancel
          authorize @certification, :cancel?

          @certification.cancel!(actor: current_employee)

          render json: {
            data: certification_json(@certification),
            message: "Certification request cancelled"
          }
        rescue ::Hr::EmploymentCertificationRequest::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_content
        rescue ::Hr::EmploymentCertificationRequest::AuthorizationError => e
          render json: { error: e.message }, status: :forbidden
        end

        private

        def set_certification
          @certification = ::Hr::EmploymentCertificationRequest.find_by!(uuid: params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "Certification request not found" }, status: :not_found
        end

        def certification_params
          params.require(:certification).permit(
            :certification_type,
            :purpose,
            :language,
            :delivery_method,
            :include_salary,
            :include_position,
            :include_department,
            :include_start_date,
            :additional_info
          )
        end

        def apply_filters(scope)
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(certification_type: params[:type]) if params[:type].present?
          scope
        end

        # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
        def certification_json(certification, detailed: false)
          json = {
            id: certification.uuid,
            request_number: certification.request_number,
            certification_type: certification.certification_type,
            purpose: certification.purpose,
            status: certification.status,
            estimated_days: certification.estimated_days,
            submitted_at: certification.submitted_at&.iso8601,
            created_at: certification.created_at.iso8601
          }

          if detailed
            json.merge!(
              language: certification.language,
              delivery_method: certification.delivery_method,
              include_salary: certification.include_salary,
              include_position: certification.include_position,
              include_department: certification.include_department,
              include_start_date: certification.include_start_date,
              additional_info: certification.additional_info,
              completed_at: certification.completed_at&.iso8601,
              rejection_reason: certification.rejection_reason,
              document_uuid: certification.document_uuid,
              processed_by: certification.processed_by ? employee_summary(certification.processed_by) : nil
            )
          end

          json
        end
        # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

        def employee_summary(employee)
          {
            id: employee.uuid,
            name: employee.full_name,
            email: employee.user&.email
          }
        end

        def current_employee
          @current_employee ||= ::Hr::Employee.for_user(current_user) ||
            ::Hr::Employee.create!(
              user: current_user,
              organization: current_organization,
              job_title: current_user.title,
              department: current_user.department,
              hire_date: Date.current,
              vacation_balance_days: 15.0
            )
        end
      end
    end
  end
end
