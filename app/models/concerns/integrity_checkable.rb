# frozen_string_literal: true

# Adds document integrity tracking fields and helpers to GeneratedDocument.
#
# Fields added:
#   integrity_status       — "pending" | "passed" | "warning" | "failed"
#   integrity_checks       — Array of check result hashes (capped at 50)
#   last_integrity_check_at — Time of most recent check run
#
# Usage:
#   doc.run_integrity_check!(trigger: "post_generation")
#   doc.run_integrity_check!(trigger: "post_signature")
#   doc.integrity_passed?          # => true/false
#   doc.latest_integrity_checks    # => last 20, sorted by checked_at
module IntegrityCheckable
  extend ActiveSupport::Concern

  INTEGRITY_PENDING = "pending"
  INTEGRITY_PASSED  = "passed"
  INTEGRITY_WARNING = "warning"
  INTEGRITY_FAILED  = "failed"
  INTEGRITY_STATUSES = [INTEGRITY_PENDING, INTEGRITY_PASSED, INTEGRITY_WARNING, INTEGRITY_FAILED].freeze

  # Maximum check entries stored on a single document to prevent unbounded growth.
  MAX_INTEGRITY_CHECKS = 50

  included do
    field :integrity_status, type: String, default: INTEGRITY_PENDING
    field :integrity_checks, type: Array, default: []
    field :last_integrity_check_at, type: Time

    index({ integrity_status: 1 })

    scope :integrity_failed,  -> { where(integrity_status: INTEGRITY_FAILED) }
    scope :integrity_warning, -> { where(integrity_status: INTEGRITY_WARNING) }
    scope :integrity_passed,  -> { where(integrity_status: INTEGRITY_PASSED) }
  end

  # Run integrity checks for the given trigger.
  # trigger: Templates::DocumentIntegrityService::TRIGGER_POST_GENERATION
  #       or Templates::DocumentIntegrityService::TRIGGER_POST_SIGNATURE
  # Non-blocking — rescues all errors so the caller is never affected.
  def run_integrity_check!(trigger:)
    Templates::DocumentIntegrityService.new(self, trigger: trigger).call
  rescue StandardError => e
    Rails.logger.error("[IntegrityCheckable] Check failed for #{self.class.name}##{id}: #{e.message}")
  end

  def integrity_passed?
    integrity_status == INTEGRITY_PASSED
  end

  def integrity_failed?
    integrity_status == INTEGRITY_FAILED
  end

  def integrity_warning?
    integrity_status == INTEGRITY_WARNING
  end

  def integrity_pending?
    integrity_status == INTEGRITY_PENDING
  end

  # Returns the most recent 20 check results, newest last.
  def latest_integrity_checks
    (integrity_checks || []).sort_by { |c| c["at"].to_s }.last(20)
  end
end
