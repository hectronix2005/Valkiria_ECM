# frozen_string_literal: true

module Search
  # Main search service that coordinates search operations
  # Uses the configured adapter to perform searches
  #
  # Usage:
  #   service = Search::SearchService.new(user: current_user, organization: current_org)
  #   results = service.search("quarterly report", filters: { status: "published" })
  #
  # Or with the class method:
  #   results = Search::SearchService.search(
  #     text: "quarterly report",
  #     user: current_user,
  #     organization_id: org.id,
  #     filters: { tags: ["finance"] }
  #   )
  #
  class SearchService
    attr_reader :adapter, :user, :organization_id

    # Configure the default adapter
    class << self
      attr_accessor :default_adapter_class

      def search(params)
        new(
          user: params[:user],
          organization_id: params[:organization_id] || params[:user]&.organization_id
        ).search(params[:text] || params[:q], params.except(:user, :organization_id, :text, :q))
      end

      def default_adapter
        @default_adapter ||= Adapters::MongoAdapter
      end
    end

    def initialize(user:, organization_id: nil, adapter: nil)
      @user = user
      @organization_id = organization_id || user&.organization_id
      @adapter = adapter || self.class.default_adapter.new
    end

    # Perform a search
    #
    # @param text [String] The search text (optional)
    # @param options [Hash] Search options
    # @option options [Hash] :filters Field filters
    # @option options [Symbol, Hash] :sort Sort order
    # @option options [Integer] :page Page number
    # @option options [Integer] :per_page Results per page
    # @return [Search::Results]
    #
    def search(text = nil, options = {})
      query = build_query(text, options)

      # Log search for audit trail
      log_search(query)

      adapter.search(query)
    end

    # Search by title/name
    def search_by_title(title, options = {})
      search(nil, options.merge(filters: (options[:filters] || {}).merge(title: title)))
    end

    # Search by tags
    def search_by_tags(tags, options = {})
      search(nil, options.merge(filters: (options[:filters] || {}).merge(tags: Array(tags))))
    end

    # Search by metadata
    def search_by_metadata(metadata, options = {})
      search(nil, options.merge(filters: (options[:filters] || {}).merge(metadata: metadata)))
    end

    # Search within a specific folder
    def search_in_folder(folder_or_id, text = nil, options = {})
      folder_id = folder_or_id.is_a?(Content::Folder) ? folder_or_id.id : folder_or_id
      search(text, options.merge(filters: (options[:filters] || {}).merge(folder_id: folder_id)))
    end

    # Search within multiple folders
    def search_in_folders(folder_ids, text = nil, options = {})
      ids = folder_ids.map { |f| f.is_a?(Content::Folder) ? f.id : f }
      search(text, options.merge(filters: (options[:filters] || {}).merge(folder_ids: ids)))
    end

    # Get documents by status
    def by_status(status, options = {})
      search(nil, options.merge(filters: (options[:filters] || {}).merge(status: status)))
    end

    # Get recent documents
    def recent(limit = 10)
      search(nil, sort: :newest, per_page: limit)
    end

    # Get documents created by a specific user
    def by_creator(user_or_id, options = {})
      creator_id = user_or_id.is_a?(Identity::User) ? user_or_id.id : user_or_id
      search(nil, options.merge(filters: (options[:filters] || {}).merge(created_by_id: creator_id)))
    end

    # Advanced search with multiple criteria
    #
    # @param criteria [Hash] Search criteria
    # @option criteria [String] :text Free text search
    # @option criteria [String] :title Title filter
    # @option criteria [Array<String>] :tags Tag filters
    # @option criteria [String] :status Status filter
    # @option criteria [String] :document_type Document type filter
    # @option criteria [Hash] :metadata Metadata filters
    # @option criteria [Time] :created_after Created after date
    # @option criteria [Time] :created_before Created before date
    #
    def advanced_search(criteria = {})
      text = criteria.delete(:text) || criteria.delete(:q)
      filters = criteria.slice(*Query::SUPPORTED_FILTERS)
      options = criteria.except(*Query::SUPPORTED_FILTERS)

      search(text, options.merge(filters: filters))
    end

    # Check if adapter is healthy
    delegate :healthy?, to: :adapter

    private

    def build_query(text, options)
      Query.new(
        text: text,
        filters: options[:filters] || {},
        sort: options[:sort],
        page: options[:page],
        per_page: options[:per_page],
        user: user,
        organization_id: organization_id,
        include_deleted: options[:include_deleted],
        highlight: options[:highlight],
        facets: options[:facets]
      )
    end

    def log_search(query)
      return unless query.valid?

      Audit::AuditEvent.create(
        event_type: Audit::AuditEvent::TYPES[:content],
        action: "search_performed",
        actor_id: user&.id,
        actor_type: user&.class&.name,
        actor_email: user.try(:email),
        organization_id: organization_id,
        metadata: {
          search_text: query.text.presence,
          filters: query.filters,
          adapter: adapter.adapter_name
        },
        tags: ["search"]
      )
    rescue StandardError => e
      Rails.logger.warn("Failed to log search audit: #{e.message}")
    end
  end
end
