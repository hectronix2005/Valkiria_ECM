# frozen_string_literal: true

module Templates
  class TemplateSignatory
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "template_signatories"

    # Legacy signatory roles (kept for backward compatibility)
    EMPLOYEE = "employee"
    SUPERVISOR = "supervisor"
    HR = "hr"
    HR_MANAGER = "hr_manager"
    LEGAL = "legal"
    ADMIN = "admin"
    CUSTOM = "custom"

    ROLES = [EMPLOYEE, SUPERVISOR, HR, HR_MANAGER, LEGAL, ADMIN, CUSTOM].freeze

    ROLE_LABELS = {
      EMPLOYEE => "Empleado Solicitante",
      SUPERVISOR => "Supervisor Directo",
      HR => "Recursos Humanos",
      HR_MANAGER => "Gerente de RR.HH.",
      LEGAL => "Departamento Legal",
      ADMIN => "Administrador",
      CUSTOM => "Personalizado"
    }.freeze

    # Fields
    field :role, type: String  # Legacy field, use signatory_type_code for new entries
    field :signatory_type_code, type: String  # Reference to SignatoryType by code
    field :label, type: String  # Display label, e.g., "Firma del Empleado"
    field :position, type: Integer, default: 0  # Order of signature
    field :required, type: Boolean, default: true
    field :placeholder_text, type: String, default: "Firma"

    # Signature placement on PDF (coordinates relative to page)
    field :page_number, type: Integer, default: 1  # 0 = last page
    field :x_position, type: Float, default: 100.0
    field :y_position, type: Float, default: 100.0
    field :width, type: Float, default: 200.0
    field :height, type: Float, default: 60.0

    # Date position relative to signature
    # right: fecha a la derecha (default, firma usa 75% ancho)
    # below: fecha debajo (firma usa 100% ancho, 80% alto)
    # above: fecha arriba (firma usa 100% ancho, 80% alto)
    # none: sin fecha (firma usa 100% del espacio)
    DATE_POSITIONS = %w[right below above none].freeze
    field :date_position, type: String, default: "right"

    # Display options for signature rendering
    field :show_label, type: Boolean, default: true      # Show label (e.g., "Representante Legal")
    field :show_signer_name, type: Boolean, default: false # Show "Firmado por: [nombre]"

    # For custom role - specific user or email
    field :custom_user_id, type: BSON::ObjectId
    field :custom_email, type: String

    # Associations
    belongs_to :template, class_name: "Templates::Template", inverse_of: :signatories

    # Indexes
    index({ template_id: 1, position: 1 })
    index({ role: 1 })

    # Validations
    validates :label, presence: true, length: { maximum: 100 }
    validate :valid_signatory_type
    validates :position, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :x_position, :y_position, :width, :height,
              numericality: { greater_than_or_equal_to: 0 }
    validates :custom_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
    validates :date_position, inclusion: { in: DATE_POSITIONS }, allow_blank: true

    # Scopes
    scope :required, -> { where(required: true) }
    scope :optional, -> { where(required: false) }
    scope :by_position, -> { order(position: :asc) }

    # Callbacks
    before_validation :set_default_label, on: :create

    # Instance methods
    def role_label
      # Try to get label from SignatoryType first
      if signatory_type_code.present?
        signatory_type&.name || signatory_type_code
      else
        ROLE_LABELS[role] || role
      end
    end

    def effective_code
      signatory_type_code.presence || role
    end

    def signatory_type
      return nil if signatory_type_code.blank?

      @signatory_type ||= SignatoryType.find_by(code: signatory_type_code)
    end

    def custom?
      effective_code == CUSTOM
    end

    def employee_signatory?
      role == EMPLOYEE
    end

    # Find the appropriate user to sign based on role and context
    def find_signatory_for(context)
      # Use signatory_type_code if role is blank
      effective_role = role.presence || signatory_type_code

      case effective_role
      when EMPLOYEE, "employee"
        context[:employee]&.user
      when SUPERVISOR, "supervisor"
        context[:employee]&.supervisor&.user
      when HR, "hr"
        find_user_with_role("hr", context[:organization])
      when HR_MANAGER, "hr_manager"
        find_user_with_role("hr_manager", context[:organization]) || find_user_with_role("hr", context[:organization])
      when LEGAL, "legal"
        find_user_with_role("legal", context[:organization])
      when "legal_representative"
        find_user_with_role("legal_representative", context[:organization])
      when "general_manager"
        find_user_with_role("general_manager", context[:organization])
      when "ceo"
        find_user_with_role("ceo", context[:organization])
      when "accountant"
        find_user_with_role("accountant", context[:organization])
      when "manager", "area_manager"
        find_user_with_role("manager", context[:organization])
      when ADMIN, "admin"
        find_user_with_role("admin", context[:organization])
      when CUSTOM, "custom"
        find_custom_signatory
      else
        # Try to find by role name directly
        find_user_with_role(effective_role, context[:organization])
      end
    end

    # Signature box coordinates for PDF rendering
    def signature_box
      {
        x: x_position,
        y: y_position,
        width: width,
        height: height,
        page: page_number,
        date_position: date_position || "right",
        show_label: show_label.nil? ? true : show_label,
        show_signer_name: show_signer_name || false
      }
    end

    private

    def valid_signatory_type
      # Must have either role or signatory_type_code
      if role.blank? && signatory_type_code.blank?
        errors.add(:base, "Debe especificar un tipo de firmante")
        return
      end

      # If using legacy role, validate it
      if role.present? && signatory_type_code.blank?
        unless ROLES.include?(role)
          errors.add(:role, "no es un rol válido")
        end
      end

      # If using signatory_type_code, validate it exists
      if signatory_type_code.present?
        unless SignatoryType.exists?(code: signatory_type_code)
          errors.add(:signatory_type_code, "no es un tipo de firmante válido")
        end
      end
    end

    def set_default_label
      return if label.present?

      if signatory_type_code.present?
        self.label = signatory_type&.name || "Firma"
      else
        self.label = ROLE_LABELS[role] || "Firma"
      end
    end

    # Generic method to find a user with a specific role in an organization
    def find_user_with_role(role_name, organization)
      return nil unless organization

      role = Identity::Role.where(name: role_name).first
      return nil unless role

      Identity::User.where(
        organization_id: organization.id,
        :role_ids.in => [role.id],
        active: true
      ).first
    end

    def find_custom_signatory
      if custom_user_id.present?
        Identity::User.where(id: custom_user_id, active: true).first
      elsif custom_email.present?
        Identity::User.where(email: custom_email, active: true).first
      end
    end
  end
end
