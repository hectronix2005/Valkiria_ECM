# frozen_string_literal: true

module Api
  module V1
    module Admin
      class AgentAlertsController < BaseController
        before_action :require_admin
        before_action :set_alert, only: [:show, :resolve]

        # GET /api/v1/admin/agent_alerts
        def index
          alerts = AgentAlert.recent

          # Filters
          alerts = alerts.where(agent_id: params[:agent_id]) if params[:agent_id].present?
          alerts = alerts.where(alert_type: params[:alert_type]) if params[:alert_type].present?

          if params[:resolved].present?
            alerts = params[:resolved] == "true" ? alerts.resolved : alerts.unresolved
          end

          if params[:search].present?
            search = Regexp.escape(params[:search])
            alerts = alerts.or(
              { message: /#{search}/i },
              { agent_id: /#{search}/i },
              { "metadata.service" => /#{search}/i }
            )
          end

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = [(params[:per_page] || 25).to_i, 100].min
          total = alerts.count
          alerts = alerts.skip((page - 1) * per_page).limit(per_page)

          render json: {
            data: alerts.map { |a| alert_response(a) },
            meta: {
              total: total,
              page: page,
              per_page: per_page,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/admin/agent_alerts/:id
        def show
          render json: { data: alert_response(@alert, full: true) }
        end

        # POST /api/v1/admin/agent_alerts/:id/resolve
        def resolve
          @alert.resolve!(current_user.id)
          render json: { data: alert_response(@alert), message: "Alerta resuelta" }
        end

        # POST /api/v1/admin/agent_alerts/resolve_all
        def resolve_all
          scope = AgentAlert.unresolved
          scope = scope.where(agent_id: params[:agent_id]) if params[:agent_id].present?
          scope = scope.where(alert_type: params[:alert_type]) if params[:alert_type].present?

          count = scope.count
          scope.each { |a| a.resolve!(current_user.id) }

          render json: { message: "#{count} alertas resueltas", count: count }
        end

        # GET /api/v1/admin/agent_alerts/summary
        def summary
          render json: { data: AgentAlert.dashboard_summary }
        end

        # GET /api/v1/admin/agent_alerts/health
        def health
          # Run a live health check (same as ServiceHealthAgent but synchronous)
          agent = ServiceHealthAgent.new(event_type: "manual.health_check")
          result = agent.execute

          render json: {
            data: {
              checks: result[:checks],
              failures: result[:failures],
              status: result[:status],
              duration_ms: result[:duration_ms],
              checked_at: Time.current.iso8601
            }
          }
        end

        private

        def set_alert
          @alert = AgentAlert.find(params[:id])
        end

        def require_admin
          unless current_user&.admin?
            @_error_already_logged = true
            render json: { error: "No autorizado. Se requiere rol de administrador." }, status: :forbidden
          end
        end

        def alert_response(alert, full: false)
          response = {
            id: alert.id.to_s,
            agent_id: alert.agent_id,
            alert_type: alert.alert_type,
            message: alert.message,
            resolved: alert.resolved,
            created_at: alert.created_at&.iso8601,
            occurrence_count: alert.metadata&.dig("occurrence_count") || 1,
            service: alert.metadata&.dig("service"),
            pattern_key: alert.metadata&.dig("pattern_key")
          }

          if full
            response.merge!(
              document_id: alert.document_id&.to_s,
              resolved_by: alert.resolved_by&.to_s,
              resolved_at: alert.resolved_at&.iso8601,
              metadata: alert.metadata
            )
          end

          response
        end
      end
    end
  end
end
