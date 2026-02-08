# frozen_string_literal: true

module Identity
  class Company
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    # Collection
    store_in collection: "identity_companies"

    # Fields
    field :name, type: String
    field :nit, type: String
    field :active, type: Boolean, default: true

    # Associations
    belongs_to :organization, class_name: "Identity::Organization"

    # Validations
    validates :name, presence: true
    validates :nit, uniqueness: { scope: :organization_id }, allow_blank: true

    # Indexes
    index({ organization_id: 1, active: 1 })
    index({ organization_id: 1, nit: 1 }, unique: true, sparse: true)

    # Scopes
    scope :active, -> { where(active: true) }
    scope :ordered, -> { order(name: :asc) }
  end
end
