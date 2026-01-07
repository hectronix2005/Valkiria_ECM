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
      "third_party" => "Tercero",
      "contract" => "Contrato",
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
    field :aliases, type: Array, default: [] # Alternative names that map to the same key

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

    # Add an alias to this mapping
    def add_alias(alias_name)
      normalized = VariableNormalizer.normalize(alias_name)
      return false if normalized == name || aliases.include?(normalized)

      self.aliases = (aliases + [normalized]).uniq
      save!
    end

    # Remove an alias
    def remove_alias(alias_name)
      normalized = VariableNormalizer.normalize(alias_name)
      return false unless aliases.include?(normalized)

      self.aliases = aliases - [normalized]
      save!
    end

    # Check if a name matches this mapping (name or any alias)
    def matches_name?(search_name)
      normalized_search = VariableNormalizer.comparison_key(search_name)
      return true if VariableNormalizer.comparison_key(name) == normalized_search

      aliases.any? { |a| VariableNormalizer.comparison_key(a) == normalized_search }
    end

    # All names (primary + aliases)
    def all_names
      [name] + (aliases || [])
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

      # Find mapping by name or alias (case/accent insensitive)
      def find_by_name_or_alias(search_name, organization = nil)
        mappings = organization ? available_for(organization) : active.ordered
        normalized_search = VariableNormalizer.comparison_key(search_name)

        mappings.find do |m|
          m.matches_name?(search_name)
        end
      end

      # Seed system mappings
      def seed_system_mappings!
        system_mappings_data.each do |data|
          normalized_name = VariableNormalizer.normalize(data[:name])

          # Use name as unique identifier (allows multiple names for same key)
          mapping = where(name: normalized_name, is_system: true).first
          if mapping
            mapping.update!(data.merge(is_system: true, name: normalized_name))
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
          { name: "Nombre del Trabajador", key: "employee.full_name", category: "employee", description: "Nombre completo del trabajador" },
          { name: "Primer Nombre", key: "employee.first_name", category: "employee", description: "Primer nombre del empleado" },
          { name: "Apellido", key: "employee.last_name", category: "employee", description: "Apellido del empleado" },
          { name: "Numero de Empleado", key: "employee.employee_number", category: "employee", description: "Código único del empleado" },
          { name: "Cargo", key: "employee.job_title", category: "employee", description: "Cargo o posición del empleado" },
          { name: "Nombre del Cargo", key: "employee.job_title", category: "employee", description: "Cargo o posición" },
          { name: "Departamento", key: "employee.department", category: "employee", description: "Departamento donde trabaja" },
          { name: "Numero de Identificacion", key: "employee.identification_number", category: "employee", description: "Número de cédula o documento" },
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
          { name: "Auxilio de Transporte en Letras", key: "employee.transport_allowance_text", category: "employee", description: "Auxilio de transporte en palabras" },
          { name: "Auxilio de Alimentacion", key: "employee.food_allowance", category: "employee", data_type: "number", description: "Auxilio de alimentación mensual" },
          { name: "Auxilio de Alimentacion en Letras", key: "employee.food_allowance_text", category: "employee", description: "Auxilio de alimentación en palabras" },
          { name: "Compensacion Total", key: "employee.total_compensation", category: "employee", data_type: "number", description: "Total salario + auxilios" },
          { name: "Compensacion Total en Letras", key: "employee.total_compensation_text", category: "employee", description: "Total salario + auxilios en palabras" },

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
          { name: "Dias Solicitados", key: "request.days_requested", category: "request", data_type: "number", description: "Cantidad de días solicitados" },

          # Custom mappings - Text conversions (valores tomados del empleado y convertidos a texto)
          { name: "Salario Letras y Pesos", key: "custom.salario_letras_y_pesos", category: "custom", description: "Salario en palabras (toma de employee.salary)" },
          { name: "Auxilio Alimentacion en Letras y Pesos", key: "custom.auxilio_alimentacion_en_letras_y_pesos", category: "custom", description: "Auxilio alimentación en palabras (toma de employee.food_allowance)" },
          { name: "Auxilio Transporte en Letras y Pesos", key: "custom.auxilio_transporte_en_letras_y_pesos", category: "custom", description: "Auxilio transporte en palabras (toma de employee.transport_allowance)" },
          { name: "Compensacion Total en Letras", key: "custom.compensacion_total_en_letras", category: "custom", description: "Compensación total en palabras (salario + auxilios)" },

          # Third Party mappings (Terceros - Módulo Legal)
          { name: "Nombre del Tercero", key: "third_party.display_name", category: "third_party", description: "Nombre o razón social del tercero" },
          { name: "Razon Social", key: "third_party.business_name", category: "third_party", description: "Razón social de persona jurídica" },
          { name: "Nombre Comercial", key: "third_party.trade_name", category: "third_party", description: "Nombre comercial del tercero" },
          { name: "Codigo del Tercero", key: "third_party.code", category: "third_party", description: "Código único del tercero (TER-YYYY-NNNNN)" },
          { name: "Identificacion del Tercero", key: "third_party.identification_number", category: "third_party", description: "Número de identificación (NIT, CC, etc.)" },
          { name: "Tipo de Identificacion del Tercero", key: "third_party.identification_type", category: "third_party", description: "Tipo de documento del tercero" },
          { name: "Identificacion Completa del Tercero", key: "third_party.full_identification", category: "third_party", description: "Tipo y número de identificación" },
          { name: "Tipo de Tercero", key: "third_party.third_party_type", category: "third_party", description: "Proveedor, cliente, contratista, etc." },
          { name: "Tipo de Persona", key: "third_party.person_type", category: "third_party", description: "Natural o Jurídica" },
          { name: "Email del Tercero", key: "third_party.email", category: "third_party", description: "Correo electrónico del tercero" },
          { name: "Telefono del Tercero", key: "third_party.phone", category: "third_party", description: "Teléfono de contacto" },
          { name: "Direccion del Tercero", key: "third_party.address", category: "third_party", description: "Dirección del tercero" },
          { name: "Ciudad del Tercero", key: "third_party.city", category: "third_party", description: "Ciudad de ubicación" },
          { name: "Pais del Tercero", key: "third_party.country", category: "third_party", description: "País de ubicación" },
          { name: "Representante Legal", key: "third_party.legal_rep_name", category: "third_party", description: "Nombre del representante legal" },
          { name: "Cedula Representante Legal", key: "third_party.legal_rep_id", category: "third_party", description: "Cédula del representante legal" },
          { name: "Email Representante Legal", key: "third_party.legal_rep_email", category: "third_party", description: "Email del representante legal" },
          { name: "Banco del Tercero", key: "third_party.bank_name", category: "third_party", description: "Nombre del banco" },
          { name: "Tipo de Cuenta Bancaria", key: "third_party.bank_account_type", category: "third_party", description: "Ahorros o Corriente" },
          { name: "Numero de Cuenta Bancaria", key: "third_party.bank_account_number", category: "third_party", description: "Número de cuenta" },
          { name: "Industria del Tercero", key: "third_party.industry", category: "third_party", description: "Sector o industria" },

          # Contract mappings (Contratos - Módulo Legal)
          { name: "Numero de Contrato", key: "contract.contract_number", category: "contract", description: "Número único del contrato (CON-YYYY-NNNNN)" },
          { name: "Titulo del Contrato", key: "contract.title", category: "contract", description: "Título o nombre del contrato" },
          { name: "Descripcion del Contrato", key: "contract.description", category: "contract", description: "Descripción del objeto del contrato" },
          { name: "Tipo de Contrato Comercial", key: "contract.contract_type", category: "contract", description: "Servicios, compraventa, NDA, etc." },
          { name: "Estado del Contrato", key: "contract.status", category: "contract", description: "Estado actual del contrato" },
          { name: "Monto del Contrato", key: "contract.amount", category: "contract", data_type: "number", description: "Valor monetario del contrato" },
          { name: "Monto en Letras", key: "contract.amount_text", category: "contract", description: "Monto del contrato en palabras" },
          { name: "Moneda del Contrato", key: "contract.currency", category: "contract", description: "Moneda (COP, USD, EUR)" },
          { name: "Fecha de Inicio del Contrato", key: "contract.start_date", category: "contract", data_type: "date", description: "Fecha de inicio de vigencia" },
          { name: "Fecha de Inicio en Texto", key: "contract.start_date_text", category: "contract", description: "Fecha de inicio en formato largo" },
          { name: "Fecha de Fin del Contrato", key: "contract.end_date", category: "contract", data_type: "date", description: "Fecha de terminación del contrato" },
          { name: "Fecha de Fin en Texto", key: "contract.end_date_text", category: "contract", description: "Fecha de fin en formato largo" },
          { name: "Duracion del Contrato en Dias", key: "contract.duration_days", category: "contract", data_type: "number", description: "Días de duración" },
          { name: "Duracion del Contrato", key: "contract.duration_text", category: "contract", description: "Duración en texto (meses, años)" },
          { name: "Condiciones de Pago", key: "contract.payment_terms", category: "contract", description: "Términos de pago acordados" },
          { name: "Frecuencia de Pago", key: "contract.payment_frequency", category: "contract", description: "Mensual, quincenal, único, etc." },
          { name: "Nivel de Aprobacion", key: "contract.approval_level", category: "contract", description: "Nivel requerido de aprobación" },
          { name: "Fecha de Aprobacion", key: "contract.approved_at", category: "contract", data_type: "date", description: "Fecha en que fue aprobado" },
          { name: "Fecha de Aprobacion en Texto", key: "contract.approved_at_text", category: "contract", description: "Fecha de aprobación en formato largo" }
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
