# frozen_string_literal: true

module Identity
  class Role
    include Mongoid::Document
    include Mongoid::Timestamps

    store_in collection: "roles"

    # Predefined role names
    ADMIN = "admin"
    CEO = "ceo"
    GENERAL_MANAGER = "general_manager"
    LEGAL_REPRESENTATIVE = "legal_representative"
    LEGAL = "legal"
    HR_MANAGER = "hr_manager"
    HR = "hr"
    ACCOUNTANT = "accountant"
    MANAGER = "manager"
    EMPLOYEE = "employee"
    VIEWER = "viewer"

    ALL_ROLES = [ADMIN, CEO, GENERAL_MANAGER, LEGAL_REPRESENTATIVE, LEGAL, HR_MANAGER, HR, ACCOUNTANT, MANAGER, EMPLOYEE, VIEWER].freeze

    # Permission levels (1-5 scale)
    LEVEL_ADMIN = 5     # Full system access
    LEVEL_LEGAL = 4     # Legal department access
    LEVEL_HR = 3        # HR department access
    LEVEL_EMPLOYEE = 2  # Standard employee access
    LEVEL_VIEWER = 1    # Read-only access

    # Level to role mapping
    LEVELS = {
      LEVEL_ADMIN => ADMIN,
      LEVEL_LEGAL => LEGAL,
      LEVEL_HR => HR,
      LEVEL_EMPLOYEE => EMPLOYEE,
      LEVEL_VIEWER => VIEWER
    }.freeze

    # Role to level mapping
    ROLE_LEVELS = {
      ADMIN => LEVEL_ADMIN,
      CEO => LEVEL_ADMIN,
      GENERAL_MANAGER => LEVEL_ADMIN,
      LEGAL_REPRESENTATIVE => LEVEL_ADMIN,
      LEGAL => LEVEL_LEGAL,
      HR_MANAGER => LEVEL_LEGAL,
      HR => LEVEL_HR,
      ACCOUNTANT => LEVEL_HR,
      MANAGER => LEVEL_HR,
      EMPLOYEE => LEVEL_EMPLOYEE,
      VIEWER => LEVEL_VIEWER
    }.freeze

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

    # Level comparison methods
    def level_value
      ROLE_LEVELS[name] || level
    end

    def level_name
      case level_value
      when LEVEL_ADMIN then "Admin"
      when LEVEL_LEGAL then "Legal"
      when LEVEL_HR then "HR"
      when LEVEL_EMPLOYEE then "Employee"
      when LEVEL_VIEWER then "Viewer"
      else "Custom (#{level_value})"
      end
    end

    def higher_level_than?(other_role)
      level_value > other_role.level_value
    end

    def same_level_as?(other_role)
      level_value == other_role.level_value
    end

    def lower_level_than?(other_role)
      level_value < other_role.level_value
    end

    def at_least_level?(min_level)
      level_value >= min_level
    end

    def at_most_level?(max_level)
      level_value <= max_level
    end

    class << self
      def level_for(role_name)
        ROLE_LEVELS[role_name] || 0
      end

      def role_for_level(level)
        LEVELS[level]
      end

      def roles_at_level(min_level)
        ROLE_LEVELS.select { |_, v| v >= min_level }.keys
      end

      def seed_defaults!
        default_roles.each do |attrs|
          role = find_or_create_by!(name: attrs[:name]) do |r|
            r.display_name = attrs[:display_name]
            r.description = attrs[:description]
            r.system_role = true
            r.level = attrs[:level]
          end

          # Update level if role already exists (for migration)
          if role.level != attrs[:level]
            role.update!(level: attrs[:level])
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
            display_name: "Administrador",
            description: "Acceso total al sistema (Nivel 5)",
            level: LEVEL_ADMIN,
            permissions: []
          },
          {
            name: CEO,
            display_name: "CEO",
            description: "Director Ejecutivo - Máxima autoridad (Nivel 5)",
            level: LEVEL_ADMIN,
            permissions: []
          },
          {
            name: GENERAL_MANAGER,
            display_name: "Gerente General",
            description: "Gerente general de la empresa (Nivel 5)",
            level: LEVEL_ADMIN,
            permissions: []
          },
          {
            name: LEGAL_REPRESENTATIVE,
            display_name: "Representante Legal",
            description: "Representante legal de la empresa - Firma documentos oficiales (Nivel 5)",
            level: LEVEL_ADMIN,
            permissions: []
          },
          {
            name: LEGAL,
            display_name: "Legal",
            description: "Departamento legal (Nivel 4)",
            level: LEVEL_LEGAL,
            permissions: [
              "documents.read", "documents.create", "documents.update", "documents.export",
              "legal_documents.read", "legal_documents.manage",
              "audit_logs.read"
            ]
          },
          {
            name: HR_MANAGER,
            display_name: "Gerente de RR.HH.",
            description: "Gerente de Recursos Humanos (Nivel 4)",
            level: LEVEL_LEGAL,
            permissions: [
              "documents.read", "documents.create", "documents.update",
              "hr_requests.read", "hr_requests.manage",
              "users.read", "users.manage"
            ]
          },
          {
            name: HR,
            display_name: "Recursos Humanos",
            description: "Personal de Recursos Humanos (Nivel 3)",
            level: LEVEL_HR,
            permissions: [
              "documents.read", "documents.create", "documents.update",
              "hr_requests.read", "hr_requests.manage",
              "users.read"
            ]
          },
          {
            name: ACCOUNTANT,
            display_name: "Contador",
            description: "Área contable y financiera (Nivel 3)",
            level: LEVEL_HR,
            permissions: [
              "documents.read", "documents.create", "documents.update"
            ]
          },
          {
            name: MANAGER,
            display_name: "Jefe de Área",
            description: "Jefe o supervisor de área (Nivel 3)",
            level: LEVEL_HR,
            permissions: [
              "documents.read", "documents.create", "documents.update",
              "hr_requests.read"
            ]
          },
          {
            name: EMPLOYEE,
            display_name: "Empleado",
            description: "Empleado estándar (Nivel 2)",
            level: LEVEL_EMPLOYEE,
            permissions: [
              "documents.read", "documents.create", "documents.update",
              "hr_requests.read"
            ]
          },
          {
            name: VIEWER,
            display_name: "Visor",
            description: "Solo lectura de documentos (Nivel 1)",
            level: LEVEL_VIEWER,
            permissions: [
              "documents.read"
            ]
          }
        ]
      end
    end
  end
end
