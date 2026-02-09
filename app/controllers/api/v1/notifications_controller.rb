# frozen_string_literal: true

module Api
  module V1
    class NotificationsController < BaseController
      # GET /api/v1/notifications
      def index
        notifications = Notification.for_user(current_user)
          .where(organization: current_organization)
          .recent

        render json: {
          data: notifications.map { |n| notification_json(n) },
          meta: {
            unread_count: Notification.for_user(current_user)
              .where(organization: current_organization)
              .unread.count
          }
        }
      end

      # POST /api/v1/notifications/mark_all_read
      def mark_all_read
        Notification.mark_all_read!(current_user, current_organization)

        render json: { message: "All notifications marked as read" }
      end

      # PATCH /api/v1/notifications/:id/read
      def read
        notification = Notification.for_user(current_user)
          .where(uuid: params[:id]).first

        return render json: { error: "Notification not found" }, status: :not_found unless notification

        notification.mark_as_read!

        render json: { data: notification_json(notification) }
      end

      private

      def notification_json(notification)
        {
          id: notification.uuid,
          category: notification.category,
          action: notification.action,
          title: notification.title,
          body: notification.body,
          read: notification.read?,
          link: notification.link,
          actor_name: notification.actor_name,
          created_at: notification.created_at.iso8601
        }
      end
    end
  end
end
