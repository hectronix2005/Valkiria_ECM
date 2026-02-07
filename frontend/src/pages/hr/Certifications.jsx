import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { certificationService, templateService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { FileText, Plus, X, Eye, Filter, Clock, CheckCircle, AlertCircle, Calendar, Download, FilePlus, Loader2, AlertTriangle, ExternalLink, Trash2, PenTool, Settings, Save, FileCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// Default certification types (fallback if API fails)
const defaultCertificationTypes = [
  { value: 'employment', label: 'Certificación Laboral Básica' },
  { value: 'salary', label: 'Certificación con Salario' },
  { value: 'position', label: 'Certificación de Cargo' },
  { value: 'full', label: 'Certificación Completa' },
  { value: 'custom', label: 'Certificación Personalizada' },
]

const purposes = [
  { value: 'bank', label: 'Entidad Bancaria / Crédito' },
  { value: 'visa', label: 'Trámite de Visa' },
  { value: 'rental', label: 'Arrendamiento / Inmobiliaria' },
  { value: 'government', label: 'Trámite Gubernamental' },
  { value: 'legal', label: 'Proceso Legal' },
  { value: 'other', label: 'Otro' },
]

const languages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
]

const statusFilters = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'processing', label: 'En Proceso' },
  { value: 'completed', label: 'Completado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'cancelled', label: 'Cancelado' },
]

// Type filters will be built dynamically from available types

const typeLabels = {
  employment: 'Certificación Laboral',
  salary: 'Con Salario',
  position: 'Certificación de Cargo',
  full: 'Certificación Completa',
  custom: 'Personalizada',
}

const purposeLabels = {
  bank: 'Entidad Bancaria',
  visa: 'Trámite de Visa',
  rental: 'Arrendamiento',
  government: 'Trámite Gubernamental',
  legal: 'Proceso Legal',
  other: 'Otro',
}

const estimatedDays = {
  employment: 1,
  salary: 2,
  position: 1,
  full: 3,
  custom: 3,
}

function CertificationForm({ onSubmit, onCancel, loading, initialType, availableTypes }) {
  // Use available types from API, or fall back to defaults
  const certificationTypes = availableTypes?.length > 0 ? availableTypes : defaultCertificationTypes

  // Get the first available type as default
  const defaultType = initialType && certificationTypes.find(t => t.value === initialType)
    ? initialType
    : certificationTypes[0]?.value || 'employment'

  const [formData, setFormData] = useState({
    certification_type: defaultType,
    purpose: 'bank',
    purpose_details: '',
    language: 'es',
    addressee: '',
    special_instructions: '',
  })

  // Update form when initialType changes (when clicking info cards)
  useEffect(() => {
    if (initialType && certificationTypes.find(t => t.value === initialType)) {
      setFormData(prev => ({
        ...prev,
        certification_type: initialType,
      }))
    }
  }, [initialType, certificationTypes])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const selectedType = formData.certification_type

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Tipo de Certificación"
        options={certificationTypes}
        value={formData.certification_type}
        onChange={(e) => setFormData({ ...formData, certification_type: e.target.value })}
        required
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-blue-700">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">
            Tiempo estimado: {estimatedDays[selectedType]} día{estimatedDays[selectedType] > 1 ? 's' : ''} hábil{estimatedDays[selectedType] > 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      <Select
        label="Propósito"
        options={purposes}
        value={formData.purpose}
        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
        required
      />

      {formData.purpose === 'other' && (
        <Input
          label="Especifique el propósito"
          value={formData.purpose_details}
          onChange={(e) => setFormData({ ...formData, purpose_details: e.target.value })}
          placeholder="Describa el propósito de la certificación..."
          required
        />
      )}

      <Select
        label="Idioma"
        options={languages}
        value={formData.language}
        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
      />

      <Input
        label="Dirigido a (opcional)"
        value={formData.addressee}
        onChange={(e) => setFormData({ ...formData, addressee: e.target.value })}
        placeholder="Ej: A quien corresponda, Banco XYZ, Embajada..."
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Instrucciones especiales (opcional)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          value={formData.special_instructions}
          onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
          placeholder="Información adicional o requisitos especiales..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Solicitar Certificación
        </Button>
      </div>
    </form>
  )
}

const statusIcons = {
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  processing: <Clock className="w-4 h-4 text-blue-500 animate-pulse" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  rejected: <AlertCircle className="w-4 h-4 text-red-500" />,
  cancelled: <X className="w-4 h-4 text-gray-400" />,
}

