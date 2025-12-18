# frozen_string_literal: true

module Identity
  class Role
    include Mongoid::Document
    include Mongoid::Timestamps

    store_in collection: "roles"

    # Predefined role names
    ADMIN = "admin"
    LEGAL = "legal"
    HR = "hr"
    EMPLOYEE = "employee"
    VIEWER = "viewer"

    ALL_ROLES = [ADMIN, LEGAL, HR, EMPLOYEE, VIEWER].freeze

    # Fields
    field :name, type: String
    field :display_name, type: String
    field :description, type: String
    field :system_role, type: Boolean, default: false
    field :level, type: Integer, default: 0

    # Indexes
    index({ name: 1 }, { unique: true })
    index({ level: -1 })

    # Associations
    has_and_belongs_to_many :users, class_name: "Identity::User", inverse_of: :roles
    has_and_belongs_to_many :permissions, class_name: "Identity::Permission", inverse_of: :roles

    # Validations
    validates :name, presence: true, uniqueness: true
    validates :display_name, presence: true

    # Scopes
    scope :system_roles, -> { where(system_role: true) }
    scope :custom_roles, -> { where(system_role: false) }
    scope :by_level, -> { order(level: :desc) }

    def admin?
      name == ADMIN
    end

    def has_permission?(permission_name)
      permissions.exists?(name: permission_name)
    end

    def can?(action, resource)
      # Admin can do everything
      return true if admin?

      # Check for manage permission (implies all actions)
      return true if permissions.exists?(resource: resource, action: "manage")

      # Check for specific permission
      permissions.exists?(resource: resource, action: action)
    end

    def permission_names
      permissions.pluck(:name)
    end

    class << self
      def seed_defaults!
        default_roles.each do |attrs|
          role = find_or_create_by!(name: attrs[:name]) do |r|
            r.display_name = attrs[:display_name]
            r.description = attrs[:description]
            r.system_role = true
            r.level = attrs[:level]
          end

          # Assign permissions
          assign_permissions(role, attrs[:permissions])
        end
      end

      def find_by_name(name)
        find_by(name: name)
      end

      def find_by_name!(name)
        find_by!(name: name)
      end

      private

      def assign_permissions(role, permission_names)
        return if permission_names.blank?

        permissions = Identity::Permission.where(:name.in => permission_names)
        role.permissions = permissions
        role.save!
      end

      def default_roles
        [
          {
            name: ADMIN,
            display_name: "Administrator",
            description: "Full system access with all permissions",
            level: 100,
            permissions: [] # Admin has implicit access to everything
          },
          {
            name: LEGAL,
            display_name: "Legal",
            description: "Access to legal documents and retention policies",
            level: 80,
            permissions: [
              "documents.read", "documents.create", "documents.update", "documents.export",
              "legal_documents.read", "legal_documents.manage",
              "audit_logs.read"
            ]
          },
          {
            name: HR,
            display_name: "Human Resources",
            description: "Access to HR requests and employee documents",
            level: 70,
            permissions: [
              "documents.read", "documents.create", "documents.update",
              "hr_requests.read", "hr_requests.manage",
              "users.read"
            ]
          },
          {
            name: EMPLOYEE,
            display_name: "Employee",
            description: "Standard employee access to documents",
            level: 50,
            permissions: [
              "documents.read", "documents.create", "documents.update",
              "hr_requests.read"
            ]
          },
          {
            name: VIEWER,
            display_name: "Viewer",
            description: "Read-only access to documents",
            level: 10,
            permissions: [
              "documents.read"
            ]
          }
        ]
      end
    end
  end
end
