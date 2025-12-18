# frozen_string_literal: true

module Identity
  class JwtDenylist
    include Mongoid::Document
    include Mongoid::Timestamps::Created

    store_in collection: "jwt_denylists"

    field :jti, type: String
    field :exp, type: Time

    index({ jti: 1 }, { unique: true })
    index({ exp: 1 }, { expire_after_seconds: 0 })

    validates :jti, presence: true, uniqueness: true

    class << self
      def jwt_revoked?(payload, _user)
        exists?(jti: payload["jti"])
      end

      def revoke_jwt(payload, _user)
        find_or_create_by(jti: payload["jti"]) do |record|
          record.exp = Time.zone.at(payload["exp"].to_i)
        end
      end

      def cleanup_expired!
        where(:exp.lt => Time.current).delete_all
      end
    end
  end
end