// Admin component for managing certification types
function CertificationTypeConfig({ onClose }) {
  const [certTypes, setCertTypes] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [newType, setNewType] = useState({ code: '', label: '', description: '', template_id: '' })
  const queryClient = useQueryClient()

  // Fetch certification templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['admin-certification-templates'],
    queryFn: () => templateService.list({ category: 'certification', status: 'active' }),
  })

  const templates = templatesData?.data?.data || []

  // Initialize certTypes from templates that have certification_type set
  useEffect(() => {
    if (templates.length > 0) {
      const typesFromTemplates = templates
        .filter(t => t.certification_type)
        .map(t => ({
          code: t.certification_type,
          label: typeLabels[t.certification_type] || t.certification_type,
          description: '',
          template_id: t.id,
          template_name: t.name,
          variables: t.variables || []
        }))
      setCertTypes(typesFromTemplates)
    }
  }, [templates])

  // Available templates for a given type (not assigned OR currently assigned to this type)
  const getAvailableTemplatesForType = (currentTemplateId) => {
    return templates.filter(t => !t.certification_type || t.id === currentTemplateId)
  }

  // Available templates (not yet assigned to a certification type)
  const availableTemplates = templates.filter(t => !t.certification_type)

  const handleAddType = () => {
    if (!newType.code || !newType.template_id) {
      alert('Debe ingresar un código y seleccionar un template')
      return
    }
    if (certTypes.find(t => t.code === newType.code)) {
      alert('Ya existe un tipo con ese código')
      return
    }
    const template = templates.find(t => t.id === newType.template_id)
    setCertTypes([...certTypes, {
      ...newType,
      template_name: template?.name,
      variables: template?.variables || []
    }])
    setNewType({ code: '', label: '', description: '', template_id: '' })
  }

  const handleRemoveType = (code) => {
    setCertTypes(certTypes.filter(t => t.code !== code))
    if (editingCode === code) setEditingCode(null)
  }

  const handleEditType = (code) => {
    setEditingCode(editingCode === code ? null : code)
  }

  const handleUpdateTypeTemplate = (code, newTemplateId) => {
    const template = templates.find(t => t.id === newTemplateId)
    setCertTypes(certTypes.map(t =>
      t.code === code
        ? { ...t, template_id: newTemplateId, template_name: template?.name, variables: template?.variables || [] }
        : t
    ))
  }

  const handleUpdateTypeLabel = (code, newLabel) => {
    setCertTypes(certTypes.map(t =>
      t.code === code ? { ...t, label: newLabel } : t
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // First, clear certification_type from all templates that are no longer in the list
      // or have been reassigned to a different type
      for (const template of templates) {
        const assignedType = certTypes.find(t => t.template_id === template.id)
        if (template.certification_type && !assignedType) {
          // Template was assigned but is no longer in the list
          await templateService.update(template.id, {
            template: { certification_type: null }
          })
        } else if (template.certification_type && assignedType && template.certification_type !== assignedType.code) {
          // Template's type code changed (edge case)
          await templateService.update(template.id, {
            template: { certification_type: assignedType.code }
          })
        }
      }

      // Update each template with its certification_type
      for (const certType of certTypes) {
        if (certType.template_id) {
          await templateService.update(certType.template_id, {
            template: { certification_type: certType.code }
          })
        }
      }

      queryClient.invalidateQueries(['certification-available-types'])
      queryClient.invalidateQueries(['admin-certification-templates'])
      alert('Configuración guardada exitosamente')
      onClose()
    } catch (error) {
      console.error('Error saving certification types:', error)
      alert('Error al guardar: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Configure los tipos de certificación disponibles. Cada tipo debe tener un template asociado.
      </p>

      {/* Existing types */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Tipos Configurados</h4>
        {certTypes.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No hay tipos configurados</p>
        ) : (
          <div className="space-y-2">
            {certTypes.map((type) => (
              <div key={type.code} className={`p-3 border rounded-lg ${editingCode === type.code ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-gray-200 px-2 py-0.5 rounded">{type.code}</code>
                      {editingCode === type.code ? (
                        <input
                          type="text"
                          value={type.label}
                          onChange={(e) => handleUpdateTypeLabel(type.code, e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Etiqueta"
                        />
                      ) : (
                        <span className="font-medium">{type.label}</span>
                      )}
                    </div>
                    {editingCode === type.code ? (
                      <div className="mt-2">
                        <label className="block text-xs text-gray-500 mb-1">Template asociado:</label>
                        <select
                          value={type.template_id}
                          onChange={(e) => handleUpdateTypeTemplate(type.code, e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {getAvailableTemplatesForType(type.template_id).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <FileCheck className="w-4 h-4" />
                        <span>{type.template_name}</span>
                      </div>
                    )}
                    {type.variables?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Variables requeridas:</p>
                        <div className="flex flex-wrap gap-1">
                          {type.variables.slice(0, 5).map((v, i) => (
                            <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {v}
                            </span>
                          ))}
                          {type.variables.length > 5 && (
                            <span className="text-xs text-gray-500">+{type.variables.length - 5} más</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditType(type.code)}
                      className={`p-1 rounded ${editingCode === type.code ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      title={editingCode === type.code ? "Cerrar edición" : "Editar"}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveType(type.code)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new type */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-900 mb-3">Agregar Nuevo Tipo</h4>
        {availableTemplates.length === 0 && templates.length > 0 ? (
          <p className="text-sm text-amber-600">
            Todos los templates de certificación ya tienen un tipo asignado.
            Para agregar más tipos, primero suba nuevos templates de certificación.
          </p>
        ) : loadingTemplates ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando templates...</span>
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-amber-600">
            No hay templates de certificación disponibles.
            Primero debe subir templates con categoría "certification" desde Administración → Templates.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Código"
              value={newType.code}
              onChange={(e) => setNewType({ ...newType, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              placeholder="ej: employment, salary"
            />
            <Input
              label="Etiqueta"
              value={newType.label}
              onChange={(e) => setNewType({ ...newType, label: e.target.value })}
              placeholder="ej: Certificación Laboral"
            />
            <div className="col-span-2">
              <Select
                label="Template Asociado"
                options={[
                  { value: '', label: 'Seleccione un template...' },
                  ...availableTemplates.map(t => ({ value: t.id, label: t.name }))
                ]}
                value={newType.template_id}
                onChange={(e) => setNewType({ ...newType, template_id: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddType}
                disabled={!newType.code || !newType.template_id}
              >
                <Plus className="w-4 h-4" />
                Agregar Tipo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} loading={saving}>
          <Save className="w-4 h-4" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}

export default function Certifications() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [errorData, setErrorData] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedCertification, setSelectedCertification] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [generatingId, setGeneratingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [signingId, setSigningId] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewingId, setPreviewingId] = useState(null)
  const [initialType, setInitialType] = useState(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { isHR, isAdmin } = useAuth()

  // Auto-open modal if navigated with openNew state (from Dashboard quick action)
  useEffect(() => {
    if (location.state?.openNew) {
      setShowNewModal(true)
      // Clear the state to prevent re-opening on subsequent renders
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  // Fetch available certification types (only those with templates)
  const { data: availableTypesData } = useQuery({
    queryKey: ['certification-available-types'],
    queryFn: () => certificationService.getAvailableTypes(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const availableTypes = availableTypesData?.data?.data || []

  // Build type filters dynamically from available types
  const typeFilters = [
    { value: '', label: 'Todos los tipos' },
    ...availableTypes.map(t => ({ value: t.value, label: t.label }))
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['certifications', { status: statusFilter, type: typeFilter }],
    queryFn: () => certificationService.list({
      status: statusFilter || undefined,
      type: typeFilter || undefined
    }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => certificationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['certifications'])
      setShowNewModal(false)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => certificationService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['certifications'])
    },
  })

  const generateMutation = useMutation({
    mutationFn: (id) => certificationService.generateDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['certifications'])
      setGeneratingId(null)
    },
    onError: (error) => {
      console.error('Error generating document:', error)
      setGeneratingId(null)

      const responseData = error.response?.data
      if (responseData?.error_type === 'missing_variables') {
        setErrorData({
          message: responseData.error,
          missingData: responseData.missing_data,
          actions: responseData.action_required || []
        })
        setShowErrorModal(true)
      } else {
        alert(responseData?.error || 'Error al generar documento')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => certificationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['certifications'])
      setDeleteConfirm(null)
    },
    onError: (error) => {
      console.error('Error deleting certification:', error)
      alert(error.response?.data?.error || 'Error al eliminar certificación')
    },
  })

  const signMutation = useMutation({
    mutationFn: (id) => certificationService.signDocument(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['certifications'])
      setSigningId(null)
      const doc = response.data.document
      if (doc.all_signed) {
        alert('Documento firmado y completado exitosamente')
      } else {
        alert(`Documento firmado. Firmas pendientes: ${doc.pending_signatures.join(', ')}`)
      }
    },
    onError: (error) => {
      console.error('Error signing document:', error)
      setSigningId(null)
      const errorData = error.response?.data
      if (errorData?.action_required?.type === 'configure_signature') {
        if (confirm('No tienes firma digital configurada. ¿Deseas configurarla ahora?')) {
          navigate('/profile')
        }
      } else {
        alert(errorData?.error || 'Error al firmar documento')
      }
    },
  })

  const certifications = data?.data?.data || []
  const hasInProgressCertifications = certifications.some(c => ['pending', 'processing'].includes(c.status))

  const handleView = (certification) => {
    setSelectedCertification(certification)
    setShowDetailModal(true)
  }

  const handleGenerateDocument = async (id) => {
    setGeneratingId(id)
    generateMutation.mutate(id)
  }

  // Helper to parse blob error responses
  const parseBlobError = async (error) => {
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text()
        return JSON.parse(text)
      } catch {
        return null
      }
    }
    return error.response?.data
  }

  const handleDownloadDocument = async (certification) => {
    try {
      setDownloadingId(certification.id)
      const response = await certificationService.downloadDocument(certification.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${certification.request_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading document:', error)
      const errorData = await parseBlobError(error)
      alert(errorData?.error || errorData?.message || 'Error al descargar documento')
    } finally {
      setDownloadingId(null)
    }
  }

  const handlePreviewDocument = async (certification) => {
    try {
      setPreviewingId(certification.id)
      const response = await certificationService.downloadDocument(certification.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Error previewing document:', error)
      const errorData = await parseBlobError(error)
      alert(errorData?.error || errorData?.message || 'Error al previsualizar documento')
    } finally {
      setPreviewingId(null)
    }
  }

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificaciones</h1>
          <p className="text-gray-500">Solicita certificaciones laborales para distintos trámites</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="secondary"
              onClick={() => setShowConfigModal(true)}
              title="Configurar tipos de certificación"
            >
              <Settings className="w-4 h-4" />
              Configurar Tipos
            </Button>
          )}
          <Button
            onClick={() => setShowNewModal(true)}
            disabled={availableTypes.length === 0 || hasInProgressCertifications}
            title={availableTypes.length === 0 ? 'No hay tipos de certificación disponibles' : hasInProgressCertifications ? 'Certificados en trámite' : ''}
          >
            <Plus className="w-4 h-4" />
            Nueva Solicitud
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select
              options={statusFilters}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
            />
            <Select
              options={typeFilters}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-56"
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Cards - Clickable shortcuts - Only show available types */}
      {availableTypes.length > 0 && !hasInProgressCertifications ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableTypes.find(t => t.value === 'employment') && (
            <Card
              className="bg-blue-50 border-blue-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
              onClick={() => { setInitialType('employment'); setShowNewModal(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Certificación Laboral</p>
                    <p className="text-sm text-blue-700">Confirma tu vínculo laboral actual</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {availableTypes.find(t => t.value === 'salary') && (
            <Card
              className="bg-green-50 border-green-200 cursor-pointer hover:shadow-md hover:border-green-300 transition-all"
              onClick={() => { setInitialType('salary'); setShowNewModal(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Con Información Salarial</p>
                    <p className="text-sm text-green-700">Incluye detalles de tu compensación</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {availableTypes.find(t => t.value === 'full') && (
            <Card
              className="bg-purple-50 border-purple-200 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all"
              onClick={() => { setInitialType('full'); setShowNewModal(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900">Certificación Completa</p>
                    <p className="text-sm text-purple-700">Incluye toda tu información laboral</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {availableTypes.find(t => t.value === 'position') && (
            <Card
              className="bg-amber-50 border-amber-200 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all"
              onClick={() => { setInitialType('position'); setShowNewModal(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Certificación de Cargo</p>
                    <p className="text-sm text-amber-700">Detalla cargo y responsabilidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {availableTypes.find(t => t.value === 'custom') && (
            <Card
              className="bg-gray-50 border-gray-200 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
              onClick={() => { setInitialType('custom'); setShowNewModal(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Certificación Personalizada</p>
                    <p className="text-sm text-gray-700">Contenido según necesidad</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div>
              {hasInProgressCertifications ? (
                <>
                  <p className="font-medium text-amber-900">Los certificados existentes configurados ya están en trámite</p>
                  <p className="text-sm text-amber-700">
                    Por favor esperar que sean finalizados para solicitar otro certificado.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-amber-900">No hay tipos de certificación disponibles</p>
                  <p className="text-sm text-amber-700">
                    Contacta al administrador para configurar los templates de certificación.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Certification List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Número
                </th>
                <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="w-[17%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Propósito
                </th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="w-[10%] px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Días
                </th>
                <th className="w-[13%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                  </tr>
                ))
              ) : certifications.length > 0 ? (
                certifications.map((certification) => (
                  <tr key={certification.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-sm font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                        {certification.request_number}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {typeLabels[certification.certification_type] || certification.certification_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 truncate block">
                        {purposeLabels[certification.purpose] || certification.purpose}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcons[certification.status]}
                        <Badge status={certification.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">
                        {certification.estimated_days}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(certification.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleView(certification)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Botón generar documento (HR/Admin, cuando está pending y no tiene documento) */}
                        {(isHR || isAdmin) && certification.status === 'pending' && !certification.document_uuid && (
                          <button
                            onClick={() => handleGenerateDocument(certification.id)}
                            disabled={generatingId === certification.id}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            title="Generar documento"
                          >
                            {generatingId === certification.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FilePlus className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {/* Botón previsualizar (cuando hay documento y puede descargar) */}
                        {certification.document_uuid && certification.document_info?.can_download && (
                          <button
                            onClick={() => handlePreviewDocument(certification)}
                            disabled={previewingId === certification.id}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            title="Previsualizar"
                          >
                            {previewingId === certification.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {/* Botón descargar (cuando hay documento y puede descargar) */}
                        {certification.document_uuid && certification.document_info?.can_download && (
                          <button
                            onClick={() => handleDownloadDocument(certification)}
                            disabled={downloadingId === certification.id}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Descargar"
                          >
                            {downloadingId === certification.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {/* Botón firmar (HR/Admin cuando hay firmas pendientes) */}
                        {certification.document_uuid && certification.document_info?.pending_signatures?.length > 0 && (isHR || isAdmin) && (
                          <button
                            onClick={() => {
                              setSigningId(certification.id)
                              signMutation.mutate(certification.id)
                            }}
                            disabled={signingId === certification.id}
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
                            title={`Firmar documento (Pendiente: ${certification.document_info?.pending_signatures?.join(', ')})`}
                          >
                            {signingId === certification.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PenTool className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {/* Indicador de PDF pendiente */}
                        {certification.document_uuid && !certification.document_info?.pdf_ready && (
                          <span
                            className="inline-flex items-center px-2 py-1 text-xs text-blue-700 bg-blue-50 rounded"
                            title="El PDF se está generando"
                          >
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            PDF pendiente
                          </span>
                        )}
                        {/* Indicador de firmas pendientes (para empleados sin permisos de firma) */}
                        {certification.document_uuid && certification.document_info?.pdf_ready && !certification.document_info?.can_download && !(isHR || isAdmin) && (
                          <span
                            className="inline-flex items-center px-2 py-1 text-xs text-amber-700 bg-amber-50 rounded"
                            title={`Pendiente: ${certification.document_info?.pending_signatures?.join(', ')}`}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Firma pendiente
                          </span>
                        )}
                        {/* Botón cancelar (cuando está pendiente/procesando) */}
                        {['pending', 'processing'].includes(certification.status) && !isAdmin && (
                          <button
                            onClick={() => cancelMutation.mutate(certification.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {/* Botón eliminar (solo admin) */}
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteConfirm(certification)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-base font-medium text-gray-900 mb-1">
                      No tienes solicitudes de certificaciones
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Solicita una certificación laboral para tus trámites
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setShowNewModal(true)}
                      disabled={availableTypes.length === 0}
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Solicitud
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {certifications.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-500">
              {certifications.length} solicitud{certifications.length !== 1 ? 'es' : ''}
            </p>
          </div>
        )}
      </Card>

      {/* New Certification Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => { setShowNewModal(false); setInitialType(null); }}
        title="Nueva Solicitud de Certificación"
        size="lg"
      >
        <CertificationForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => { setShowNewModal(false); setInitialType(null); }}
          loading={createMutation.isPending}
          initialType={initialType}
          availableTypes={availableTypes}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle de Certificación"
        size="md"
      >
        {selectedCertification && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Número:</span>
              <span className="font-medium">{selectedCertification.request_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Estado:</span>
              <Badge status={selectedCertification.status} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tipo:</span>
              <span>{typeLabels[selectedCertification.certification_type]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Propósito:</span>
              <span>{purposeLabels[selectedCertification.purpose]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tiempo estimado:</span>
              <span>{selectedCertification.estimated_days} día{selectedCertification.estimated_days > 1 ? 's' : ''} hábil{selectedCertification.estimated_days > 1 ? 'es' : ''}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Fecha solicitud:</span>
              <span>{new Date(selectedCertification.created_at).toLocaleDateString('es-ES')}</span>
            </div>

            {selectedCertification.language && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Idioma:</span>
                <span>{selectedCertification.language === 'es' ? 'Español' : 'Inglés'}</span>
              </div>
            )}

            {selectedCertification.status === 'completed' && selectedCertification.completed_at && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Fecha completado:</span>
                <span className="text-green-600 font-medium">
                  {new Date(selectedCertification.completed_at).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}

            {selectedCertification.status === 'rejected' && selectedCertification.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                <p className="text-sm font-medium text-red-800 mb-1">Motivo de rechazo:</p>
                <p className="text-red-700">{selectedCertification.rejection_reason}</p>
              </div>
            )}

            {selectedCertification.processed_by && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Procesado por:</p>
                <p className="text-gray-600">{selectedCertification.processed_by.name}</p>
              </div>
            )}

            {/* Preview and Download buttons for certifications with document */}
            {selectedCertification.document_uuid && selectedCertification.document_info?.can_download && (
              <div className="pt-4 border-t space-y-2">
                <Button
                  className="w-full"
                  variant="primary"
                  onClick={() => handlePreviewDocument(selectedCertification)}
                  loading={previewingId === selectedCertification.id}
                >
                  <Eye className="w-4 h-4" />
                  Previsualizar Documento
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => handleDownloadDocument(selectedCertification)}
                  loading={downloadingId === selectedCertification.id}
                >
                  <Download className="w-4 h-4" />
                  Descargar Certificación
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Error Modal - Missing Variables */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="No se puede generar el documento"
        size="md"
      >
        {errorData && (
          <div className="space-y-4">
            {/* Error message */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Información faltante</p>
                <p className="text-sm text-red-700 mt-1">{errorData.message}</p>
              </div>
            </div>

            {/* Missing fields by source */}
            {errorData.missingData?.by_source?.employee?.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Datos del empleado requeridos:
                </p>
                <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                  {errorData.missingData.by_source.employee.map((item, idx) => (
                    <li key={idx}>{item.field_label || item.field}</li>
                  ))}
                </ul>
              </div>
            )}

            {errorData.missingData?.by_source?.organization?.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  Datos de la organización requeridos:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                  {errorData.missingData.by_source.organization.map((item, idx) => (
                    <li key={idx}>{item.field_label || item.field}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-4 border-t">
              {errorData.actions?.map((action, idx) => (
                <Button
                  key={idx}
                  variant={idx === 0 ? 'primary' : 'secondary'}
                  className="w-full justify-center"
                  onClick={() => {
                    setShowErrorModal(false)
                    if (action.type === 'edit_employee' && action.employee_id) {
                      navigate(`/hr/employees?edit=${action.employee_id}`)
                    } else if (action.type === 'edit_organization') {
                      navigate('/admin/organization')
                    } else if (action.type === 'configure_mappings') {
                      navigate('/admin/variable-mappings')
                    }
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  {action.label}
                  {action.employee_name && ` (${action.employee_name})`}
                </Button>
              ))}
              <Button
                variant="ghost"
                className="w-full justify-center"
                onClick={() => setShowErrorModal(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar Certificación"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">¿Eliminar esta certificación?</p>
                <p className="text-sm text-red-700 mt-1">
                  Esta acción no se puede deshacer. Se eliminará permanentemente la solicitud{' '}
                  <strong>{deleteConfirm.request_number}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo:</span>
                <span className="font-medium">{typeLabels[deleteConfirm.certification_type]}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Estado:</span>
                <Badge status={deleteConfirm.status} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* PDF Preview Modal */}
      <Modal
        isOpen={!!previewUrl}
        onClose={handleClosePreview}
        title="Previsualización de Documento"
        size="full"
      >
        <div className="flex flex-col h-[80vh]">
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="w-full flex-1 border rounded-lg bg-gray-100"
              title="Vista previa del documento"
            />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="secondary" onClick={handleClosePreview}>
              <X className="w-4 h-4" />
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configurar Tipos de Certificación"
        size="lg"
      >
        <CertificationTypeConfig
          onClose={() => {
            setShowConfigModal(false)
            queryClient.invalidateQueries(['certification-available-types'])
          }}
        />
      </Modal>
    </div>
  )
}
