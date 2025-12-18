# frozen_string_literal: true

module Search
  module Adapters
    # MongoDB-based search adapter
    # Uses MongoDB queries for field-based search with regex support
    #
    # This adapter is suitable for:
    # - Small to medium datasets (< 100k documents)
    # - Field-based filtering (status, tags, metadata)
    # - Simple text matching on titles and descriptions
    #
    # For large datasets or complex full-text search, consider:
    # - ElasticsearchAdapter
    # - MeilisearchAdapter
    #
    # rubocop:disable Metrics/ClassLength
    class MongoAdapter < BaseAdapter
      # Score weights for ranking
      SCORE_WEIGHTS = {
        title_exact: 100,      # Exact title match
        title_starts: 80,      # Title starts with query
        title_contains: 50,    # Title contains query
        description: 30,       # Description match
        tags: 40,              # Tag match
        metadata: 20,          # Metadata match
        recency_bonus: 10      # Bonus for recent documents
      }.freeze

      def search(query)
        return invalid_query_result(query) unless query.valid?

        start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

        scope = build_scope(query)
        total_count = scope.count

        # Apply sorting and pagination
        results = apply_sorting(scope, query)
          .skip(query.offset)
          .limit(query.per_page)
          .to_a

        # Calculate scores for ranking
        scored_results = calculate_scores(results, query)

        query_time = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round(2)

        Results.new(
          documents: scored_results,
          total_count: total_count,
          page: query.page,
          per_page: query.per_page,
          query_time_ms: query_time,
          metadata: build_metadata(query, scope)
        )
      end

      def healthy?
        Content::Document.collection.database.command(ping: 1)
        true
      rescue StandardError
        false
      end

      def supports_full_text?
        # MongoDB supports text indexes, but we're using regex for more control
        false
      end

      private

      def invalid_query_result(query)
        Results.new(
          documents: [],
          total_count: 0,
          page: query.page,
          per_page: query.per_page,
          metadata: { errors: query.errors }
        )
      end

      def build_scope(query)
        scope = base_scope_for_query(query)
        scope = apply_text_search(scope, query) if query.text?
        scope = apply_filters(scope, query)
        apply_permission_filters(scope, query.user, folder_ids: query.filter(:folder_ids))
      end

      def base_scope_for_query(query)
        if query.include_deleted
          Content::Document.unscoped.where(organization_id: query.organization_id)
        else
          Content::Document.where(organization_id: query.organization_id, deleted_at: nil)
        end
      end

      def apply_text_search(scope, query)
        text = Regexp.escape(query.text)
        regex = /#{text}/i

        # Search in title, description, tags, and document_type using $or
        # We need to use and() to combine with existing criteria properly
        scope.and(
          "$or" => [
            { title: regex },
            { description: regex },
            { tags: regex },
            { document_type: regex }
          ]
        )
      end

      # rubocop:disable Metrics/AbcSize, Metrics/PerceivedComplexity
      def apply_filters(scope, query)
        filters = query.filters

        # Title/name filter (exact or partial)
        if filters[:title].present?
          scope = scope.where(title: /#{Regexp.escape(filters[:title])}/i)
        elsif filters[:name].present?
          scope = scope.where(title: /#{Regexp.escape(filters[:name])}/i)
        end

        # Tags filter (match any)
        scope = scope.where(:tags.in => Array(filters[:tags])) if filters[:tags].present?

        # Status filter
        scope = scope.where(status: filters[:status]) if filters[:status].present?

        # Document type filter
        scope = scope.where(document_type: filters[:document_type]) if filters[:document_type].present?

        # Folder filters
        if filters[:folder_ids].present?
          scope = scope.where(:folder_id.in => filters[:folder_ids])
        elsif filters[:folder_id].present?
          scope = scope.where(folder_id: filters[:folder_id])
        end

        # Creator filter
        scope = scope.where(created_by_id: filters[:created_by_id]) if filters[:created_by_id].present?

        # Metadata filters (nested hash search)
        scope = apply_metadata_filters(scope, filters[:metadata]) if filters[:metadata].present?

        # Date range filters
        apply_date_filters(scope, filters)
      end
      # rubocop:enable Metrics/AbcSize, Metrics/PerceivedComplexity

      def apply_metadata_filters(scope, metadata)
        metadata.each do |key, value|
          # Sanitize key to prevent injection (only allow alphanumeric and underscore)
          sanitized_key = key.to_s.gsub(/[^a-zA-Z0-9_]/, "")
          next if sanitized_key.empty?

          scope = scope.where("metadata.#{sanitized_key}" => value) # brakeman:disable SQLInjection
        end
        scope
      end

      def apply_date_filters(scope, filters)
        scope = scope.where(:created_at.gte => filters[:created_after]) if filters[:created_after]
        scope = scope.where(:created_at.lte => filters[:created_before]) if filters[:created_before]
        scope = scope.where(:updated_at.gte => filters[:updated_after]) if filters[:updated_after]
        scope = scope.where(:updated_at.lte => filters[:updated_before]) if filters[:updated_before]
        scope
      end

      def apply_sorting(scope, query)
        if query.text? && query.sort == Search::Query::SORT_OPTIONS[:relevance]
          # For relevance sorting with text search, we'll sort by score later
          scope.order(updated_at: :desc)
        else
          scope.order(query.sort)
        end
      end

      # rubocop:disable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity
      def calculate_scores(documents, query)
        return documents unless query.text?

        text = query.text.downcase
        now = Time.current

        scored = documents.map do |doc|
          score = 0

          # Title scoring
          title_lower = doc.title.to_s.downcase
          if title_lower == text
            score += SCORE_WEIGHTS[:title_exact]
          elsif title_lower.start_with?(text)
            score += SCORE_WEIGHTS[:title_starts]
          elsif title_lower.include?(text)
            score += SCORE_WEIGHTS[:title_contains]
          end

          # Description scoring
          score += SCORE_WEIGHTS[:description] if doc.description.to_s.downcase.include?(text)

          # Tags scoring
          score += SCORE_WEIGHTS[:tags] if doc.tags.any? { |tag| tag.to_s.downcase.include?(text) }

          # Metadata scoring
          score += SCORE_WEIGHTS[:metadata] if doc.metadata.to_s.downcase.include?(text)

          # Recency bonus (documents updated in last 7 days get bonus)
          if doc.updated_at && doc.updated_at > 7.days.ago
            days_old = [(now - doc.updated_at) / 1.day, 1].max
            recency_score = (SCORE_WEIGHTS[:recency_bonus] / days_old).round
            score += recency_score
          end

          # Attach score to document for display
          doc.define_singleton_method(:search_score) { score }
          doc
        end

        # Sort by score descending if relevance sorting
        if query.sort == Search::Query::SORT_OPTIONS[:relevance]
          scored.sort_by { |doc| -doc.search_score }
        else
          scored
        end
      end
      # rubocop:enable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity

      def build_metadata(query, _scope)
        {
          adapter: adapter_name,
          query_text: query.text,
          filters_applied: query.filters.keys,
          sort: query.sort
        }
      end
    end
    # rubocop:enable Metrics/ClassLength
  end
end
