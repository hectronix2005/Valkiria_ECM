# frozen_string_literal: true

module Legal
  class ThirdPartyType
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    # Collection
    store_in collection: "legal_third_party_types"

    # Fields
    field :code, type: String       # provider, client, etc.
    field :name, type: String       # Display name
    field :description, type: String
    field :color, type: String, default: "gray"  # For UI badges
    field :icon, type: String, default: "building"
    field :active, type: Boolean, default: true
    field :is_system, type: Boolean, default: false  # System types cannot be deleted
    field :position, type: Integer, default: 0

    # Associations
    belongs_to :organization, class_name: "Identity::Organization"

    # Validations
    validates :code, presence: true, uniqueness: { scope: :organization_id }
    validates :name, presence: true

    # Indexes
    index({ organization_id: 1, active: 1 })
    index({ organization_id: 1, code: 1 }, unique: true)
    index({ position: 1 })

    # Scopes
    scope :active, -> { where(active: true) }
    scope :ordered, -> { order(position: :asc, name: :asc) }

    # Class methods
    def self.seed_defaults(organization)
      defaults = [
        { code: "provider", name: "Proveedor", description: "Proveedores de bienes y servicios", color: "blue", icon: "truck", position: 1 },
        { code: "client", name: "Cliente", description: "Clientes de la organización", color: "green", icon: "users", position: 2 },
        { code: "contractor", name: "Contratista", description: "Contratistas independientes", color: "purple", icon: "briefcase", position: 3 },
        { code: "partner", name: "Aliado", description: "Aliados estratégicos", color: "orange", icon: "handshake", position: 4 },
        { code: "other", name: "Otro", description: "Otros tipos de terceros", color: "gray", icon: "building", position: 5 }
      ]

      defaults.each do |attrs|
        existing = where(organization_id: organization.id, code: attrs[:code]).first
        if existing
          existing.update(attrs.except(:code).merge(is_system: true))
        else
          create!(attrs.merge(organization_id: organization.id, is_system: true))
        end
      end
    end

    # Instance methods
    def deletable?
      !is_system && Legal::ThirdParty.where(organization_id: organization_id, third_party_type: code).count.zero?
    end

    def toggle_active!
      update!(active: !active)
    end
  end
end
