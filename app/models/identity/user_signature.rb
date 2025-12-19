# frozen_string_literal: true

module Identity
  class UserSignature
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable

    store_in collection: "user_signatures"

    # Signature types
    DRAWN = "drawn"
    STYLED = "styled"
    SIGNATURE_TYPES = [DRAWN, STYLED].freeze

    # Available fonts for styled signatures
    SIGNATURE_FONTS = [
      "Allura",
      "Dancing Script",
      "Great Vibes",
      "Pacifico",
      "Sacramento"
    ].freeze

    # Fields
    field :name, type: String                    # Name for this signature (e.g., "Formal", "Initials")
    field :signature_type, type: String          # drawn or styled
    field :is_default, type: Boolean, default: false

    # For drawn signatures - stored as base64 PNG
    field :image_data, type: String              # Base64 encoded PNG image

    # For styled signatures
    field :styled_text, type: String             # The text to display
    field :font_family, type: String             # Font name from SIGNATURE_FONTS
    field :font_color, type: String, default: "#000000"
    field :font_size, type: Integer, default: 48

    # Associations
    belongs_to :user, class_name: "Identity::User", inverse_of: :signatures

    # Indexes
    index({ user_id: 1 })
    index({ user_id: 1, is_default: 1 })
    index({ signature_type: 1 })

    # Validations
    validates :name, presence: true, length: { maximum: 100 }
    validates :signature_type, presence: true, inclusion: { in: SIGNATURE_TYPES }
    validates :image_data, presence: true, if: -> { signature_type == DRAWN }
    validates :styled_text, presence: true, if: -> { signature_type == STYLED }
    validates :font_family, presence: true, inclusion: { in: SIGNATURE_FONTS }, if: -> { signature_type == STYLED }

    validate :only_one_default_per_user

    # Scopes
    scope :drawn, -> { where(signature_type: DRAWN) }
    scope :styled, -> { where(signature_type: STYLED) }
    scope :default_signature, -> { where(is_default: true) }

    # Callbacks
    before_save :ensure_single_default
    after_destroy :ensure_default_exists

    # Instance methods
    def drawn?
      signature_type == DRAWN
    end

    def styled?
      signature_type == STYLED
    end

    def set_as_default!
      user.signatures.update_all(is_default: false)
      update!(is_default: true)
    end

    # Returns the signature as a renderable format for PDF
    def to_image_data
      if drawn?
        # Return the base64 PNG data directly
        image_data
      else
        # For styled signatures, we'll render server-side using MiniMagick
        render_styled_signature
      end
    end

    # Render styled signature as base64 PNG image
    def render_styled_signature
      return image_data if image_data.present? && styled?

      Templates::SignatureRendererService.new(self).render_styled
    end

    private

    def only_one_default_per_user
      return unless is_default && is_default_changed?

      if user&.signatures&.where(is_default: true)&.where(:id.ne => id)&.exists?
        # This is fine, we'll update in before_save callback
      end
    end

    def ensure_single_default
      return unless is_default && is_default_changed?

      user.signatures.where(:id.ne => id).update_all(is_default: false)
    end

    def ensure_default_exists
      return unless is_default
      return unless user.signatures.any?

      # Set the first remaining signature as default
      user.signatures.first.update!(is_default: true)
    end
  end
end
