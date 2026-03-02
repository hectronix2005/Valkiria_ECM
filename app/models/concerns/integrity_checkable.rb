# frozen_string_literal: true

module IntegrityCheckable
  extend ActiveSupport::Concern

  INTEGRITY_PENDING = "pending"
  INTEGRITY_PASSED  = "passed"
  INTEGRITY_WARNING = "warning"
  INTEGRITY_FAILED  = "failed"
  INTEGRITY_STATUSES = [INTEGRITY_PENDING, INTEGRITY_PASSED, INTEGRITY_WARNING, INTEGRITY_FAILED].freeze

  MAX_INTEGRITY_CHECKS = 50

  included do
    field :integrity_status, type: String, default: INTEGRITY_PENDING
    field :integrity_checks, type: Array, default: []
    field :last_integrity_check_at, type: Time

    index({ integrity_status: 1 })

    scope :integrity_failed, -> { where(integrity_status: INTEGRITY_FAILED) }
    scope :integrity_warning, -> { where(integrity_status: INTEGRITY_WARNING) }
  end

  # Convenience method to run integrity checks.
  # trigger: "post_generation" or "post_signature"
  def run_integrity_check!(trigger:)
    Templates::DocumentIntegrityService.new(self, trigger: trigger).run!
  rescue StandardError => e
    Rails.logger.error("[IntegrityCheckable] Check failed for #{self.class.name}##{id}: #{e.message}")
  end
end
