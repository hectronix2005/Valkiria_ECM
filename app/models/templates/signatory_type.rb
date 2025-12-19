# frozen_string_literal: true

module Templates
  class SignatoryType
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "signatory_types"

    # Fields
    field :name, type: String              # Display name, e.g., "Gerente de RR.HH."
    field :code, type: String              # Unique code, e.g., "hr_manager"
    field :description, type: String       # Description of this signatory type
    field :is_system, type: Boolean, default: false  # System types can't be deleted
    field :active, type: Boolean, default: true
    field :position, type: Integer, default: 0

    # Associations
    belongs_to :organization, class_name: "Identity::Organization", optional: true
    belongs_to :created_by, class_name: "Identity::User", optional: true
    has_many :template_signatories, class_name: "Templates::TemplateSignatory",
             foreign_key: :signatory_type_id, dependent: :restrict_with_error

    # Indexes
    index({ organization_id: 1, active: 1 })
    index({ code: 1 }, { unique: true })
    index({ is_system: 1 })
    index({ position: 1 })

    # Validations
    validates :name, presence: true, length: { maximum: 100 }
    validates :code, presence: true, uniqueness: true, length: { maximum: 50 }

    validate :code_format_valid

    # Scopes
    scope :active, -> { where(active: true) }
    scope :inactive, -> { where(active: false) }
    scope :system_types, -> { where(is_system: true) }
    scope :custom_types, -> { where(is_system: false) }
    scope :for_organization, ->(org) { where(:organization_id.in => [nil, org&.id]) }
    scope :ordered, -> { order(position: :asc, name: :asc) }

    # Callbacks
    before_validation :generate_code, on: :create, if: -> { code.blank? }

    # Instance methods
    def system?
      is_system
    end

    def custom?
      !is_system
    end

    def activate!
      update!(active: true)
    end

    def deactivate!
      update!(active: false)
    end

    def toggle_active!
      update!(active: !active)
    end

    def in_use?
      template_signatories.exists?
    end

    def usage_count
      template_signatories.count
    end

    # Class methods
    class << self
      def available_for(organization)
        active.for_organization(organization).ordered
      end

      def seed_system_types!
        system_types_data.each do |data|
          find_or_create_by!(code: data[:code]) do |type|
            type.assign_attributes(data.merge(is_system: true))
          end
        end
      end

      private

      def system_types_data
        [
          { name: "Empleado Solicitante", code: "employee", description: "El empleado que realiza la solicitud", position: 1 },
          { name: "Supervisor Directo", code: "supervisor", description: "Supervisor inmediato del empleado", position: 2 },
          { name: "Recursos Humanos", code: "hr", description: "Personal de Recursos Humanos", position: 3 },
          { name: "Gerente de RR.HH.", code: "hr_manager", description: "Gerente del departamento de Recursos Humanos", position: 4 },
          { name: "Departamento Legal", code: "legal", description: "Personal del departamento legal", position: 5 },
          { name: "Gerente General", code: "general_manager", description: "Gerente general de la empresa", position: 6 },
          { name: "Representante Legal", code: "legal_representative", description: "Representante legal de la empresa", position: 7 },
          { name: "Contador", code: "accountant", description: "Contador o área contable", position: 8 },
          { name: "Administrador", code: "admin", description: "Administrador del sistema", position: 9 }
        ]
      end
    end

    private

    def generate_code
      base = name.to_s.parameterize(separator: "_")
      self.code = base
    end

    def code_format_valid
      return if code.blank?

      unless code.match?(/\A[a-z][a-z0-9_]*\z/)
        errors.add(:code, "debe comenzar con letra y contener solo letras minúsculas, números y guiones bajos")
      end
    end
  end
end
