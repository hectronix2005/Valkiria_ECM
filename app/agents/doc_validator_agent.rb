# frozen_string_literal: true

# =============================================================
# Valkyria ECM — DocValidatorAgent
# Valida formato, estructura, campos obligatorios, metadatos
# e integridad de cada documento generado.
#
# Triggers: document.created, document.updated, document.template_applied
# =============================================================
class DocValidatorAgent < BaseAgent
  # Metadatos que TODO documento debe tener
  REQUIRED_METADATA = %w[
    author
    created_at
    document_type
    classification
  ].freeze

  # Patrones de nomenclatura por tipo de documento
  NAMING_PATTERNS = {
    "invoice"       => /\AINV-\d{4}-\d{6}/,
    "receipt"       => /\AREC-\d{4}-\d{6}/,
    "contract"      => /\ACTR-\d{4}-\d{6}/,
    "certification" => /\ACRT-\d{4}-\d{6}/,
    "request"       => /\AREQ-\d{4}-\d{6}/
  }.freeze

  # Tipos de archivo permitidos
  ALLOWED_CONTENT_TYPES = %w[
    application/pdf
    image/png
    image/jpeg
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
  ].freeze

  # Tamaño máximo por defecto (25 MB)
  MAX_FILE_SIZE = 25.megabytes

  private

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  def run_checks
    check_template_match
    check_required_fields
    check_metadata_complete
    check_file_integrity
    check_file_format
    check_file_size
    check_naming_convention
    check_encoding
  end

  # -----------------------------------------------------------
  # Acciones correctivas
  # -----------------------------------------------------------
  def take_actions
    results[:failures].each do |failure|
      severity = rule_severity(failure[:name])

      case severity
      when :critical
        block_document(failure)
      when :warning
        flag_for_review(failure)
      else
        notify_creator(failure)
      end
    end
  end

  # -----------------------------------------------------------
  # Checks individuales
  # -----------------------------------------------------------

  # ¿La estructura del documento coincide con su plantilla?
  def check_template_match
    return unless document.respond_to?(:template) && document.template.present?
    return unless document.respond_to?(:structure_matches?)

    template = document.template
    matches = document.structure_matches?(template)

    add_check("template_match", matches, {
      template_name: template.try(:name),
      template_id: template.try(:id)
    })
  end

  # ¿Tiene todos los campos obligatorios llenos?
  def check_required_fields
    rule = load_rule("required_fields")
    return unless rule

    required = rule.rule_config.fetch("fields", [])
    missing = required.select do |field|
      value = document.try(field) || document.try(:metadata)&.dig(field)
      value.blank?
    end

    add_check("required_fields", missing.empty?, {
      required: required,
      missing: missing
    })
  end

  # ¿Están presentes todos los metadatos requeridos?
  def check_metadata_complete
    return unless document.respond_to?(:metadata) && document.metadata.is_a?(Hash)

    metadata = document.metadata
    missing = REQUIRED_METADATA.select { |key| metadata[key].blank? }

    add_check("metadata_complete", missing.empty?, {
      required: REQUIRED_METADATA,
      missing: missing
    })
  end

  # ¿El archivo no está corrupto? (checksum)
  def check_file_integrity
    return unless document.respond_to?(:file) && document.file.try(:attached?)

    blob = document.file.blob
    expected = document.try(:expected_checksum)

    if expected.present?
      matches = blob.checksum == expected
      add_check("file_integrity", matches, {
        expected_checksum: expected,
        actual_checksum: blob.checksum
      })
    else
      # Si no hay checksum esperado, verificar que el blob sea legible
      add_check("file_integrity", blob.present?, {
        note: "No hay checksum de referencia, se verificó existencia del blob"
      })
    end
  end

  # ¿El formato del archivo es permitido?
  def check_file_format
    return unless document.respond_to?(:file) && document.file.try(:attached?)

    content_type = document.file.blob.content_type
    allowed = ALLOWED_CONTENT_TYPES

    # Verificar si hay regla personalizada para este tipo de documento
    rule = load_rule("allowed_formats")
    allowed = rule.rule_config.fetch("types", allowed) if rule

    valid = allowed.include?(content_type)
    add_check("file_format", valid, {
      content_type: content_type,
      allowed: allowed
    })
  end

  # ¿El tamaño está dentro de los límites?
  def check_file_size
    return unless document.respond_to?(:file) && document.file.try(:attached?)

    size = document.file.blob.byte_size
    max = MAX_FILE_SIZE

    rule = load_rule("max_file_size")
    max = rule.rule_config.fetch("bytes", max) if rule

    valid = size <= max
    add_check("file_size", valid, {
      actual_bytes: size,
      max_bytes: max,
      actual_readable: number_to_human_size(size),
      max_readable: number_to_human_size(max)
    })
  end

  # ¿El nombre del archivo sigue la convención?
  def check_naming_convention
    filename = document.try(:filename) || document.try(:file)&.try(:filename)&.to_s
    return unless filename.present?

    doc_type = document.try(:document_type) || "default"
    pattern = NAMING_PATTERNS[doc_type] || /\ADOC-\d{4}-\d{6}/

    # Verificar si hay regla personalizada
    rule = load_rule("naming_convention")
    if rule
      custom_pattern = rule.rule_config.fetch("pattern", nil)
      pattern = Regexp.new(custom_pattern) if custom_pattern
    end

    matches = filename.match?(pattern)
    add_check("naming_convention", matches, {
      filename: filename,
      expected_pattern: pattern.source,
      document_type: doc_type
    })
  end

  # ¿El encoding es correcto?
  def check_encoding
    return unless document.respond_to?(:content) && document.content.present?

    valid_encoding = document.content.valid_encoding?
    is_utf8 = document.content.encoding == Encoding::UTF_8

    add_check("encoding", valid_encoding && is_utf8, {
      detected_encoding: document.content.encoding.name,
      valid: valid_encoding
    })
  end

  # -----------------------------------------------------------
  # Acciones
  # -----------------------------------------------------------
  def block_document(failure)
    alert!(:critical, "Documento #{document.id} bloqueado: #{failure[:name]}")
    add_action("block_document", { reason: failure[:name] })
  end

  def flag_for_review(failure)
    alert!(:warning, "Documento #{document.id} requiere revisión: #{failure[:name]}")
    add_action("flag_for_review", { reason: failure[:name] })
  end

  def notify_creator(failure)
    alert!(:info, "Aviso en documento #{document.id}: #{failure[:name]}")
    add_action("notify_creator", { reason: failure[:name] })
  end

  # -----------------------------------------------------------
  # Utilidades
  # -----------------------------------------------------------
  def number_to_human_size(bytes)
    ActionController::Base.helpers.number_to_human_size(bytes)
  rescue StandardError
    "#{bytes} bytes"
  end
end
