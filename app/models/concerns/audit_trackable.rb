# frozen_string_literal: true

module AuditTrackable
  extend ActiveSupport::Concern

  included do
    after_create :audit_create
    after_update :audit_update
    after_destroy :audit_destroy

    class_attribute :audit_skip_fields, default: ["updated_at", "created_at", "search_text"]
    class_attribute :audit_enabled, default: true
  end

  module ClassMethods
    def skip_audit_for(*fields)
      self.audit_skip_fields = audit_skip_fields + fields.map(&:to_s)
    end

    def disable_audit
      self.audit_enabled = false
    end

    def without_audit
      original_value = audit_enabled
      self.audit_enabled = false
      yield
    ensure
      self.audit_enabled = original_value
    end
  end

  private

  def audit_create
    return unless audit_enabled?

    Audit::AuditEvent.log_model_change(self, "create", auditable_attributes)
  end

  def audit_update
    return unless audit_enabled?
    return if auditable_changes.empty?

    Audit::AuditEvent.log_model_change(self, "update", auditable_changes)
  end

  def audit_destroy
    return unless audit_enabled?

    Audit::AuditEvent.log_model_change(self, "delete", auditable_attributes)
  end

  def audit_enabled?
    self.class.audit_enabled
  end

  def auditable_changes
    changes.except(*self.class.audit_skip_fields)
  end

  def auditable_attributes
    attributes.except(*self.class.audit_skip_fields)
  end
end
