# frozen_string_literal: true

module Api
  module V1
    class TemplatesController < BaseController
      # GET /api/v1/templates
      # Public endpoint for listing active templates (read-only)
      def index
        templates = Templates::Template
          .where(organization_id: current_user.organization_id)
          .active

        # Filter by main_category
        if params[:main_category].present?
          templates = templates.where(main_category: params[:main_category])
        end

        # Filter by category
        if params[:category].present?
          templates = templates.where(category: params[:category])
        end

        # Filter by module_type
        if params[:module_type].present?
          templates = templates.where(module_type: params[:module_type])
        end

        # Search by name
        if params[:q].present?
          templates = templates.where(name: /#{Regexp.escape(params[:q])}/i)
        end

        templates = templates.order(name: :asc)

        render json: {
          success: true,
          data: templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/templates/:id
      def show
        template = Templates::Template.find_by(
          uuid: params[:id],
          organization_id: current_user.organization_id,
          status: "active"
        )

        if template
          render json: {
            success: true,
            data: template_json(template, detailed: true)
          }
        else
          render json: { error: "Template no encontrado" }, status: :not_found
        end
      end

      private

      def template_json(template, detailed: false)
        json = {
          id: template.uuid,
          name: template.name,
          description: template.description,
          module_type: template.module_type,
          main_category: template.main_category,
          category: template.category,
          default_third_party_type: template.default_third_party_type,
          uses_third_party: template.uses_third_party_variables?,
          signatories_count: template.signatories.count,
          sequential_signing: template.sequential_signing != false,
          variables_count: template.variables&.count || 0
        }

        if detailed
          json[:variables] = template.variables
          json[:signatories] = template.signatories.by_position.map do |sig|
            {
              id: sig.uuid,
              label: sig.label,
              role: sig.role,
              signatory_type_code: sig.signatory_type_code,
              required: sig.required,
              position: sig.position
            }
          end
        end

        json
      end
    end
  end
end
