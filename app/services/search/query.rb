# frozen_string_literal: true

module Search
  # Represents a search query with all parameters
  # Provides a clean interface for building complex search queries
  #
  class Query
    attr_accessor :text, :filters, :sort, :page, :per_page, :user, :organization_id,
                  :include_deleted, :highlight, :facets

    # Filter keys that are supported
    SUPPORTED_FILTERS = [
      :title,
      :name,
      :tags,
      :status,
      :document_type,
      :folder_id,
      :folder_ids,
      :created_by_id,
      :metadata,
      :created_after,
      :created_before,
      :updated_after,
      :updated_before
    ].freeze

    # Sort options
    SORT_OPTIONS = {
      relevance: { _score: :desc },
      newest: { created_at: :desc },
      oldest: { created_at: :asc },
      title_asc: { title: :asc },
      title_desc: { title: :desc },
      updated: { updated_at: :desc }
    }.freeze

    # rubocop:disable Metrics/PerceivedComplexity
    def initialize(params = {})
      @text = params[:text] || params[:q] || ""
      @filters = normalize_filters(params[:filters] || {})
      @sort = normalize_sort(params[:sort])
      @page = (params[:page] || 1).to_i
      @per_page = [(params[:per_page] || 20).to_i, 100].min
      @user = params[:user]
      @organization_id = params[:organization_id]
      @include_deleted = params[:include_deleted] || false
      @highlight = params[:highlight] || false
      @facets = params[:facets] || []
    end
    # rubocop:enable Metrics/PerceivedComplexity

    def text?
      text.present? && text.length >= 2
    end

    def has_filters? # rubocop:disable Naming/PredicatePrefix
      filters.any?
    end

    def filter(key)
      filters[key.to_sym]
    end

    def add_filter(key, value)
      @filters[key.to_sym] = value if SUPPORTED_FILTERS.include?(key.to_sym)
      self
    end

    def remove_filter(key)
      @filters.delete(key.to_sym)
      self
    end

    def offset
      (page - 1) * per_page
    end

    def sort_field
      sort.keys.first
    end

    def sort_direction
      sort.values.first
    end

    def valid?
      errors.empty?
    end

    def errors
      errs = []
      errs << "Organization ID is required" if organization_id.blank?
      errs << "User is required" if user.blank?
      errs << "Search text too short (minimum 2 characters)" if text.present? && text.length < 2
      errs << "Page must be positive" if page < 1
      errs << "Per page must be positive" if per_page < 1
      errs
    end

    def to_h
      {
        text: text,
        filters: filters,
        sort: sort,
        page: page,
        per_page: per_page,
        organization_id: organization_id&.to_s,
        include_deleted: include_deleted
      }
    end

    private

    # rubocop:disable Metrics/CyclomaticComplexity, Metrics/MethodLength
    def normalize_filters(raw_filters)
      normalized = {}
      raw_filters.each do |key, value|
        sym_key = key.to_sym
        next unless SUPPORTED_FILTERS.include?(sym_key)
        next if value.blank?

        normalized[sym_key] = case sym_key
                              when :tags
                                Array(value)
                              when :folder_ids
                                Array(value).map { |id| normalize_id(id) }
                              when :folder_id, :created_by_id
                                normalize_id(value)
                              when :metadata
                                value.is_a?(Hash) ? value : {}
                              when :created_after, :created_before, :updated_after, :updated_before
                                parse_time(value)
                              else
                                value
                              end
      end
      normalized
    end
    # rubocop:enable Metrics/CyclomaticComplexity, Metrics/MethodLength

    # rubocop:disable Metrics/PerceivedComplexity
    def normalize_sort(sort_param)
      return SORT_OPTIONS[:relevance] if sort_param.blank?

      if sort_param.is_a?(Hash)
        sort_param.transform_keys(&:to_sym).transform_values(&:to_sym)
      elsif sort_param.is_a?(Symbol) || sort_param.is_a?(String)
        SORT_OPTIONS[sort_param.to_sym] || SORT_OPTIONS[:relevance]
      else
        SORT_OPTIONS[:relevance]
      end
    end
    # rubocop:enable Metrics/PerceivedComplexity

    def normalize_id(value)
      return value if value.is_a?(BSON::ObjectId)

      BSON::ObjectId.from_string(value.to_s)
    rescue BSON::Error::InvalidObjectId
      nil
    end

    def parse_time(value)
      return value if value.is_a?(Time) || value.is_a?(DateTime)

      Time.zone.parse(value.to_s)
    rescue ArgumentError
      nil
    end
  end
end
