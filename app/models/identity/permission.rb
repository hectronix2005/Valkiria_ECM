# frozen_string_literal: true

module Identity
  class Permission
    include Mongoid::Document
    include Mongoid::Timestamps

    store_in collection: "permissions"

    # Fields
    field :name, type: String
    field :resource, type: String
    field :action, type: String
    field :description, type: String

    # Indexes
    index({ name: 1 }, { unique: true })
    index({ resource: 1, action: 1 }, { unique: true })

    # Associations
    has_and_belongs_to_many :roles, class_name: "Identity::Role", inverse_of: :permissions

    # Validations
    validates :name, presence: true, uniqueness: true
    validates :resource, presence: true
    validates :action, presence: true
    validates :resource, uniqueness: { scope: :action }

    # Standard actions
    ACTIONS = ["create", "read", "update", "delete", "manage", "export"].freeze

    # Standard resources
    RESOURCES = [
      "users", "roles", "organizations", "documents", "folders",
      "workflows", "audit_logs", "settings", "hr_requests", "legal_documents"
    ].freeze

    scope :for_resource, ->(resource) { where(resource: resource) }
    scope :for_action, ->(action) { where(action: action) }

    class << self
      def seed_defaults!
        default_permissions.each do |attrs|
          find_or_create_by!(name: attrs[:name]) do |p|
            p.resource = attrs[:resource]
            p.action = attrs[:action]
            p.description = attrs[:description]
          end
        end
      end

      private

      def default_permissions
        [
          # User management
          { name: "users.read", resource: "users", action: "read", description: "View users" },
          { name: "users.create", resource: "users", action: "create", description: "Create users" },
          { name: "users.update", resource: "users", action: "update", description: "Update users" },
          { name: "users.delete", resource: "users", action: "delete", description: "Delete users" },
          { name: "users.manage", resource: "users", action: "manage", description: "Full user management" },

          # Document management
          { name: "documents.read", resource: "documents", action: "read", description: "View documents" },
          { name: "documents.create", resource: "documents", action: "create", description: "Create documents" },
          { name: "documents.update", resource: "documents", action: "update", description: "Update documents" },
          { name: "documents.delete", resource: "documents", action: "delete", description: "Delete documents" },
          { name: "documents.manage", resource: "documents", action: "manage",
            description: "Full document management" },
          { name: "documents.export", resource: "documents", action: "export", description: "Export documents" },

          # Admin settings
          { name: "settings.read", resource: "settings", action: "read", description: "View settings" },
          { name: "settings.manage", resource: "settings", action: "manage", description: "Manage settings" },

          # HR management
          { name: "hr_requests.read", resource: "hr_requests", action: "read", description: "View HR requests" },
          { name: "hr_requests.manage", resource: "hr_requests", action: "manage", description: "Manage HR requests" },

          # Legal documents
          { name: "legal_documents.read", resource: "legal_documents", action: "read", description: "View legal docs" },
          { name: "legal_documents.manage", resource: "legal_documents", action: "manage",
            description: "Manage legal docs" },

          # Audit logs
          { name: "audit_logs.read", resource: "audit_logs", action: "read", description: "View audit logs" }
        ]
      end
    end
  end
end
