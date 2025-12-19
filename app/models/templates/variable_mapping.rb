# frozen_string_literal: true

module Templates
  class VariableMapping
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "variable_mappings"

    # Categories for organizing mappings
    CATEGORIES = {
      "employee" => "Empleado",
      "organization" => "Organización",
      "request" => "Solicitud",
      "system" => "Sistema",
      "custom" => "Personalizado"
    }.freeze

    # Data types for value resolution
    DATA_TYPES = %w[string date number boolean email].freeze

    # Fields
    field :name, type: String           # Display name, e.g., "Salario Mensual"
    field :key, type: String            # Unique key, e.g., "employee.monthly_salary"
    field :category, type: String       # Category for grouping
    field :description, type: String    # Help text
    field :data_type, type: String, default: "string"
    field :format_pattern, type: String # Optional format, e.g., "$%{value}" for currency
    field :is_system, type: Boolean, default: false  # System mappings can't be deleted
    field :active, type: Boolean, default: true
    field :position, type: Integer, default: 0

    # For custom mappings that pull from specific model fields
    field :source_model, type: String   # e.g., "Hr::Employee"
    field :source_field, type: String   # e.g., "monthly_salary"

    # Associations
    belongs_to :organization, class_name: "Identity::Organization", optional: true
    belongs_to :created_by, class_name: "Identity::User", optional: true

    # Indexes
    index({ organization_id: 1, active: 1 })
    index({ key: 1 })
    index({ name: 1, is_system: 1 }, { unique: true })
    index({ category: 1 })
    index({ is_system: 1 })
    index({ position: 1 })

    # Validations
    validates :name, presence: true, length: { maximum: 100 }, uniqueness: { scope: :is_system }
    validates :key, presence: true, length: { maximum: 100 }
    validates :category, presence: true, inclusion: { in: CATEGORIES.keys }
    validates :data_type, inclusion: { in: DATA_TYPES }

    validate :key_format_valid

    # Scopes
    scope :active, -> { where(active: true) }
    scope :inactive, -> { where(active: false) }
    scope :system_mappings, -> { where(is_system: true) }
    scope :custom_mappings, -> { where(is_system: false) }
    scope :by_category, ->(cat) { where(category: cat) }
    scope :for_organization, ->(org) { where(:organization_id.in => [nil, org.id]) }
    scope :ordered, -> { order(category: :asc, position: :asc, name: :asc) }

    # Callbacks
    before_validation :generate_key, on: :create, if: -> { key.blank? }
    before_validation :normalize_name

    # Instance methods
    def system?
      is_system
    end

    def custom?
      !is_system
    end

    def category_label
      CATEGORIES[category] || category
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

    # Resolve the value for this mapping given a context
    def resolve_value(context)
      return nil unless active?

      if source_model.present? && source_field.present?
        resolve_from_source(context)
      else
        resolve_from_path(context)
      end
    end

    # Class methods
    class << self
      # Get all available mappings (system + org custom)
      def available_for(organization)
        active.for_organization(organization).ordered
      end

      # Convert to hash format for API
      def to_mapping_hash(organization = nil)
        mappings = organization ? available_for(organization) : active.ordered
        mappings.each_with_object({}) do |mapping, hash|
          hash[mapping.name] = mapping.key
        end
      end

      # Grouped by category
      def grouped_for(organization)
        available_for(organization).group_by(&:category)
      end

      # Seed system mappings
      def seed_system_mappings!
        system_mappings_data.each do |data|
          normalized_name = VariableNormalizer.normalize(data[:name])
          # Use name as unique identifier to allow multiple names pointing to same key
          mapping = where(name: normalized_name, is_system: true).first
          if mapping
            mapping.update!(data.merge(is_system: true))
          else
            create!(data.merge(is_system: true, name: normalized_name))
          end
        end
      end

      private

      def system_mappings_data
        [
          # Employee mappings - Personal info
          { name: "Nombre Completo", key: "employee.full_name", category: "employee", description: "Nombre y apellido del empleado" },
          { name: "Primer Nombre", key: "employee.first_name", category: "employee", description: "Primer nombre del empleado" },
          { name: "Apellido", key: "employee.last_name", category: "employee", description: "Apellido del empleado" },
          { name: "Nombre del Trabajador", key: "employee.full_name", category: "employee", description: "Nombre completo del trabajador" },
          { name: "Numero de Empleado", key: "employee.employee_number", category: "employee", description: "Código único del empleado" },
          { name: "Cargo", key: "employee.job_title", category: "employee", description: "Cargo o posición del empleado" },
          { name: "Nombre del Cargo", key: "employee.job_title", category: "employee", description: "Cargo o posición" },
          { name: "Departamento", key: "employee.department", category: "employee", description: "Departamento donde trabaja" },
          { name: "Cedula", key: "employee.identification_number", category: "employee", description: "Número de cédula" },
          { name: "Cc del Trabajador", key: "employee.identification_number", category: "employee", description: "Cédula de ciudadanía del trabajador" },
          { name: "Tipo de Identificacion", key: "employee.identification_type", category: "employee", description: "Tipo de documento (CC, CE, etc.)" },
          { name: "Email del Empleado", key: "employee.email", category: "employee", description: "Correo electrónico" },
          { name: "Fecha de Nacimiento", key: "employee.date_of_birth", category: "employee", data_type: "date", description: "Fecha de nacimiento" },
          { name: "Lugar de Nacimiento", key: "employee.place_of_birth", category: "employee", description: "Lugar de nacimiento" },
          { name: "Nacionalidad", key: "employee.nationality", category: "employee", description: "Nacionalidad del empleado" },
          { name: "Direccion del Trabajador", key: "employee.address", category: "employee", description: "Dirección del trabajador" },
          { name: "Telefono del Trabajador", key: "employee.phone", category: "employee", description: "Teléfono del trabajador" },

          # Employee mappings - Contract & compensation
          { name: "Fecha de Ingreso", key: "employee.hire_date", category: "employee", data_type: "date", description: "Fecha de contratación" },
          { name: "Fecha de Inicio del Contrato", key: "employee.contract_start_date", category: "employee", data_type: "date", description: "Fecha de inicio del contrato" },
          { name: "Fecha de Terminacion del Contrato", key: "employee.contract_end_date", category: "employee", data_type: "date", description: "Fecha de terminación del contrato" },
          { name: "Fecha de Terminacion", key: "employee.contract_end_date", category: "employee", data_type: "date", description: "Fecha de terminación (alias)" },
          { name: "Tipo de Contrato", key: "employee.contract_type", category: "employee", description: "Tipo de contrato laboral" },
          { name: "Termino de Duracion", key: "employee.contract_duration", category: "employee", description: "Término de duración del contrato" },
          { name: "Dias de Periodo de Prueba", key: "employee.trial_period_days", category: "employee", data_type: "number", description: "Días del periodo de prueba" },
          { name: "Anos de Servicio", key: "employee.years_of_service", category: "employee", data_type: "number", description: "Antigüedad en años" },
          { name: "Anos de Servicio Texto", key: "employee.years_of_service_text", category: "employee", description: "Antigüedad en texto" },
          { name: "Salario", key: "employee.salary", category: "employee", data_type: "number", description: "Salario mensual del empleado" },
          { name: "Salario en Letras", key: "employee.salary_text", category: "employee", description: "Salario en palabras" },
          { name: "Auxilio de Transporte", key: "employee.transport_allowance", category: "employee", data_type: "number", description: "Auxilio de transporte mensual" },
          { name: "Auxilio de Alimentacion", key: "employee.food_allowance", category: "employee", data_type: "number", description: "Auxilio de alimentación mensual" },
          { name: "Compensacion Total", key: "employee.total_compensation", category: "employee", data_type: "number", description: "Total salario + auxilios" },

          # Organization mappings
          { name: "Nombre de Empresa", key: "organization.name", category: "organization", description: "Razón social de la empresa" },
          { name: "Nit", key: "organization.tax_id", category: "organization", description: "Identificación tributaria" },
          { name: "Direccion de la Empresa", key: "organization.address", category: "organization", description: "Dirección de la empresa" },
          { name: "Ciudad", key: "organization.city", category: "organization", description: "Ciudad de la empresa" },
          { name: "Telefono de la Empresa", key: "organization.phone", category: "organization", description: "Teléfono de contacto" },

          # System mappings
          { name: "Fecha Actual", key: "system.current_date", category: "system", data_type: "date", description: "Fecha del día de generación" },
          { name: "Dia/Mes/Ano", key: "system.current_date", category: "system", data_type: "date", description: "Fecha actual en formato día/mes/año" },
          { name: "Fecha Actual Texto", key: "system.current_date_text", category: "system", description: "Fecha en formato largo" },
          { name: "Ano Actual", key: "system.current_year", category: "system", description: "Año de generación" },
          { name: "Mes Actual", key: "system.current_month", category: "system", description: "Mes de generación" },

          # Request mappings (for certifications/vacations)
          { name: "Numero de Solicitud", key: "request.request_number", category: "request", description: "Número único de la solicitud" },
          { name: "Tipo de Certificacion", key: "request.certification_type", category: "request", description: "Tipo de certificación solicitada" },
          { name: "Proposito", key: "request.purpose", category: "request", description: "Propósito de la solicitud" },
          { name: "Fecha de Inicio de Vacaciones", key: "request.start_date", category: "request", data_type: "date", description: "Fecha de inicio de vacaciones" },
          { name: "Fecha de Fin de Vacaciones", key: "request.end_date", category: "request", data_type: "date", description: "Fecha de fin de vacaciones" },
          { name: "Dias Solicitados", key: "request.days_requested", category: "request", data_type: "number", description: "Cantidad de días solicitados" }
        ]
      end
    end

    private

    def normalize_name
      return if name.blank?

      self.name = VariableNormalizer.normalize(name)
    end

    def generate_key
      base = VariableNormalizer.to_key(name)
      self.key = "custom.#{base}"
    end

    def key_format_valid
      return if key.blank?

      unless key.match?(/\A[a-z_]+\.[a-z_]+\z/)
        errors.add(:key, "debe tener formato 'categoria.campo' (solo letras minúsculas y guiones bajos)")
      end
    end

    def resolve_from_source(context)
      return nil unless source_model && source_field

      # Get the source object from context
      source = case source_model
               when "Hr::Employee"
                 context[:employee]
               when "Identity::Organization"
                 context[:organization]
               else
                 nil
               end

      return nil unless source

      source.try(source_field)
    end

    def resolve_from_path(context)
      # Delegate to VariableResolverService
      VariableResolverService.new(context).resolve(key)
    end
  end
end
