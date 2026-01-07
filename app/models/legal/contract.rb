# frozen_string_literal: true

module Legal
  class Contract
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    # Constants
    TYPES = %w[
      services purchase nda lease partnership
      employment consulting maintenance license other
    ].freeze

    TYPE_LABELS = {
      "services" => "Prestación de Servicios",
      "purchase" => "Compraventa",
      "nda" => "Confidencialidad (NDA)",
      "lease" => "Arrendamiento",
      "partnership" => "Alianza/Asociación",
      "employment" => "Laboral",
      "consulting" => "Consultoría",
      "maintenance" => "Mantenimiento",
      "license" => "Licencia",
      "other" => "Otro"
    }.freeze

    STATUSES = %w[
      draft pending_approval approved rejected
      active expired terminated cancelled
    ].freeze

    STATUS_LABELS = {
      "draft" => "Borrador",
      "pending_approval" => "Pendiente de Aprobación",
      "approved" => "Aprobado",
      "rejected" => "Rechazado",
      "active" => "Activo",
      "expired" => "Vencido",
      "terminated" => "Terminado",
      "cancelled" => "Cancelado"
    }.freeze

    CURRENCIES = %w[COP USD EUR].freeze

    # Approval levels based on amount (in COP)
    APPROVAL_LEVELS = {
      "level_1" => { max_amount: 10_000_000, approvers: %w[area_manager], label: "Nivel 1 (≤$10M)" },
      "level_2" => { max_amount: 50_000_000, approvers: %w[area_manager legal], label: "Nivel 2 (≤$50M)" },
      "level_3" => { max_amount: 200_000_000, approvers: %w[area_manager legal general_manager], label: "Nivel 3 (≤$200M)" },
      "level_4" => { max_amount: Float::INFINITY, approvers: %w[area_manager legal general_manager ceo], label: "Nivel 4 (>$200M)" }
    }.freeze

    # Collection
    store_in collection: "legal_contracts"

    # Fields - Basic info
    field :contract_number, type: String
    field :title, type: String
    field :description, type: String
    field :contract_type, type: String, default: "services"
    field :status, type: String, default: "draft"

    # Dates
    field :start_date, type: Date
    field :end_date, type: Date
    field :signature_date, type: Date

    # Financial
    field :amount, type: BigDecimal
    field :currency, type: String, default: "COP"
    field :payment_terms, type: String
    field :payment_frequency, type: String # monthly, quarterly, annually, one_time

    # Approval workflow
    field :approval_level, type: String
    field :current_approver_role, type: String
    field :submitted_at, type: Time
    field :approved_at, type: Time
    field :rejected_at, type: Time
    field :rejection_reason, type: String

    # Document
    field :document_uuid, type: String
    field :template_id, type: String
    field :attachments, type: Array, default: [] # GridFS IDs

    # Renewal
    field :auto_renewal, type: Boolean, default: false
    field :renewal_notice_days, type: Integer, default: 30
    field :renewal_terms, type: String

    # History/Audit
    field :history, type: Array, default: []

    # Associations
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :third_party, class_name: "Legal::ThirdParty"
    belongs_to :requested_by, class_name: "Identity::User"
    belongs_to :area_manager, class_name: "Identity::User", optional: true

    embeds_many :approvals, class_name: "Legal::ContractApproval"

    # Validations
    validates :contract_type, presence: true, inclusion: { in: TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :currency, inclusion: { in: CURRENCIES }
    validates :title, presence: true
    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :start_date, presence: true
    validates :end_date, presence: true
    validate :end_date_after_start_date

    # Indexes
    index({ organization_id: 1, status: 1 })
    index({ organization_id: 1, contract_type: 1 })
    index({ contract_number: 1 }, unique: true)
    index({ third_party_id: 1 })
    index({ requested_by_id: 1 })
    index({ end_date: 1 })

    # Callbacks
    before_create :generate_contract_number
    before_save :determine_approval_level, if: :amount_changed?

    # Scopes
    scope :draft, -> { where(status: "draft") }
    scope :pending_approval, -> { where(status: "pending_approval") }
    scope :approved, -> { where(status: "approved") }
    scope :rejected, -> { where(status: "rejected") }
    scope :active, -> { where(status: "active") }
    scope :expired, -> { where(status: "expired") }
    scope :by_type, ->(type) { where(contract_type: type) }
    scope :by_third_party, ->(tp_id) { where(third_party_id: tp_id) }
    scope :expiring_soon, ->(days = 30) { active.where(:end_date.lte => Date.current + days) }
    scope :search, ->(query) {
      return all if query.blank?
      regex = /#{Regexp.escape(query)}/i
      any_of(
        { title: regex },
        { contract_number: regex },
        { description: regex }
      )
    }

    # State predicates
    def draft?; status == "draft"; end
    def pending_approval?; status == "pending_approval"; end
    def approved?; status == "approved"; end
    def rejected?; status == "rejected"; end
    def active?; status == "active"; end
    def expired?; status == "expired"; end
    def terminated?; status == "terminated"; end
    def cancelled?; status == "cancelled"; end

    def editable?
      draft?
    end

    def can_submit?
      draft? && valid?
    end

    def can_activate?
      approved?
    end

    # Workflow methods
    def submit!(actor:)
      raise InvalidStateError, "Solo se pueden enviar contratos en borrador" unless draft?
      raise ValidationError, "El contrato no es válido" unless valid?

      determine_approval_level
      initialize_approvals!

      self.status = "pending_approval"
      self.submitted_at = Time.current
      self.current_approver_role = required_approvers.first

      record_history("submitted", actor, { approval_level: approval_level })
      save!
    end

    def approve!(actor:, role:, notes: nil)
      raise InvalidStateError, "Solo se pueden aprobar contratos pendientes" unless pending_approval?

      approval = approvals.find { |a| a.role == role && a.pending? }
      raise AuthorizationError, "No hay aprobación pendiente para el rol #{role}" unless approval
      raise AuthorizationError, "No es tu turno de aprobar" unless current_approver_role == role
      raise AuthorizationError, "No tienes permisos para aprobar como #{role}" unless approval.can_be_decided_by?(actor)

      approval.approve!(actor: actor, notes: notes)
      record_history("approved_by", actor, { role: role, notes: notes })

      next_role = next_approver_role
      if next_role
        self.current_approver_role = next_role
      else
        self.status = "approved"
        self.approved_at = Time.current
        self.current_approver_role = nil
      end

      save!
    end

    def reject!(actor:, role:, reason:)
      raise InvalidStateError, "Solo se pueden rechazar contratos pendientes" unless pending_approval?
      raise ArgumentError, "Se requiere un motivo de rechazo" if reason.blank?

      approval = approvals.find { |a| a.role == role && a.pending? }
      raise AuthorizationError, "No hay aprobación pendiente para el rol #{role}" unless approval
      raise AuthorizationError, "No tienes permisos para rechazar como #{role}" unless approval.can_be_decided_by?(actor)

      approval.reject!(actor: actor, reason: reason)

      self.status = "rejected"
      self.rejected_at = Time.current
      self.rejection_reason = reason
      self.current_approver_role = nil

      record_history("rejected", actor, { role: role, reason: reason })
      save!
    end

    def activate!(actor: nil)
      raise InvalidStateError, "Solo se pueden activar contratos aprobados" unless approved?

      self.status = "active"
      record_history("activated", actor) if actor
      save!
    end

    def terminate!(actor:, reason: nil)
      raise InvalidStateError, "Solo se pueden terminar contratos activos" unless active?

      self.status = "terminated"
      record_history("terminated", actor, { reason: reason })
      save!
    end

    def cancel!(actor:, reason: nil)
      raise InvalidStateError, "No se puede cancelar este contrato" if active? || expired? || terminated?

      self.status = "cancelled"
      record_history("cancelled", actor, { reason: reason })
      save!
    end

    def expire!
      return unless active? && end_date && end_date < Date.current

      self.status = "expired"
      record_history("expired", nil, { expired_on: Date.current })
      save!
    end

    # Approval helpers
    def required_approvers
      return [] unless approval_level
      APPROVAL_LEVELS.dig(approval_level, :approvers) || []
    end

    def next_approver_role
      approved_roles = approvals.select(&:approved?).map(&:role)
      required_approvers.find { |r| !approved_roles.include?(r) }
    end

    def approval_progress
      return 0 if approvals.empty?
      (approvals.count(&:approved?).to_f / approvals.count * 100).round
    end

    def can_approve?(user)
      return false unless pending_approval?
      return false unless current_approver_role

      approval = approvals.find { |a| a.role == current_approver_role && a.pending? }
      approval&.can_be_decided_by?(user) || false
    end

    def pending_approval_for_user?(user)
      can_approve?(user)
    end

    # Labels
    def type_label
      TYPE_LABELS[contract_type] || contract_type.humanize
    end

    def status_label
      STATUS_LABELS[status] || status.humanize
    end

    def approval_level_label
      APPROVAL_LEVELS.dig(approval_level, :label) || approval_level
    end

    def current_approver_label
      return nil unless current_approver_role
      ContractApproval::ROLE_LABELS[current_approver_role] || current_approver_role.humanize
    end

    # Duration
    def duration_days
      return nil unless start_date && end_date
      (end_date - start_date).to_i
    end

    def days_until_expiry
      return nil unless end_date
      (end_date - Date.current).to_i
    end

    def expiring_soon?(days = 30)
      active? && days_until_expiry && days_until_expiry <= days
    end

    # Errors
    class InvalidStateError < StandardError; end
    class AuthorizationError < StandardError; end
    class ValidationError < StandardError; end

    private

    def generate_contract_number
      return if contract_number.present?

      year = Time.current.year
      last_record = self.class
        .where(organization_id: organization_id)
        .where(:contract_number.ne => nil)
        .order(created_at: :desc)
        .first

      if last_record&.contract_number&.match?(/CON-#{year}-(\d+)/)
        last_num = last_record.contract_number.split("-").last.to_i
        self.contract_number = "CON-#{year}-#{(last_num + 1).to_s.rjust(5, '0')}"
      else
        self.contract_number = "CON-#{year}-00001"
      end
    end

    def determine_approval_level
      return unless amount

      amount_cop = amount.to_f
      level = APPROVAL_LEVELS.find { |_, config| amount_cop <= config[:max_amount] }
      self.approval_level = level&.first || "level_4"
    end

    def initialize_approvals!
      self.approvals = []
      required_approvers.each_with_index do |role, index|
        approvals.build(role: role, status: "pending", order: index)
      end
    end

    def record_history(action, actor, details = {})
      history << {
        action: action,
        actor_id: actor&.id&.to_s,
        actor_name: actor&.full_name,
        timestamp: Time.current.iso8601,
        details: details
      }
    end

    def end_date_after_start_date
      return unless start_date && end_date
      errors.add(:end_date, "debe ser posterior a la fecha de inicio") if end_date < start_date
    end
  end
end
