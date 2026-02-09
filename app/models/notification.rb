# frozen_string_literal: true

class Notification
  include Mongoid::Document
  include Mongoid::Timestamps
  include UuidIdentifiable

  store_in collection: "notifications"

  # Fields
  field :category, type: String   # e.g. "vacation", "certification"
  field :action, type: String     # e.g. "submitted", "approved", "rejected", "completed"
  field :title, type: String
  field :body, type: String
  field :read_at, type: Time
  field :link, type: String       # frontend route to navigate to
  field :source_type, type: String # e.g. "Hr::VacationRequest"
  field :source_uuid, type: String
  field :actor_name, type: String  # who triggered the notification

  # Associations
  belongs_to :recipient, class_name: "Identity::User"
  belongs_to :organization, class_name: "Identity::Organization"

  # Indexes
  index({ recipient_id: 1, read_at: 1, created_at: -1 })
  index({ recipient_id: 1, created_at: -1 })

  # Validations
  validates :title, presence: true
  validates :category, presence: true
  validates :action, presence: true

  # Scopes
  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc).limit(20) }
  scope :for_user, ->(user) { where(recipient: user) }

  def read?
    read_at.present?
  end

  def mark_as_read!
    update!(read_at: Time.current) unless read?
  end

  def self.mark_all_read!(user, organization)
    where(recipient: user, organization: organization, read_at: nil)
      .update_all(read_at: Time.current)
  end
end
