# frozen_string_literal: true

module UuidIdentifiable
  extend ActiveSupport::Concern

  included do
    field :uuid, type: String

    index({ uuid: 1 }, { unique: true })

    before_create :generate_uuid

    validates :uuid, uniqueness: true, allow_nil: true
  end

  private

  def generate_uuid
    self.uuid ||= SecureRandom.uuid
  end

  module ClassMethods
    def find_by_uuid(uuid)
      where(uuid: uuid).first
    end

    def find_by_uuid!(uuid)
      find_by_uuid(uuid) || raise(Mongoid::Errors::DocumentNotFound.new(self, { uuid: uuid }))
    end
  end
end
