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
