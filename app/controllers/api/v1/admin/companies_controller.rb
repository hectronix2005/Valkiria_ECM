# frozen_string_literal: true

module Api
  module V1
    module Admin
      class CompaniesController < BaseController
        before_action :ensure_admin_or_hr
        before_action :set_company, only: [:update, :destroy]

        # GET /api/v1/admin/companies
        def index
          @companies = ::Identity::Company
                       .where(organization_id: current_organization.id)
                       .ordered

          if params[:active].present?
            @companies = params[:active] == "true" ? @companies.active : @companies.where(active: false)
          end

          render json: {
            data: @companies.map { |c| company_json(c) },
            meta: { total: @companies.count }
          }
        end

        # POST /api/v1/admin/companies
        def create
          @company = ::Identity::Company.new(company_params)
          @company.organization = current_organization

          if @company.save
            render json: {
              data: company_json(@company),
              message: "Compañía creada exitosamente"
            }, status: :created
          else
            render json: {
              error: "Error al crear compañía",
              errors: @company.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/admin/companies/:id
        def update
          if @company.update(company_params)
            render json: {
              data: company_json(@company),
              message: "Compañía actualizada exitosamente"
            }
          else
            render json: {
              error: "Error al actualizar compañía",
              errors: @company.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # DELETE /api/v1/admin/companies/:id
        def destroy
          @company.destroy
          render json: { message: "Compañía eliminada exitosamente" }
        end

        private

        def ensure_admin_or_hr
          return if current_user.admin? || current_user.has_role?("hr")

          render json: {
            error: "Acceso denegado. Se requieren privilegios de administrador o HR."
          }, status: :forbidden
        end

        def set_company
          @company = ::Identity::Company.find_by(
            uuid: params[:id],
            organization_id: current_organization.id
          )

          return if @company

          render json: { error: "Compañía no encontrada" }, status: :not_found
        end

        def company_params
          params.require(:company).permit(:name, :nit, :active)
        end

        def company_json(company)
          {
            id: company.uuid,
            name: company.name,
            nit: company.nit,
            active: company.active,
            created_at: company.created_at.iso8601
          }
        end
      end
    end
  end
end
