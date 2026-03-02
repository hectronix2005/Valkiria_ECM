# frozen_string_literal: true

module Api
  module V1
    module Admin
      class ErrorLogsController < BaseController
        before_action :require_admin
        before_action :set_error_log, only: [:show, :resolve]

        # GET /api/v1/admin/error_logs
        def index
          logs = ::System::ErrorLog.recent

          # Filters
          if (search_term = sanitized_search(:search))
            search = Regexp.escape(search_term)
            logs = logs.or(
              { error_class: /#{search}/i },
              { message: /#{search}/i },
              { request_path: /#{search}/i },
              { user_email: /#{search}/i }
            )
          end

          logs = logs.by_severity(params[:severity]) if params[:severity].present?
          logs = logs.by_source(params[:source]) if params[:source].present?
          logs = logs.by_event_type(params[:event_type]) if params[:event_type].present?

          if params[:http_status].present?
            logs = logs.where(http_status: params[:http_status].to_i)
          end

          if params[:resolved].present?
            logs = params[:resolved] == "true" ? logs.resolved_only : logs.unresolved
          end

          if params[:date_from].present?
            begin
              date_from = Time.zone.parse(params[:date_from])
              logs = logs.where(:created_at.gte => date_from.beginning_of_day)
            rescue ArgumentError
              # Invalid date format — ignore filter
            end
          end

          if params[:date_to].present?
            begin
              date_to = Time.zone.parse(params[:date_to])
              logs = logs.where(:created_at.lte => date_to.end_of_day)
            rescue ArgumentError
              # Invalid date format — ignore filter
            end
          end

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = [(params[:per_page] || 25).to_i, 100].min
          total = logs.count
          logs = logs.skip((page - 1) * per_page).limit(per_page)

          render json: {
            data: logs.map { |log| error_log_response(log) },
            meta: {
              total: total,
              page: page,
              per_page: per_page,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/admin/error_logs/:id
        def show
          render json: { data: error_log_response(@error_log, full: true) }
        end

        # POST /api/v1/admin/error_logs/:id/resolve
        def resolve
          @error_log.resolve!(current_user)
          render json: { data: error_log_response(@error_log), message: "Error marcado como resuelto" }
        end

        # POST /api/v1/admin/error_logs/resolve_all
        def resolve_all
          logs = ::System::ErrorLog.unresolved

          logs = logs.by_severity(params[:severity]) if params[:severity].present?
          logs = logs.by_source(params[:source]) if params[:source].present?
          logs = logs.by_event_type(params[:event_type]) if params[:event_type].present?

          count = logs.count
          logs.update_all(
            resolved: true,
            resolved_at: Time.current,
            resolved_by: current_user.email
          )

          render json: { message: "#{count} errores marcados como resueltos", count: count }
        end

        # GET /api/v1/admin/error_logs/patterns
        def patterns
          days = (params[:days] || 7).to_i
          limit = [(params[:limit] || 50).to_i, 100].min

          render json: { data: ErrorDiagnosticService.patterns(days: days, limit: limit) }
        end

        # GET /api/v1/admin/error_logs/stats
        def stats
          all_logs = ::System::ErrorLog.all

          render json: {
            data: {
              total: all_logs.count,
              unresolved: all_logs.unresolved.count,
              last_24h: all_logs.since(24.hours.ago).count,
              last_7d: all_logs.since(7.days.ago).count,
              by_severity: {
                fatal: all_logs.unresolved.by_severity("fatal").count,
                error: all_logs.unresolved.by_severity("error").count,
                warning: all_logs.unresolved.by_severity("warning").count,
                info: all_logs.unresolved.by_severity("info").count
              },
              by_event_type: {
                exception: all_logs.unresolved.by_event_type("exception").count,
                process_failure: all_logs.unresolved.by_event_type("process_failure").count,
                validation_error: all_logs.unresolved.by_event_type("validation_error").count,
                auth_failure: all_logs.unresolved.by_event_type("auth_failure").count,
                not_found: all_logs.unresolved.by_event_type("not_found").count,
                api_error: all_logs.unresolved.by_event_type("api_error").count,
                frontend_error: all_logs.unresolved.by_event_type("frontend_error").count
              },
              by_source: {
                controller: all_logs.unresolved.by_source("controller").count,
                service: all_logs.unresolved.by_source("service").count,
                job: all_logs.unresolved.by_source("job").count,
                middleware: all_logs.unresolved.by_source("middleware").count,
                frontend: all_logs.unresolved.by_source("frontend").count
              }
            }
          }
        end

        private

        def set_error_log
          @error_log = ::System::ErrorLog.find(params[:id])
        end

        def require_admin
          unless current_user&.admin?
            @_error_already_logged = true
            render json: { error: "No autorizado. Se requiere rol de administrador." }, status: :forbidden
          end
        end

        def error_log_response(log, full: false)
          diag = log.diagnosis
          response = {
            id: log.id.to_s,
            uuid: log.uuid,
            error_class: log.error_class,
            message: log.message.truncate(200),
            source: log.source,
            severity: log.severity,
            event_type: log.event_type,
            http_status: log.http_status,
            controller_name: log.controller_name,
            action_name: log.action_name,
            request_path: log.request_path,
            request_method: log.request_method,
            user_email: log.user_email,
            resolved: log.resolved,
            resolved_by: log.resolved_by,
            auto_resolved: diag["auto_resolved"] == true,
            priority: diag["priority"],
            created_at: log.created_at&.iso8601
          }

          if full
            response.merge!(
              message: log.message,
              backtrace: log.backtrace,
              response_body: log.response_body,
              request_params: log.request_params,
              user_id: log.user_id,
              ip_address: log.ip_address,
              user_agent: log.user_agent,
              request_id: log.request_id,
              metadata: log.metadata,
              resolved_at: log.resolved_at&.iso8601,
              resolved_by: log.resolved_by
            )
          end

          response
        end
      end
    end
  end
end
