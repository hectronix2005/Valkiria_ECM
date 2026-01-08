# frozen_string_literal: true

module Api
  module V1
    module Legal
      class ContractsController < BaseController
        before_action :set_contract, only: %i[show update destroy submit activate terminate cancel generate_document download_document]

        # GET /api/v1/legal/contracts
        def index
          authorize ::Legal::Contract

          contracts = policy_scope(::Legal::Contract)
            .includes(:third_party, :requested_by)
            .order(created_at: :desc)

          # Filters
          contracts = contracts.by_type(params[:type]) if params[:type].present?
          contracts = contracts.where(status: params[:status]) if params[:status].present?
          contracts = contracts.by_third_party(params[:third_party_id]) if params[:third_party_id].present?
          contracts = contracts.search(params[:search]) if params[:search].present?

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 20).to_i
          total = contracts.count
          contracts = contracts.skip((page - 1) * per_page).limit(per_page)

          render json: {
            data: contracts.map { |c| contract_json(c) },
            meta: {
              current_page: page,
              per_page: per_page,
              total_count: total,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/legal/contracts/:id
        def show
          authorize @contract
          render json: { data: contract_json(@contract, detailed: true) }
        end

        # POST /api/v1/legal/contracts
        def create
          authorize ::Legal::Contract

          @contract = ::Legal::Contract.new(contract_params)
          @contract.organization = current_organization
          @contract.requested_by = current_user

          if @contract.save
            render json: { data: contract_json(@contract) }, status: :created
          else
            render json: { errors: @contract.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/legal/contracts/:id
        def update
          authorize @contract

          if @contract.update(contract_params)
            render json: { data: contract_json(@contract) }
          else
            render json: { errors: @contract.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/legal/contracts/:id
        def destroy
          authorize @contract

          if @contract.destroy
            render json: { message: "Contrato eliminado correctamente" }
          else
            render json: { errors: @contract.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/legal/contracts/:id/submit
        def submit
          authorize @contract

          # Validate contract has required data
          unless @contract.third_party
            return render json: { error: "El contrato debe tener un tercero asignado" }, status: :unprocessable_entity
          end

          unless @contract.amount && @contract.amount > 0
            return render json: { error: "El contrato debe tener un monto válido" }, status: :unprocessable_entity
          end

          unless @contract.start_date && @contract.end_date
            return render json: { error: "El contrato debe tener fechas de inicio y fin" }, status: :unprocessable_entity
          end

          # If contract has a template, generate document first to validate variables
          if @contract.template_id && !@contract.document_uuid
            template = ::Templates::Template.find_by(uuid: @contract.template_id)
            if template
              context = {
                third_party: @contract.third_party,
                contract: @contract,
                organization: current_organization,
                user: current_user
              }

              begin
                service = ::Templates::RobustDocumentGeneratorService.new(template, context)
                doc = service.generate!
                @contract.update!(document_uuid: doc.uuid)
              rescue ::Templates::RobustDocumentGeneratorService::MissingVariablesError => e
                return render json: {
                  error: "No se puede enviar a aprobación. Faltan datos para generar el documento.",
                  missing_variables: e.message,
                  action_required: "complete_data"
                }, status: :unprocessable_entity
              rescue ::Templates::RobustDocumentGeneratorService::GenerationError => e
                return render json: {
                  error: "Error al generar el documento: #{e.message}",
                  action_required: "fix_template"
                }, status: :unprocessable_entity
              end
            end
          end

          @contract.submit!(actor: current_user)
          render json: {
            data: contract_json(@contract),
            message: "Contrato enviado a aprobación",
            document_generated: @contract.document_uuid.present?
          }
        rescue ::Legal::Contract::InvalidStateError, ::Legal::Contract::ValidationError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/legal/contracts/:id/activate
        def activate
          authorize @contract

          @contract.activate!(actor: current_user)
          render json: {
            data: contract_json(@contract),
            message: "Contrato activado"
          }
        rescue ::Legal::Contract::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/legal/contracts/:id/terminate
        def terminate
          authorize @contract

          reason = params[:reason]
          @contract.terminate!(actor: current_user, reason: reason)
          render json: {
            data: contract_json(@contract),
            message: "Contrato terminado"
          }
        rescue ::Legal::Contract::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/legal/contracts/:id/cancel
        def cancel
          authorize @contract

          reason = params[:reason]
          @contract.cancel!(actor: current_user, reason: reason)
          render json: {
            data: contract_json(@contract),
            message: "Contrato cancelado"
          }
        rescue ::Legal::Contract::InvalidStateError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/legal/contracts/:id/generate_document
        def generate_document
          authorize @contract

          # Use provided template_id or fall back to contract's stored template
          template_id = params[:template_id].presence || @contract.template_id
          unless template_id
            return render json: { error: "No se especificó un template y el contrato no tiene uno asociado" }, status: :unprocessable_entity
          end

          template = ::Templates::Template.find_by(uuid: template_id)
          unless template
            return render json: { error: "Template no encontrado" }, status: :not_found
          end

          context = {
            third_party: @contract.third_party,
            contract: @contract,
            organization: current_organization,
            user: current_user
          }

          service = ::Templates::RobustDocumentGeneratorService.new(template, context)
          doc = service.generate!

          @contract.update!(document_uuid: doc.uuid)

          render json: {
            data: contract_json(@contract),
            document: {
              uuid: doc.uuid,
              status: doc.status
            },
            message: "Documento generado correctamente"
          }
        rescue ::Templates::RobustDocumentGeneratorService::MissingVariablesError => e
          render json: {
            error: "Variables faltantes para generar el documento",
            missing_variables: e.message
          }, status: :unprocessable_entity
        rescue ::Templates::RobustDocumentGeneratorService::GenerationError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/legal/contracts/validate_template
        # Validates that all template variables can be resolved with the given data
        def validate_template
          authorize ::Legal::Contract

          template_id = params[:template_id]
          third_party_id = params[:third_party_id]

          unless template_id.present?
            return render json: { error: "Se requiere template_id" }, status: :unprocessable_entity
          end

          template = ::Templates::Template.find_by(uuid: template_id)
          unless template
            return render json: { error: "Template no encontrado" }, status: :not_found
          end

          third_party = nil
          if third_party_id.present?
            third_party = ::Legal::ThirdParty.find_by(uuid: third_party_id)
            unless third_party
              return render json: { error: "Tercero no encontrado" }, status: :not_found
            end
          end

          # Build a temporary contract object with the provided data
          temp_contract = ::Legal::Contract.new(
            title: params[:title] || "Validación",
            contract_type: params[:contract_type] || "services",
            amount: params[:amount]&.to_f,
            currency: params[:currency] || "COP",
            start_date: params[:start_date],
            end_date: params[:end_date],
            description: params[:description],
            payment_terms: params[:payment_terms],
            organization: current_organization,
            third_party: third_party
          )

          # Create context for variable resolution
          context = {
            third_party: third_party,
            contract: temp_contract,
            organization: current_organization
          }

          # Validate variables
          resolver = ::Templates::VariableResolverService.new(context)
          validation = resolver.validate_for_template(template)

          # Group missing variables by source for better UX
          missing_by_source = validation[:missing].group_by { |m| m[:source] }

          render json: {
            valid: validation[:valid],
            template: {
              id: template.uuid,
              name: template.name,
              total_variables: validation[:total_variables]
            },
            validation: {
              resolved_count: validation[:resolved_count],
              missing_count: validation[:missing_count],
              missing: validation[:missing],
              missing_by_source: missing_by_source
            },
            message: validation[:valid] ? "Todos los datos están completos" : "Faltan datos requeridos para generar el documento"
          }
        end

        # GET /api/v1/legal/contracts/:id/download_document
        def download_document
          authorize @contract

          unless @contract.document_uuid
            return render json: { error: "Este contrato no tiene documento generado" }, status: :not_found
          end

          generated_doc = ::Templates::GeneratedDocument.find_by(uuid: @contract.document_uuid)
          unless generated_doc
            return render json: { error: "Documento no encontrado" }, status: :not_found
          end

          file_id = generated_doc.final_file_id || generated_doc.draft_file_id
          unless file_id
            return render json: { error: "Archivo no disponible" }, status: :not_found
          end

          grid_file = Mongoid::GridFs.get(file_id)
          send_data grid_file.data,
                    type: "application/pdf",
                    disposition: "attachment",
                    filename: generated_doc.file_name
        end

        private

        def set_contract
          @contract = ::Legal::Contract.find_by(uuid: params[:id])
          render json: { error: "Contrato no encontrado" }, status: :not_found unless @contract
        end

        def contract_params
          params.require(:contract).permit(
            :title, :description, :contract_type,
            :start_date, :end_date, :signature_date,
            :amount, :currency, :payment_terms, :payment_frequency,
            :third_party_id, :template_id,
            :auto_renewal, :renewal_notice_days, :renewal_terms
          ).tap do |p|
            # Convert third_party_id from UUID to ObjectId
            if p[:third_party_id].present?
              tp = ::Legal::ThirdParty.find_by(uuid: p[:third_party_id])
              p[:third_party_id] = tp&.id
            end
          end
        end

        def contract_json(contract, detailed: false)
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
            duration_days: contract.duration_days,
            days_until_expiry: contract.days_until_expiry,
            expiring_soon: contract.expiring_soon?,
            approval_level: contract.approval_level,
            approval_level_label: contract.approval_level_label,
            current_approver_role: contract.current_approver_role,
            current_approver_label: contract.current_approver_label,
            approval_progress: contract.approval_progress,
            can_approve: contract.can_approve?(current_user),
            has_document: contract.document_uuid.present?,
            third_party: contract.third_party ? {
              id: contract.third_party.uuid,
              code: contract.third_party.code,
              display_name: contract.third_party.display_name,
              type: contract.third_party.third_party_type
            } : nil,
            requested_by: contract.requested_by ? {
              id: contract.requested_by.uuid,
              name: contract.requested_by.full_name
            } : nil,
            created_at: contract.created_at,
            updated_at: contract.updated_at
          }

          if detailed
            data.merge!(
              description: contract.description,
              signature_date: contract.signature_date,
              payment_terms: contract.payment_terms,
              payment_frequency: contract.payment_frequency,
              auto_renewal: contract.auto_renewal,
              renewal_notice_days: contract.renewal_notice_days,
              renewal_terms: contract.renewal_terms,
              submitted_at: contract.submitted_at,
              approved_at: contract.approved_at,
              rejected_at: contract.rejected_at,
              rejection_reason: contract.rejection_reason,
              document_uuid: contract.document_uuid,
              template_id: contract.template_id,
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
              history: contract.history.last(20),
              editable: contract.editable?,
              can_submit: contract.can_submit?,
              can_activate: contract.can_activate?
            )
          end

          data
        end
      end
    end
  end
end
