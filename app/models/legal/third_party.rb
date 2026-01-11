# frozen_string_literal: true

module Legal
  class ThirdParty
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    # Constants
    TYPES = %w[provider client contractor partner other].freeze
    PERSON_TYPES = %w[natural juridical].freeze
    STATUSES = %w[active inactive blocked].freeze
    IDENTIFICATION_TYPES = %w[NIT CC CE PA TI NIP].freeze

    # Collection
    store_in collection: "legal_third_parties"

    # Fields - Identification
    field :code, type: String
    field :third_party_type, type: String, default: "provider"
    field :person_type, type: String, default: "juridical"
    field :status, type: String, default: "active"

    # Identification documents
    field :identification_type, type: String, default: "NIT"
    field :identification_number, type: String
    field :verification_digit, type: String # For NIT

    # Business info (juridical)
    field :business_name, type: String
    field :trade_name, type: String

    # Personal info (natural)
    field :first_name, type: String
    field :last_name, type: String

    # Contact
    field :email, type: String
    field :phone, type: String
    field :mobile, type: String
    field :website, type: String

    # Address
    field :address, type: String
    field :city, type: String
    field :state, type: String
    field :postal_code, type: String
    field :country, type: String, default: "Colombia"

    # Legal representative (for juridical)
    field :legal_rep_name, type: String
    field :legal_rep_id_type, type: String
    field :legal_rep_id_number, type: String
    field :legal_rep_id_city, type: String
    field :legal_rep_email, type: String
    field :legal_rep_phone, type: String

    # Banking info
    field :bank_name, type: String
    field :bank_account_type, type: String # savings, checking
    field :bank_account_number, type: String

    # Categorization
    field :industry, type: String
    field :tags, type: Array, default: []
    field :notes, type: String

    # Tax info
    field :tax_regime, type: String # simplified, common, special
    field :tax_responsibilities, type: Array, default: []

    # Associations
    belongs_to :organization, class_name: "Identity::Organization"
    belongs_to :created_by, class_name: "Identity::User", optional: true
    has_many :contracts, class_name: "Legal::Contract", dependent: :restrict_with_error

    # Validations
    validates :third_party_type, presence: true
    validate :valid_third_party_type
    validates :person_type, presence: true, inclusion: { in: PERSON_TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :identification_type, inclusion: { in: IDENTIFICATION_TYPES }, allow_blank: true
    validates :identification_number, presence: true, uniqueness: { scope: :organization_id }
    validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }

    # Conditional validations
    validates :business_name, presence: true, if: :juridical?
    validates :first_name, :last_name, presence: true, if: :natural?

    # Indexes
    index({ organization_id: 1, status: 1 })
    index({ organization_id: 1, third_party_type: 1 })
    index({ identification_number: 1, organization_id: 1 }, unique: true)
    index({ code: 1 }, unique: true)
    index({ email: 1 })

    # Callbacks
    before_create :generate_code

    # Scopes
    scope :active, -> { where(status: "active") }
    scope :inactive, -> { where(status: "inactive") }
    scope :blocked, -> { where(status: "blocked") }
    scope :providers, -> { where(third_party_type: "provider") }
    scope :clients, -> { where(third_party_type: "client") }
    scope :contractors, -> { where(third_party_type: "contractor") }
    scope :partners, -> { where(third_party_type: "partner") }
    scope :by_type, ->(type) { where(third_party_type: type) }
    scope :search, ->(query) {
      return all if query.blank?
      regex = /#{Regexp.escape(query)}/i
      any_of(
        { business_name: regex },
        { trade_name: regex },
        { first_name: regex },
        { last_name: regex },
        { identification_number: regex },
        { email: regex },
        { code: regex }
      )
    }

    # Custom validations
    def valid_third_party_type
      return if third_party_type.blank?

      # Check if it's a default type
      return if TYPES.include?(third_party_type)

      # Check if it's a custom type from ThirdPartyType model
      return if organization_id && ThirdPartyType.where(
        organization_id: organization_id,
        code: third_party_type,
        active: true
      ).exists?

      errors.add(:third_party_type, "is not a valid type")
    end

    # Instance methods
    def display_name
      if juridical?
        trade_name.presence || business_name
      else
        "#{first_name} #{last_name}".strip
      end
    end

    def full_name
      display_name
    end

    def juridical?
      person_type == "juridical"
    end

    def natural?
      person_type == "natural"
    end

    def active?
      status == "active"
    end

    def inactive?
      status == "inactive"
    end

    def blocked?
      status == "blocked"
    end

    def full_identification
      "#{identification_type} #{identification_number}#{verification_digit.present? ? "-#{verification_digit}" : ""}"
    end

    def full_address
      [address, city, state, country].compact.join(", ")
    end

    def type_label
      I18n.t("legal.third_party.types.#{third_party_type}", default: third_party_type.humanize)
    end

    def status_label
      I18n.t("legal.third_party.statuses.#{status}", default: status.humanize)
    end

    def activate!
      update!(status: "active")
    end

    def deactivate!
      update!(status: "inactive")
    end

    def block!(reason: nil)
      update!(status: "blocked", notes: [notes, "Bloqueado: #{reason}"].compact.join("\n"))
    end

    private

    def generate_code
      return if code.present?

      year = Time.current.year
      last_record = self.class
        .where(organization_id: organization_id)
        .where(:code.ne => nil)
        .order(created_at: :desc)
        .first

      if last_record&.code&.match?(/TER-#{year}-(\d+)/)
        last_num = last_record.code.split("-").last.to_i
        self.code = "TER-#{year}-#{(last_num + 1).to_s.rjust(5, '0')}"
      else
        self.code = "TER-#{year}-00001"
      end
    end
  end
end
