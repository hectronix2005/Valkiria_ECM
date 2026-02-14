# frozen_string_literal: true

module System
  class ErrorLog
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "system_error_logs"

    # Error info
    field :error_class, type: String
    field :message, type: String
    field :backtrace, type: Array, default: []
    field :source, type: String # controller, service, job, middleware
    field :severity, type: String, default: "error" # fatal, error, warning, info
    field :event_type, type: String, default: "exception" # exception, process_failure, validation_error, auth_failure, not_found, api_error

    # Response context
    field :http_status, type: Integer
    field :response_body, type: String

    # Request context
    field :controller_name, type: String
    field :action_name, type: String
    field :request_path, type: String
    field :request_method, type: String
    field :request_params, type: Hash, default: {}
    field :user_id, type: String
    field :user_email, type: String
    field :ip_address, type: String
    field :user_agent, type: String
    field :request_id, type: String

    # Extra data
    field :metadata, type: Hash, default: {}

    # Resolution
    field :resolved, type: Boolean, default: false
    field :resolved_at, type: DateTime
    field :resolved_by, type: String

    # Indexes
    index({ error_class: 1 })
    index({ severity: 1 })
    index({ source: 1 })
    index({ event_type: 1 })
    index({ http_status: 1 })
    index({ created_at: -1 })
    index({ resolved: 1 })
    index({ user_id: 1 })
    index({ request_id: 1 })

    # Validations
    validates :message, presence: true
    validates :severity, inclusion: { in: %w[fatal error warning info] }
    validates :event_type, inclusion: { in: %w[exception process_failure validation_error auth_failure not_found api_error] }, allow_nil: true

    # Scopes
    scope :unresolved, -> { where(resolved: false) }
    scope :resolved_only, -> { where(resolved: true) }
    scope :by_severity, ->(sev) { where(severity: sev) }
    scope :by_source, ->(src) { where(source: src) }
    scope :by_event_type, ->(type) { where(event_type: type) }
    scope :exceptions_only, -> { where(event_type: "exception") }
    scope :process_failures, -> { where(event_type: "process_failure") }
    scope :recent, -> { order(created_at: :desc) }
    scope :since, ->(time) { where(:created_at.gte => time) }

    def resolve!(user)
      update(
        resolved: true,
        resolved_at: Time.current,
        resolved_by: user.respond_to?(:email) ? user.email : user.to_s
      )
    end

    def self.cleanup_old!(days = 90)
      where(:created_at.lt => days.days.ago).delete_all
    end
  end
end
