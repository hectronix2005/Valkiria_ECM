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
      when HR, HR_MANAGER, "hr"
        find_hr_user(context[:organization])
      when LEGAL, "legal"
        find_legal_user(context[:organization])
      when ADMIN, "admin"
        find_admin_user(context[:organization])
      when CUSTOM, "custom"
        find_custom_signatory
      end
    end

    # Signature box coordinates for PDF rendering
    def signature_box
      {
        x: x_position,
        y: y_position,
        width: width,
        height: height,
        page: page_number
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

    def find_hr_user(organization)
      return nil unless organization

      # Find user with HR role in organization
      hr_role = Identity::Role.where(name: "hr").first
      return nil unless hr_role

      Identity::User.where(
        organization_id: organization.id,
        :role_ids.in => [hr_role.id],
        active: true
      ).first
    end

    def find_legal_user(organization)
      return nil unless organization

      legal_role = Identity::Role.where(name: "legal").first
      return nil unless legal_role

      Identity::User.where(
        organization_id: organization.id,
        :role_ids.in => [legal_role.id],
        active: true
      ).first
    end

    def find_admin_user(organization)
      return nil unless organization

      admin_role = Identity::Role.where(name: "admin").first
      return nil unless admin_role

      Identity::User.where(
        organization_id: organization.id,
        :role_ids.in => [admin_role.id],
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
