# frozen_string_literal: true

module Api
  module V1
    module Legal
      class ThirdPartyTypesController < BaseController
        before_action :set_third_party_type, only: [:show, :update, :destroy, :toggle_active]

        def index
          authorize ::Legal::ThirdPartyType

          types = current_organization.third_party_types.ordered

          # Filter by active status if provided
          types = types.active if params[:active] == "true"

          render json: {
            success: true,
            data: types.map { |t| serialize_type(t) }
          }
        end

        def show
          authorize @third_party_type
          render json: {
            success: true,
            data: serialize_type(@third_party_type)
          }
        end

        def create
          authorize ::Legal::ThirdPartyType
          type = current_organization.third_party_types.new(type_params)

          if type.save
            render json: {
              success: true,
              data: serialize_type(type)
            }, status: :created
          else
            render json: {
              success: false,
              errors: type.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        def update
          authorize @third_party_type
          if @third_party_type.update(type_params)
            render json: {
              success: true,
              data: serialize_type(@third_party_type)
            }
          else
            render json: {
              success: false,
              errors: @third_party_type.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        def destroy
          authorize @third_party_type
          unless @third_party_type.deletable?
            return render json: {
              success: false,
              error: @third_party_type.is_system ? "No se pueden eliminar tipos del sistema" : "Este tipo tiene terceros asociados"
            }, status: :unprocessable_entity
          end

          @third_party_type.destroy
          render json: { success: true }
        end

        def toggle_active
          authorize @third_party_type
          @third_party_type.toggle_active!
          render json: {
            success: true,
            data: serialize_type(@third_party_type)
          }
        end

        private

        def set_third_party_type
          @third_party_type = current_organization.third_party_types.find(params[:id])
        rescue Mongoid::Errors::DocumentNotFound
          render json: { success: false, error: "Tipo no encontrado" }, status: :not_found
        end

        def type_params
          params.require(:third_party_type).permit(:code, :name, :description, :color, :icon, :active, :position)
        end

        def serialize_type(type)
          {
            id: type.id.to_s,
            code: type.code,
            name: type.name,
            description: type.description,
            color: type.color,
            icon: type.icon,
            active: type.active,
            is_system: type.is_system,
            position: type.position,
            deletable: type.deletable?,
            third_parties_count: ::Legal::ThirdParty.where(
              organization_id: type.organization_id,
              third_party_type: type.code
            ).count,
            created_at: type.created_at,
            updated_at: type.updated_at
          }
        end

        def current_organization
          @current_organization ||= current_user.organization
        end
      end
    end
  end
end
