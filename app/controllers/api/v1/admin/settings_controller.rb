# frozen_string_literal: true

module Api
  module V1
    module Admin
      class SettingsController < BaseController
        before_action :set_organization

        def show
          authorize :settings, :show?

          render json: {
            data: organization_settings
          }, status: :ok
        end

        def update
          authorize :settings, :update?

          if @organization.update(organization_params)
            render json: {
              message: "Configuración actualizada correctamente",
              data: organization_settings
            }, status: :ok
          else
            render json: {
              error: "Error al actualizar configuración",
              errors: @organization.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        private

        def set_organization
          @organization = current_organization
          render_error("Organización no encontrada", status: :not_found) unless @organization
        end

        def organization_params
          params.require(:settings).permit(
            :name, :legal_name, :tax_id, :address, :city, :country,
            :phone, :email, :website, :logo_url,
            :vacation_days_per_year, :vacation_accrual_policy,
            :max_vacation_carryover, :probation_period_months,
            :max_file_size_mb, :document_retention_years,
            :session_timeout_minutes, :password_min_length,
            :password_require_uppercase, :password_require_number,
            :password_require_special, :max_login_attempts,
            allowed_file_types: []
          )
        end

        def organization_settings
          {
            # System info
            system: {
              app_name: "VALKYRIA ECM",
              version: "1.0.0",
              environment: Rails.env
            },
            # Organization details
            organization: {
              id: @organization.uuid,
              name: @organization.name,
              legal_name: @organization.legal_name,
              tax_id: @organization.tax_id,
              address: @organization.address,
              city: @organization.city,
              country: @organization.country,
              phone: @organization.phone,
              email: @organization.email,
              website: @organization.website,
              logo_url: @organization.logo_url
            },
            # HR Settings
            hr: {
              vacation_days_per_year: @organization.vacation_days_per_year,
              vacation_accrual_policy: @organization.vacation_accrual_policy,
              max_vacation_carryover: @organization.max_vacation_carryover,
              probation_period_months: @organization.probation_period_months
            },
            # Document Settings
            documents: {
              allowed_file_types: @organization.allowed_file_types,
              max_file_size_mb: @organization.max_file_size_mb,
              document_retention_years: @organization.document_retention_years
            },
            # Security Settings
            security: {
              session_timeout_minutes: @organization.session_timeout_minutes,
              password_min_length: @organization.password_min_length,
              password_require_uppercase: @organization.password_require_uppercase,
              password_require_number: @organization.password_require_number,
              password_require_special: @organization.password_require_special,
              max_login_attempts: @organization.max_login_attempts
            }
          }
        end
      end
    end
  end
end
