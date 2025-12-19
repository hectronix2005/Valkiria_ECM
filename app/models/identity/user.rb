# frozen_string_literal: true

module Identity
  class User
    include Mongoid::Document
    include Mongoid::Timestamps
    include UuidIdentifiable
    include SoftDeletable
    include AuditTrackable

    # Devise modules
    devise :database_authenticatable, :registerable,
           :recoverable, :rememberable, :validatable,
           :trackable, :lockable,
           :jwt_authenticatable, jwt_revocation_strategy: JwtDenylist

    # Devise-JWT compatibility for Mongoid (ActiveRecord compatibility)
    def self.primary_key
      "_id"
    end

    store_in collection: "users"

    # Basic fields
    field :email, type: String
    field :first_name, type: String
    field :last_name, type: String
    field :employee_id, type: String
    field :department, type: String
    field :title, type: String
    field :phone, type: String
    field :time_zone, type: String, default: "UTC"
    field :locale, type: String, default: "en"
    field :active, type: Boolean, default: true

    # Devise fields
    field :encrypted_password, type: String, default: ""
    field :reset_password_token, type: String
    field :reset_password_sent_at, type: Time
    field :remember_created_at, type: Time

    # Trackable
    field :sign_in_count, type: Integer, default: 0
    field :current_sign_in_at, type: Time
    field :last_sign_in_at, type: Time
    field :current_sign_in_ip, type: String
    field :last_sign_in_ip, type: String

    # Lockable
    field :failed_attempts, type: Integer, default: 0
    field :unlock_token, type: String
    field :locked_at, type: Time

    # Password change required (for new users created from contracts)
    field :must_change_password, type: Boolean, default: false
    field :password_changed_at, type: Time

    # Indexes
    index({ email: 1 }, { unique: true })
    index({ employee_id: 1 }, { sparse: true })
    index({ reset_password_token: 1 }, { unique: true, sparse: true })
    index({ unlock_token: 1 }, { unique: true, sparse: true })
    index({ organization_id: 1 })
    index({ active: 1 })
    index({ last_name: 1, first_name: 1 })

    # Associations
    belongs_to :organization, class_name: "Identity::Organization", inverse_of: :users, optional: true
    has_and_belongs_to_many :roles, class_name: "Identity::Role", inverse_of: :users
    has_many :signatures, class_name: "Identity::UserSignature", inverse_of: :user, dependent: :destroy

    # Validations
    validates :email, presence: true, uniqueness: true
    validates :first_name, presence: true, length: { maximum: 50 }
    validates :last_name, presence: true, length: { maximum: 50 }
    validates :employee_id, uniqueness: true, allow_blank: true

    # Scopes
    scope :enabled, -> { where(active: true) }
    scope :disabled, -> { where(active: false) }
    scope :admins, -> { where(:role_ids.in => [Identity::Role.where(name: "admin").first&.id].compact) }

    # Callbacks
    after_create :assign_default_role

    # Instance methods
    def full_name
      "#{first_name} #{last_name}".strip
    end

    def initials
      "#{first_name&.first}#{last_name&.first}".upcase
    end

    def admin?
      roles.any?(&:admin?)
    end

    def super_admin?
      admin? # For now, admin is super_admin
    end

    def has_role?(role_name)
      roles.exists?(name: role_name)
    end

    def has_permission?(permission_name)
      return true if admin?

      roles.any? { |role| role.has_permission?(permission_name) }
    end

    def can?(action, resource)
      return true if admin?

      roles.any? { |role| role.can?(action, resource) }
    end

    def permission_names
      return ["*"] if admin? # Admin has all permissions

      roles.flat_map(&:permission_names).uniq
    end

    def role_names
      roles.pluck(:name)
    end

    def highest_role
      roles.by_level.first
    end

    def activate!
      update!(active: true)
    end

    def deactivate!
      update!(active: false)
    end

    def assign_role!(role_name)
      role = Identity::Role.find_by!(name: role_name)
      roles << role unless roles.include?(role)
    end

    def remove_role!(role_name)
      role = Identity::Role.find_by!(name: role_name)
      roles.delete(role)
    end

    def default_signature
      signatures.default_signature.first || signatures.first
    end

    def has_signature?
      signatures.any?
    end

    # JWT payload customization
    def jwt_payload
      {
        "user_id" => id.to_s,
        "email" => email,
        "roles" => role_names,
        "organization_id" => organization_id&.to_s,
        "must_change_password" => must_change_password
      }
    end

    # Mark password as changed
    def password_changed!
      update!(must_change_password: false, password_changed_at: Time.current)
    end

    private

    def assign_default_role
      return if roles.any?

      default_role = Identity::Role.where(name: Identity::Role::EMPLOYEE).first
      roles << default_role if default_role
    end
  end
end
