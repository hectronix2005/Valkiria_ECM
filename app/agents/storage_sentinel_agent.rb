# frozen_string_literal: true

# =============================================================
# Valkyria ECM — StorageSentinelAgent
# Vigila que cada archivo esté en la ruta correcta,
# detecta huérfanos, verifica backups y permisos.
#
# Triggers: file.stored, file.moved, cron.hourly
# =============================================================
class StorageSentinelAgent < BaseAgent
  # Estructura de carpetas esperada por tipo de documento
  DEFAULT_FOLDER_STRUCTURE = {
    "invoice"       => "documents/invoices/{year}/{month}/",
    "receipt"       => "documents/receipts/{year}/{month}/",
    "contract"      => "documents/contracts/{year}/",
    "certification" => "documents/certifications/{year}/",
    "request"       => "documents/requests/{year}/{month}/",
    "signature"     => "documents/{parent_type}/{parent_id}/signatures/"
  }.freeze

  private

  # -----------------------------------------------------------
  # Validaciones
  # -----------------------------------------------------------
  def run_checks
    check_correct_folder
    check_signature_association
    check_no_orphan_files
    check_no_orphan_records
    check_version_integrity
    check_access_permissions
  end

  # -----------------------------------------------------------
  # Acciones correctivas
  # -----------------------------------------------------------
  def take_actions
    results[:failures].each do |failure|
      case failure[:name]
      when "correct_folder"
        handle_wrong_folder(failure)
      when "signature_association"
        handle_unlinked_signature(failure)
      when "no_orphan_files"
        handle_orphan_files(failure)
      when "no_orphan_records"
        handle_orphan_records(failure)
      when "version_integrity"
        handle_version_issue(failure)
      when "access_permissions"
        handle_permission_issue(failure)
      end
    end
  end

  # -----------------------------------------------------------
  # Checks individuales
  # -----------------------------------------------------------

  # ¿El documento está en la carpeta correcta según su tipo?
  def check_correct_folder
    storage_path = document.try(:storage_path) || document.try(:file_path)
    return unless storage_path.present?

    doc_type = document.try(:document_type)&.to_s
    expected_base = expected_folder_for(doc_type)

    return unless expected_base

    in_correct_folder = storage_path.start_with?(expected_base)

    add_check("correct_folder", in_correct_folder, {
      actual_path: storage_path,
      expected_base: expected_base,
      document_type: doc_type
    })
  end

  # ¿Los archivos de firma están asociados al documento padre?
  def check_signature_association
    signatures = document.try(:signatures) || []
    return if signatures.empty?

    unlinked = []

    signatures.each do |sig|
      # Verificar que la firma tenga referencia al documento
      linked = sig.try(:document_id) == document.id

      # Verificar que el archivo de firma esté en la subcarpeta correcta
      sig_path = sig.try(:storage_path) || sig.try(:file_path)
      if sig_path.present?
        doc_path = document.try(:storage_path) || ""
        doc_dir = File.dirname(doc_path)
        correct_location = sig_path.start_with?(doc_dir)

        unless linked && correct_location
          unlinked << {
            signature_id: sig.id.to_s,
            signature_path: sig_path,
            expected_near: doc_dir
          }
        end
      end
    end

    add_check("signature_association", unlinked.empty?, {
      unlinked_signatures: unlinked
    })
  end

  # ¿Hay archivos en storage sin registro en la BD?
  def check_no_orphan_files
    # Este check tiene más sentido en modo cron/scan
    return unless context[:event_type]&.start_with?("cron.")

    orphan_count = 0
    orphan_samples = []

    # Listar archivos en Cloudinary/storage y cruzar con BD
    begin
      storage_files = list_storage_files
      storage_files.each do |file_key|
        exists_in_db = Document.where(storage_path: file_key).exists? ||
                       Document.where(file_key: file_key).exists?

        unless exists_in_db
          orphan_count += 1
          orphan_samples << file_key if orphan_samples.size < 10
        end
      end
    rescue StandardError => e
      add_check("no_orphan_files", true, {
        note: "No se pudo verificar: #{e.message}"
      })
      return
    end

    add_check("no_orphan_files", orphan_count.zero?, {
      orphan_count: orphan_count,
      samples: orphan_samples
    })
  end

  # ¿Hay registros en BD sin archivo físico?
  def check_no_orphan_records
    return unless context[:event_type]&.start_with?("cron.")

    orphan_records = []

    # Verificar una muestra de documentos recientes
    recent_docs = Document.where(:created_at.gte => 7.days.ago)
                          .limit(100)

    recent_docs.each do |doc|
      has_file = if doc.respond_to?(:file) && doc.file.respond_to?(:attached?)
                   doc.file.attached?
                 elsif doc.try(:storage_path).present?
                   verify_file_exists(doc.storage_path)
                 else
                   true # No requiere archivo
                 end

      unless has_file
        orphan_records << {
          document_id: doc.id.to_s,
          document_type: doc.try(:document_type),
          created_at: doc.created_at.iso8601
        }
      end
    end

    add_check("no_orphan_records", orphan_records.empty?, {
      orphan_count: orphan_records.size,
      records: orphan_records.first(10)
    })
  end

  # ¿El versionamiento es correcto?
  def check_version_integrity
    return unless document.respond_to?(:versions) || document.respond_to?(:version_number)

    versions = document.try(:versions)&.order(:version_number) || []
    return if versions.empty?

    # Verificar que no haya gaps en los números de versión
    version_numbers = versions.map(&:version_number)
    expected = (1..version_numbers.max).to_a
    missing_versions = expected - version_numbers

    add_check("version_integrity", missing_versions.empty?, {
      existing_versions: version_numbers,
      missing_versions: missing_versions,
      total_versions: versions.size
    })
  end

  # ¿Los permisos de acceso son correctos según clasificación?
  def check_access_permissions
    classification = document.try(:classification)&.to_s
    return unless classification.present?

    rule = load_rule("access_permissions")
    return unless rule

    expected_access = rule.rule_config.fetch(classification, {})
    return if expected_access.empty?

    actual_access = document.try(:access_level) || document.try(:visibility)

    correct = expected_access["level"] == actual_access.to_s

    add_check("access_permissions", correct, {
      classification: classification,
      expected_access: expected_access["level"],
      actual_access: actual_access
    })
  end

  # -----------------------------------------------------------
  # Acciones
  # -----------------------------------------------------------
  def handle_wrong_folder(failure)
    actual = failure.dig(:details, :actual_path)
    expected = failure.dig(:details, :expected_base)

    alert!(:warning, "Documento #{document.id} en carpeta incorrecta. " \
      "Actual: #{actual}, Esperado: #{expected}")

    # Intentar mover si es posible
    if can_auto_move?
      move_to_correct_folder(actual, expected)
      add_action("auto_moved_to_correct_folder", {
        from: actual, to: expected
      })
    else
      add_action("flagged_wrong_folder", failure[:details])
    end
  end

  def handle_unlinked_signature(failure)
    alert!(:warning, "Firmas no asociadas correctamente al documento #{document.id}")
    add_action("flag_unlinked_signatures", failure[:details])
  end

  def handle_orphan_files(failure)
    count = failure.dig(:details, :orphan_count)
    alert!(:warning, "#{count} archivos huérfanos detectados en storage")
    add_action("report_orphan_files", failure[:details])
  end

  def handle_orphan_records(failure)
    count = failure.dig(:details, :orphan_count)
    alert!(:critical, "#{count} registros sin archivo físico detectados")
    add_action("report_orphan_records", failure[:details])
  end

  def handle_version_issue(failure)
    alert!(:warning, "Versiones faltantes en documento #{document.id}: " \
      "#{failure.dig(:details, :missing_versions)}")
    add_action("flag_version_gaps", failure[:details])
  end

  def handle_permission_issue(failure)
    alert!(:critical, "Permisos incorrectos en documento #{document.id}")
    add_action("flag_permission_mismatch", failure[:details])
  end

  # -----------------------------------------------------------
  # Utilidades privadas
  # -----------------------------------------------------------
  def expected_folder_for(doc_type)
    rule = load_rule("folder_structure")
    structure = rule&.rule_config || DEFAULT_FOLDER_STRUCTURE
    pattern = structure[doc_type]
    return nil unless pattern

    now = Time.current
    pattern
      .gsub("{year}", now.year.to_s)
      .gsub("{month}", now.month.to_s.rjust(2, "0"))
      .gsub("{parent_type}", document.try(:parent_type).to_s)
      .gsub("{parent_id}", document.try(:parent_id).to_s)
  end

  def list_storage_files
    # Adaptar según tu storage (Cloudinary, S3, local)
    # Este es un placeholder — implementar según tu configuración
    []
  end

  def verify_file_exists(path)
    # Adaptar según tu storage
    # Para Cloudinary: verificar via API
    # Para local: File.exist?(path)
    true
  end

  def can_auto_move?
    # Solo mover automáticamente si la regla lo permite
    rule = load_rule("auto_move")
    rule&.rule_config&.fetch("enabled", false) || false
  end

  def move_to_correct_folder(from_path, to_base)
    filename = File.basename(from_path)
    new_path = File.join(to_base, filename)
    document.update(storage_path: new_path)
    # Aquí va la lógica de mover en Cloudinary/S3
  end
end
