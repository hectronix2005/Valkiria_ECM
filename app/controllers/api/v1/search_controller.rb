# frozen_string_literal: true

module Api
  module V1
    # Global search endpoint
    class SearchController < BaseController
      # GET /api/v1/search?q=query&type=documents,folders&page=1&per_page=20
      def index
        return render json: { error: "Search query (q) is required" }, status: :bad_request if params[:q].blank?

        results = search_service.search(
          params[:q],
          types: search_types,
          filters: search_filters,
          page: params[:page]&.to_i || 1,
          per_page: params[:per_page]&.to_i || 20
        )

        render json: {
          data: format_results(results),
          meta: {
            query: params[:q],
            total: results.total_count,
            page: results.current_page,
            per_page: results.per_page,
            total_pages: results.total_pages
          }
        }
      end

      private

      def search_service
        @search_service ||= Search::SearchService.new(
          organization: current_organization,
          user: current_user
        )
      end

      def search_types
        return nil if params[:type].blank?

        params[:type].split(",").map(&:strip)
      end

      def search_filters
        filters = {}
        filters[:folder_id] = params[:folder_id] if params[:folder_id].present?
        filters[:status] = params[:status] if params[:status].present?
        filters[:created_after] = params[:created_after] if params[:created_after].present?
        filters[:created_before] = params[:created_before] if params[:created_before].present?
        filters
      end

      def format_results(results)
        results.items.map do |item|
          {
            id: item.uuid,
            type: item.class.name.demodulize.underscore,
            title: item.respond_to?(:title) ? item.title : item.name,
            snippet: results.snippet_for(item),
            score: results.score_for(item),
            created_at: item.created_at.iso8601,
            url: item_url(item)
          }
        end
      end

      def item_url(item)
        case item
        when Content::Document
          "/documents/#{item.uuid}"
        when Content::Folder
          "/folders/#{item.uuid}"
        end
      end
    end
  end
end
