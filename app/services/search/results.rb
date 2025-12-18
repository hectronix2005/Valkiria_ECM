# frozen_string_literal: true

module Search
  # Represents search results with pagination and metadata
  #
  class Results
    include Enumerable

    attr_reader :documents, :total_count, :page, :per_page, :query_time_ms,
                :facets, :highlights, :metadata

    def initialize(documents:, total_count:, page:, per_page:, query_time_ms: 0, **options)
      @documents = documents
      @total_count = total_count
      @page = page
      @per_page = per_page
      @query_time_ms = query_time_ms
      @facets = options[:facets] || {}
      @highlights = options[:highlights] || {}
      @metadata = options[:metadata] || {}
    end

    def each(&)
      documents.each(&)
    end

    delegate :empty?, to: :documents

    delegate :size, to: :documents

    alias count size

    def total_pages
      return 0 if total_count.zero?

      (total_count.to_f / per_page).ceil
    end

    def current_page
      page
    end

    def next_page
      page < total_pages ? page + 1 : nil
    end

    def prev_page
      page > 1 ? page - 1 : nil
    end

    def first_page?
      page == 1
    end

    def last_page?
      page >= total_pages
    end

    def offset
      (page - 1) * per_page
    end

    def has_more? # rubocop:disable Naming/PredicatePrefix
      !last_page?
    end

    # Get highlight for a specific document
    def highlight_for(document)
      highlights[document.id.to_s] || {}
    end

    # Pagination info for API responses
    def pagination
      {
        current_page: page,
        per_page: per_page,
        total_pages: total_pages,
        total_count: total_count,
        has_next: has_more?,
        has_prev: prev_page.present?
      }
    end

    # Full response for API
    def to_h
      {
        documents: documents.map { |d| document_to_h(d) },
        pagination: pagination,
        facets: facets,
        metadata: metadata.merge(query_time_ms: query_time_ms)
      }
    end

    # Create empty results
    def self.empty(page: 1, per_page: 20)
      new(
        documents: [],
        total_count: 0,
        page: page,
        per_page: per_page
      )
    end

    private

    def document_to_h(doc)
      {
        id: doc.id.to_s,
        uuid: doc.uuid,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        document_type: doc.document_type,
        tags: doc.tags,
        folder_id: doc.folder_id&.to_s,
        created_at: doc.created_at&.iso8601,
        updated_at: doc.updated_at&.iso8601,
        version_count: doc.version_count,
        score: doc.try(:search_score)
      }.compact
    end
  end
end
