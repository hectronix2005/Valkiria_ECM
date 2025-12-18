# frozen_string_literal: true

module SoftDeletable
  extend ActiveSupport::Concern

  included do
    field :deleted_at, type: Time
    field :deleted_by_id, type: BSON::ObjectId

    index({ deleted_at: 1 })

    scope :active, -> { where(deleted_at: nil) }
    scope :deleted, -> { where(:deleted_at.ne => nil) }
    scope :with_deleted, -> { unscoped }

    default_scope -> { active }
  end

  def soft_delete(user = nil)
    return false if deleted?

    update(
      deleted_at: Time.current,
      deleted_by_id: (user || Current.user)&.id
    )
  end

  def soft_delete!(user = nil)
    soft_delete(user) || raise(Mongoid::Errors::DocumentNotFound.new(self.class, id))
  end

  def restore
    return false unless deleted?

    update(
      deleted_at: nil,
      deleted_by_id: nil
    )
  end

  def restore!
    restore || raise(Mongoid::Errors::DocumentNotFound.new(self.class, id))
  end

  def deleted?
    deleted_at.present?
  end

  def deleted_by
    return nil unless deleted_by_id

    @deleted_by ||= Identity::User.find(deleted_by_id)
  rescue Mongoid::Errors::DocumentNotFound
    nil
  end

  module ClassMethods
    def soft_delete_all(user = nil)
      update_all(
        deleted_at: Time.current,
        deleted_by_id: (user || Current.user)&.id
      )
    end

    def restore_all
      unscoped.where(:deleted_at.ne => nil).update_all(
        deleted_at: nil,
        deleted_by_id: nil
      )
    end
  end
end
