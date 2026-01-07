# frozen_string_literal: true

module Legal
  class ContractApproval
    include Mongoid::Document
    include Mongoid::Timestamps

    # Constants
    STATUSES = %w[pending approved rejected].freeze
    ROLES = %w[area_manager legal general_manager ceo].freeze

    ROLE_LABELS = {
      "area_manager" => "Jefe de Área",
      "legal" => "Legal",
      "general_manager" => "Gerente General",
      "ceo" => "CEO"
    }.freeze

    # Fields
    field :role, type: String
    field :status, type: String, default: "pending"
    field :order, type: Integer, default: 0
    field :decided_at, type: Time
    field :notes, type: String
    field :reason, type: String # For rejections

    # Approver info (captured at decision time)
    field :approver_id, type: String
    field :approver_name, type: String
    field :approver_email, type: String

    # Embedded in Contract
    embedded_in :contract, class_name: "Legal::Contract"

    # Validations
    validates :role, presence: true, inclusion: { in: ROLES }
    validates :status, presence: true, inclusion: { in: STATUSES }

    # Instance methods
    def pending?
      status == "pending"
    end

    def approved?
      status == "approved"
    end

    def rejected?
      status == "rejected"
    end

    def decided?
      approved? || rejected?
    end

    def role_label
      ROLE_LABELS[role] || role.humanize
    end

    def approve!(actor:, notes: nil)
      self.status = "approved"
      self.decided_at = Time.current
      self.approver_id = actor.id.to_s
      self.approver_name = actor.full_name
      self.approver_email = actor.email
      self.notes = notes
    end

    def reject!(actor:, reason:)
      self.status = "rejected"
      self.decided_at = Time.current
      self.approver_id = actor.id.to_s
      self.approver_name = actor.full_name
      self.approver_email = actor.email
      self.reason = reason
    end

    def can_be_decided_by?(user)
      pending? && user_has_approval_role?(user)
    end

    private

    def user_has_approval_role?(user)
      case role
      when "area_manager"
        user.has_role?("manager") || user.has_role?("admin")
      when "legal"
        user.has_role?("legal") || user.has_role?("admin")
      when "general_manager"
        user.has_role?("general_manager") || user.has_role?("admin")
      when "ceo"
        user.has_role?("ceo") || user.has_role?("admin")
      else
        false
      end
    end
  end
end
