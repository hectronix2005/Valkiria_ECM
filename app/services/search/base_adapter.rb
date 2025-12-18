# frozen_string_literal: true

module Search
  # Abstract base class for search adapters
  # Defines the interface that all search backends must implement
  #
  # This adapter pattern allows plugging in different search backends:
  # - MongoAdapter: Uses MongoDB queries (current implementation)
  # - ElasticsearchAdapter: For full-text search (future)
  # - MeilisearchAdapter: Alternative full-text (future)
  # - TypesenseAdapter: Another alternative (future)
  #
  class BaseAdapter
    attr_reader :options

    def initialize(options = {})
      @options = options
    end

    # Search for documents matching the given query
    #
    # @param query [Search::Query] The search query object
    # @return [Search::Results] The search results
    def search(query)
      raise NotImplementedError, "#{self.class}#search must be implemented"
    end

    # Index a document for searching
    # Used by full-text backends to update their index
    #
    # @param document [Content::Document] The document to index
    # @return [Boolean] Success status
    # rubocop:disable Naming/PredicateMethod
    def index_document(_document)
      # Default no-op for backends that don't need indexing (like MongoDB)
      true
    end

    # Remove a document from the search index
    #
    # @param document [Content::Document] The document to remove
    # @return [Boolean] Success status
    def remove_document(_document)
      # Default no-op for backends that don't need index management
      true
    end
    # rubocop:enable Naming/PredicateMethod

    # Reindex all documents
    # Used during initial setup or after schema changes
    #
    # @param scope [Mongoid::Criteria] Optional scope to limit reindexing
    # @return [Integer] Number of documents reindexed
    def reindex_all(_scope = nil)
      # Default no-op
      0
    end

    # Check if the search backend is available
    #
    # @return [Boolean] Health status
    def healthy?
      raise NotImplementedError, "#{self.class}#healthy? must be implemented"
    end

    # Get adapter name for identification
    #
    # @return [String] Adapter name
    def adapter_name
      self.class.name.demodulize.underscore.sub(/_adapter$/, "")
    end

    # Check if this adapter supports full-text search
    #
    # @return [Boolean]
    def supports_full_text?
      false
    end

    # Check if this adapter supports highlighting
    #
    # @return [Boolean]
    def supports_highlighting?
      false
    end

    # Check if this adapter supports faceted search
    #
    # @return [Boolean]
    def supports_facets?
      false
    end

    protected

    # Build base scope with organization filter
    def base_scope(organization_id)
      Content::Document.active.by_organization(organization_id)
    end

    # Apply permission filters to scope
    def apply_permission_filters(scope, user, options = {})
      return scope if user.admin?

      # For non-admin users, filter based on folder access
      # This is a simplified implementation - can be extended with ACLs
      if options[:folder_ids].present?
        scope.where(:folder_id.in => options[:folder_ids])
      else
        scope
      end
    end
  end
end
