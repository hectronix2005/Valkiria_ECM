# frozen_string_literal: true

module Api
  module V1
    module Legal
      class ThirdPartiesController < BaseController
        before_action :set_third_party, only: %i[show update destroy activate deactivate block]

        # GET /api/v1/legal/third_parties
        def index
          authorize ::Legal::ThirdParty

          third_parties = policy_scope(::Legal::ThirdParty)
            .order(created_at: :desc)

          # Filters
          third_parties = third_parties.by_type(params[:type]) if params[:type].present?
          third_parties = third_parties.where(status: params[:status]) if params[:status].present?
          third_parties = third_parties.where(person_type: params[:person_type]) if params[:person_type].present?
          third_parties = third_parties.search(params[:search]) if params[:search].present?

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 20).to_i
          total = third_parties.count
          third_parties = third_parties.skip((page - 1) * per_page).limit(per_page)

          render json: {
            data: third_parties.map { |tp| third_party_json(tp) },
            meta: {
              current_page: page,
              per_page: per_page,
              total_count: total,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/legal/third_parties/:id
        def show
          authorize @third_party
          render json: { data: third_party_json(@third_party, detailed: true) }
        end

        # POST /api/v1/legal/third_parties
        def create
          authorize ::Legal::ThirdParty

          @third_party = ::Legal::ThirdParty.new(third_party_params)
          @third_party.organization = current_organization
          @third_party.created_by = current_user

          if @third_party.save
            render json: { data: third_party_json(@third_party) }, status: :created
          else
            render json: { errors: @third_party.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/legal/third_parties/:id
        def update
          authorize @third_party

          if @third_party.update(third_party_params)
            render json: { data: third_party_json(@third_party) }
          else
            render json: { errors: @third_party.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/legal/third_parties/:id
        def destroy
          authorize @third_party

          if @third_party.contracts.any?
            render json: { error: "No se puede eliminar un tercero con contratos asociados" }, status: :unprocessable_entity
          elsif @third_party.destroy
            render json: { message: "Tercero eliminado correctamente" }
          else
            render json: { errors: @third_party.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/legal/third_parties/:id/activate
        def activate
          authorize @third_party, :update?

          @third_party.activate!
          render json: { data: third_party_json(@third_party), message: "Tercero activado" }
        end

        # POST /api/v1/legal/third_parties/:id/deactivate
        def deactivate
          authorize @third_party, :update?

          @third_party.deactivate!
          render json: { data: third_party_json(@third_party), message: "Tercero desactivado" }
        end

        # POST /api/v1/legal/third_parties/:id/block
        def block
          authorize @third_party, :update?

          reason = params[:reason]
          @third_party.block!(reason: reason)
          render json: { data: third_party_json(@third_party), message: "Tercero bloqueado" }
        end

        private

        def set_third_party
          @third_party = ::Legal::ThirdParty.find_by(uuid: params[:id])
          render json: { error: "Tercero no encontrado" }, status: :not_found unless @third_party
        end

        def third_party_params
          params.require(:third_party).permit(
            :third_party_type, :person_type, :status,
            :identification_type, :identification_number, :verification_digit,
            :business_name, :trade_name, :first_name, :last_name,
            :email, :phone, :mobile, :website,
            :address, :city, :state, :postal_code, :country,
            :legal_rep_name, :legal_rep_id_type, :legal_rep_id_number,
            :legal_rep_email, :legal_rep_phone,
            :bank_name, :bank_account_type, :bank_account_number,
            :industry, :notes, :tax_regime,
            tags: [], tax_responsibilities: []
          )
        end

        def third_party_json(third_party, detailed: false)
          data = {
            id: third_party.uuid,
            code: third_party.code,
            third_party_type: third_party.third_party_type,
            type_label: third_party.type_label,
            person_type: third_party.person_type,
            status: third_party.status,
            status_label: third_party.status_label,
            display_name: third_party.display_name,
            identification_type: third_party.identification_type,
            identification_number: third_party.identification_number,
            full_identification: third_party.full_identification,
            email: third_party.email,
            phone: third_party.phone,
            city: third_party.city,
            country: third_party.country,
            contracts_count: third_party.contracts.count,
            created_at: third_party.created_at,
            updated_at: third_party.updated_at
          }

          if detailed
            data.merge!(
              verification_digit: third_party.verification_digit,
              business_name: third_party.business_name,
              trade_name: third_party.trade_name,
              first_name: third_party.first_name,
              last_name: third_party.last_name,
              mobile: third_party.mobile,
              website: third_party.website,
              address: third_party.address,
              state: third_party.state,
              postal_code: third_party.postal_code,
              full_address: third_party.full_address,
              legal_rep_name: third_party.legal_rep_name,
              legal_rep_id_type: third_party.legal_rep_id_type,
              legal_rep_id_number: third_party.legal_rep_id_number,
              legal_rep_email: third_party.legal_rep_email,
              legal_rep_phone: third_party.legal_rep_phone,
              bank_name: third_party.bank_name,
              bank_account_type: third_party.bank_account_type,
              bank_account_number: third_party.bank_account_number,
              industry: third_party.industry,
              tags: third_party.tags,
              notes: third_party.notes,
              tax_regime: third_party.tax_regime,
              tax_responsibilities: third_party.tax_responsibilities,
              created_by: third_party.created_by ? {
                id: third_party.created_by.uuid,
                name: third_party.created_by.full_name
              } : nil
            )
          end

          data
        end
      end
    end
  end
end
