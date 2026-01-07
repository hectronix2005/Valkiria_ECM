# frozen_string_literal: true

module Api
  module V1
    module Legal
      class ContractApprovalsController < BaseController
        before_action :set_contract, only: %i[show approve reject]

        # GET /api/v1/legal/contract_approvals
        def index
          status_filter = params[:status] || "pending"

          contracts = ::Legal::Contract
            .where(organization_id: current_organization.id)
            .includes(:third_party, :requested_by)

          if status_filter == "pending"
            # Get contracts pending approval that user can approve
            contracts = contracts.pending_approval.select { |c| c.can_approve?(current_user) }
          else
            # History - approved/rejected by this user or all for admins
            if current_user.admin? || current_user.has_role?("legal")
              contracts = contracts.any_of(
                { status: "approved" },
                { status: "rejected" },
                { status: "active" },
                { status: "terminated" },
                { status: "cancelled" }
              ).order(updated_at: :desc).limit(50).to_a
            else
              # Filter to contracts where user approved
              contracts = contracts.any_of(
                { status: "approved" },
                { status: "rejected" },
                { status: "active" }
              ).order(updated_at: :desc).limit(50).to_a.select do |c|
                c.approvals.any? { |a| a.approver_id == current_user.id.to_s }
              end
            end
          end

          # Calculate stats
          pending_count = ::Legal::Contract
            .where(organization_id: current_organization.id)
            .pending_approval
            .count { |c| c.can_approve?(current_user) }

          render json: {
            data: contracts.map { |c| approval_json(c) },
            meta: {
              status: status_filter,
              total_pending: pending_count
            }
          }
        end

        # GET /api/v1/legal/contract_approvals/:id
        def show
          render json: { data: approval_json(@contract, detailed: true) }
        end

        # POST /api/v1/legal/contract_approvals/:id/approve
        def approve
          role = determine_user_role

          unless role
            return render json: { error: "No tienes un rol de aprobación válido" }, status: :forbidden
          end

          @contract.approve!(actor: current_user, role: role, notes: params[:notes])

          render json: {
            data: approval_json(@contract),
            message: all_approved? ? "Contrato aprobado completamente" : "Aprobación registrada, pendiente siguiente nivel"
          }
        rescue ::Legal::Contract::InvalidStateError, ::Legal::Contract::AuthorizationError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/legal/contract_approvals/:id/reject
        def reject
          role = determine_user_role

          unless role
            return render json: { error: "No tienes un rol de aprobación válido" }, status: :forbidden
          end

          unless params[:reason].present?
            return render json: { error: "Se requiere un motivo de rechazo" }, status: :unprocessable_entity
          end

          @contract.reject!(actor: current_user, role: role, reason: params[:reason])

          render json: {
            data: approval_json(@contract),
            message: "Contrato rechazado"
          }
        rescue ::Legal::Contract::InvalidStateError, ::Legal::Contract::AuthorizationError, ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def set_contract
          @contract = ::Legal::Contract.find_by(uuid: params[:id])
          render json: { error: "Contrato no encontrado" }, status: :not_found unless @contract
        end

        def determine_user_role
          # Determine which approval role the user can act as
          return @contract.current_approver_role if @contract.can_approve?(current_user)

          # Check if user has any approval role
          roles_map = {
            "admin" => %w[area_manager legal general_manager ceo],
            "ceo" => %w[ceo],
            "general_manager" => %w[general_manager],
            "legal" => %w[legal],
            "manager" => %w[area_manager]
          }

          user_roles = current_user.roles || []
          user_roles.each do |user_role|
            approval_roles = roles_map[user_role] || []
            return @contract.current_approver_role if approval_roles.include?(@contract.current_approver_role)
          end

          nil
        end

        def all_approved?
          @contract.approved?
        end

        def approval_json(contract, detailed: false)
          data = {
            id: contract.uuid,
            contract_number: contract.contract_number,
            title: contract.title,
            contract_type: contract.contract_type,
            type_label: contract.type_label,
            status: contract.status,
            status_label: contract.status_label,
            amount: contract.amount.to_f,
            currency: contract.currency,
            start_date: contract.start_date,
            end_date: contract.end_date,
            approval_level: contract.approval_level,
            approval_level_label: contract.approval_level_label,
            current_approver_role: contract.current_approver_role,
            current_approver_label: contract.current_approver_label,
            approval_progress: contract.approval_progress,
            can_approve: contract.can_approve?(current_user),
            submitted_at: contract.submitted_at,
            third_party: contract.third_party ? {
              id: contract.third_party.uuid,
              display_name: contract.third_party.display_name,
              type: contract.third_party.third_party_type
            } : nil,
            requested_by: contract.requested_by ? {
              id: contract.requested_by.uuid,
              name: contract.requested_by.full_name
            } : nil,
            approvals: contract.approvals.order(order: :asc).map { |a|
              {
                role: a.role,
                role_label: a.role_label,
                status: a.status,
                order: a.order,
                decided_at: a.decided_at,
                approver_name: a.approver_name,
                notes: a.notes,
                reason: a.reason
              }
            }
          }

          if detailed
            data.merge!(
              description: contract.description,
              payment_terms: contract.payment_terms,
              approved_at: contract.approved_at,
              rejected_at: contract.rejected_at,
              rejection_reason: contract.rejection_reason,
              history: contract.history.last(20)
            )
          end

          data
        end
      end
    end
  end
end
