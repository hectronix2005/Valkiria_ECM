# frozen_string_literal: true

module Api
  module V1
    module Legal
      class ContractApprovalsController < BaseController
        before_action :set_contract, only: %i[show approve reject sign]

        # GET /api/v1/legal/contract_approvals
        def index
          status_filter = params[:status] || "pending"

          contracts = ::Legal::Contract
            .where(organization_id: current_organization.id)
            .includes(:third_party, :requested_by)

          if status_filter == "pending"
            # Get contracts pending approval that user can approve
            pending_approvals = contracts.pending_approval.select { |c| c.can_approve?(current_user) }

            # Also get contracts pending signatures that user can sign
            pending_signatures = contracts.pending_signatures.select { |c| can_sign_contract?(c) }

            contracts = pending_approvals + pending_signatures
          elsif status_filter == "signatures"
            # Only pending signatures
            contracts = contracts.pending_signatures.select { |c| can_sign_contract?(c) }
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
              # Filter to contracts where user approved or signed
              contracts = contracts.any_of(
                { status: "approved" },
                { status: "rejected" },
                { status: "active" }
              ).order(updated_at: :desc).limit(50).to_a.select do |c|
                c.approvals.any? { |a| a.approver_id == current_user.id.to_s } ||
                  (c.generated_document&.signatures&.any? { |s| s["user_id"] == current_user.id.to_s && s["status"] == "signed" })
              end
            end
          end

          # Calculate stats
          pending_approval_count = ::Legal::Contract
            .where(organization_id: current_organization.id)
            .pending_approval
            .count { |c| c.can_approve?(current_user) }

          pending_signatures_count = ::Legal::Contract
            .where(organization_id: current_organization.id)
            .pending_signatures
            .count { |c| can_sign_contract?(c) }

          render json: {
            data: contracts.map { |c| approval_json(c) },
            meta: {
              status: status_filter,
              total_pending: pending_approval_count + pending_signatures_count,
              total_pending_approvals: pending_approval_count,
              total_pending_signatures: pending_signatures_count
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

        # POST /api/v1/legal/contract_approvals/:id/sign
        # Sign the contract document
        def sign
          unless @contract.pending_signatures?
            return render json: { error: "Este contrato no está pendiente de firmas" }, status: :unprocessable_entity
          end

          doc = @contract.generated_document
          unless doc
            return render json: { error: "Este contrato no tiene documento generado" }, status: :not_found
          end

          unless doc.can_be_signed_by?(current_user)
            return render json: { error: "No tienes firma pendiente en este documento" }, status: :forbidden
          end

          # Get user's default signature
          signature = current_user.signatures.active.default_signature.first || current_user.signatures.active.first
          unless signature
            return render json: { error: "No tienes una firma digital configurada. Configura tu firma en tu perfil." }, status: :unprocessable_entity
          end

          # Get custom position from params if provided
          custom_position = nil
          if params[:signature_position].present?
            custom_position = {
              x: params[:signature_position][:x_position]&.to_i,
              y: params[:signature_position][:y_position]&.to_i,
              width: params[:signature_position][:width]&.to_i,
              height: params[:signature_position][:height]&.to_i
            }.compact
            custom_position = nil if custom_position.empty?
          end

          doc.sign!(user: current_user, signature: signature, custom_position: custom_position)

          # Refresh document to get updated signature status
          doc.reload

          # If all signatures complete, mark contract as approved
          if doc.all_required_signed? && @contract.pending_signatures?
            @contract.complete_signatures!(actor: current_user)
          end

          @contract.reload

          render json: {
            data: approval_json(@contract),
            message: "Documento firmado exitosamente",
            all_signed: doc.all_required_signed?
          }
        rescue ::Templates::GeneratedDocument::SignatureError => e
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

        def can_sign_contract?(contract)
          return false unless contract.pending_signatures?
          doc = contract.generated_document
          return false unless doc
          doc.can_be_signed_by?(current_user)
        end

        def approval_json(contract, detailed: false)
          doc = contract.generated_document

          # Build signatures info
          signatures_info = []
          can_sign = false
          if doc
            signatures_info = doc.signatures.map do |sig|
              # Get signatory from template to get position info
              signatory_uuid = sig["signatory_id"]
              signatory = signatory_uuid.present? ? doc.template&.signatories&.where(uuid: signatory_uuid)&.first : nil
              sig_box = signatory&.signature_box || {}

              {
                signatory_label: sig["signatory_label"],
                signatory_type_code: sig["signatory_type_code"],
                user_name: sig["user_name"],
                user_id: sig["user_id"],
                status: sig["status"],
                required: sig["required"],
                signed_at: sig["signed_at"],
                signed_by_name: sig["signed_by_name"],
                is_mine: sig["user_id"] == current_user.id.to_s,
                # Position info for visual editor
                x_position: sig_box[:x] || 350,
                y_position: sig_box[:y] || 700,
                width: sig_box[:width] || 200,
                height: sig_box[:height] || 80,
                page_number: sig_box[:page] || 1
              }
            end
            # Only allow signing if contract is in pending_signatures status
            can_sign = contract.pending_signatures? && doc.can_be_signed_by?(current_user)
          end

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
            can_sign: can_sign,
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
            has_document: contract.document_uuid.present?,
            document_page_count: doc&.template&.pdf_page_count || 1,
            pdf_width: doc&.template&.pdf_width || 612,
            pdf_height: doc&.template&.pdf_height || 792,
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
            },
            document_signatures: signatures_info,
            document_signatures_status: contract.document_signatures_status
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
