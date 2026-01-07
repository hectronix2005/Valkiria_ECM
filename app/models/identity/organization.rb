# frozen_string_literal: true

module Identity
  class Organization
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable
    include SoftDeletable
    include AuditTrackable

    store_in collection: "organizations"

    # Fields
    field :name, type: String
    field :slug, type: String
    field :settings, type: Hash, default: {}
    field :active, type: Boolean, default: true

    # Organization details
    field :legal_name, type: String
    field :tax_id, type: String # NIT
    field :address, type: String
    field :city, type: String
    field :country, type: String, default: 'Colombia'
    field :phone, type: String
    field :email, type: String
    field :website, type: String
    field :logo_url, type: String

    # HR Settings
    field :vacation_days_per_year, type: Integer, default: 15
    field :vacation_accrual_policy, type: String, default: 'monthly' # monthly, yearly
    field :max_vacation_carryover, type: Integer, default: 15
    field :probation_period_months, type: Integer, default: 2

    # Document Settings
    field :allowed_file_types, type: Array, default: %w[pdf docx xlsx pptx jpg png]
    field :max_file_size_mb, type: Integer, default: 25
    field :document_retention_years, type: Integer, default: 10

    # Security Settings
    field :session_timeout_minutes, type: Integer, default: 480
    field :password_min_length, type: Integer, default: 8
    field :password_require_uppercase, type: Boolean, default: true
    field :password_require_number, type: Boolean, default: true
    field :password_require_special, type: Boolean, default: false
    field :max_login_attempts, type: Integer, default: 5

    # Indexes
    index({ slug: 1 }, { unique: true })
    index({ name: 1 })
    index({ active: 1 })

    # Associations
    has_many :users, class_name: "Identity::User", inverse_of: :organization

    # Validations
    validates :name, presence: true, length: { minimum: 2, maximum: 100 }
    validates :slug, presence: true, uniqueness: true,
                     format: { with: /\A[a-z0-9-]+\z/, message: "only lowercase letters, numbers, and hyphens" }

    # Callbacks
    before_validation :generate_slug, on: :create

    # Scopes
    scope :active, -> { where(active: true) }

    def activate!
      update!(active: true)
    end

    def deactivate!
      update!(active: false)
    end

    private

    def generate_slug
      return if slug.present?

      base_slug = name.to_s.parameterize
      self.slug = base_slug

      counter = 1
      while Identity::Organization.exists?(slug: slug)
        self.slug = "#{base_slug}-#{counter}"
        counter += 1
      end
    end
  end
end
