# frozen_string_literal: true

module Api
  module V1
    module Admin
      class AuditLogsController < BaseController
        before_action :require_admin

        # GET /api/v1/admin/audit_logs
        def index
          logs = ::Audit::AuditEvent.recent

          # Search filter
          if params[:search].present?
            search = Regexp.escape(params[:search])
            logs = logs.or(
              { actor_email: /#{search}/i },
              { actor_name: /#{search}/i },
              { target_type: /#{search}/i },
              { action: /#{search}/i },
              { "metadata" => /#{search}/i }
            )
          end

          # Exact filters
          logs = logs.by_event_type(params[:event_type]) if params[:event_type].present?
          logs = logs.by_action(params[:action]) if params[:action].present?
          logs = logs.by_actor(params[:actor_id]) if params[:actor_id].present?
          logs = logs.where(target_type: params[:target_type]) if params[:target_type].present?

          # Date range
          if params[:date_from].present?
            logs = logs.where(:created_at.gte => Time.parse(params[:date_from]).beginning_of_day)
          end

          if params[:date_to].present?
            logs = logs.where(:created_at.lte => Time.parse(params[:date_to]).end_of_day)
          end

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = [(params[:per_page] || 25).to_i, 100].min
          total = logs.count
          logs = logs.skip((page - 1) * per_page).limit(per_page)

          render json: {
            data: logs.map { |log| audit_log_response(log) },
            meta: {
              total: total,
              page: page,
              per_page: per_page,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/admin/audit_logs/:id
        def show
          log = ::Audit::AuditEvent.find(params[:id])
          render json: { data: audit_log_response(log, full: true) }
        end

        # GET /api/v1/admin/audit_logs/stats
        def stats
          all_logs = ::Audit::AuditEvent.all

          # Top actors (last 30 days)
          top_actors_pipeline = [
            { "$match" => { "created_at" => { "$gte" => 30.days.ago } } },
            { "$group" => { "_id" => "$actor_email", "count" => { "$sum" => 1 } } },
            { "$sort" => { "count" => -1 } },
            { "$limit" => 10 }
          ]

          top_actors = ::Audit::AuditEvent.collection.aggregate(top_actors_pipeline).map do |doc|
            { email: doc["_id"], count: doc["count"] }
          end

          # By action (last 30 days)
          by_action_pipeline = [
            { "$match" => { "created_at" => { "$gte" => 30.days.ago } } },
            { "$group" => { "_id" => "$action", "count" => { "$sum" => 1 } } },
            { "$sort" => { "count" => -1 } }
          ]

          by_action = ::Audit::AuditEvent.collection.aggregate(by_action_pipeline).each_with_object({}) do |doc, hash|
            hash[doc["_id"]] = doc["count"]
          end

          # By event type (last 30 days)
          by_event_type_pipeline = [
            { "$match" => { "created_at" => { "$gte" => 30.days.ago } } },
            { "$group" => { "_id" => "$event_type", "count" => { "$sum" => 1 } } },
            { "$sort" => { "count" => -1 } }
          ]

          by_event_type = ::Audit::AuditEvent.collection.aggregate(by_event_type_pipeline).each_with_object({}) do |doc, hash|
            hash[doc["_id"]] = doc["count"]
          end

          render json: {
            data: {
              total: all_logs.count,
              today: all_logs.since(Time.current.beginning_of_day).count,
              last_7d: all_logs.since(7.days.ago).count,
              last_30d: all_logs.since(30.days.ago).count,
              by_event_type: by_event_type,
              by_action: by_action,
              top_actors: top_actors
            }
          }
        end

        private

        def require_admin
          unless current_user&.admin?
            @_error_already_logged = true
            render json: { error: "No autorizado. Se requiere rol de administrador." }, status: :forbidden
          end
        end

        def audit_log_response(log, full: false)
          response = {
            id: log.id.to_s,
            uuid: log.uuid,
            event_type: log.event_type,
            action: log.action,
            actor_email: log.actor_email,
            actor_name: log.actor_name,
            target_type: log.target_type,
            target_id: log.target_id&.to_s,
            ip_address: log.ip_address,
            created_at: log.created_at&.iso8601
          }

          if full
            response.merge!(
              actor_id: log.actor_id&.to_s,
              target_uuid: log.target_uuid,
              organization_id: log.organization_id&.to_s,
              change_data: log.change_data,
              previous_values: log.previous_values,
              new_values: log.new_values,
              request_id: log.request_id,
              user_agent: log.user_agent,
              session_id: log.session_id,
              metadata: log.metadata,
              tags: log.tags
            )
          end

          response
        end
      end
    end
  end
end
