import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templateService, variableMappingService, signatoryTypeService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import {
  ArrowLeft,
  Upload,
  Save,
  FileText,
  Variable,
  Users,
  CheckCircle,
  Archive,
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  X,
  Settings,
  RefreshCw
} from 'lucide-react'

// Legacy roles for backward compatibility (will be replaced by SignatoryType)
const LEGACY_ROLES = {
  employee: 'Empleado Solicitante',
  supervisor: 'Supervisor Directo',
  hr: 'Recursos Humanos',
  hr_manager: 'Gerente de RR.HH.',
  legal: 'Departamento Legal',
  admin: 'Administrador',
  custom: 'Personalizado',
}

function AddSignatoryModal({ isOpen, onClose, templateId, onSuccess }) {
  const queryClient = useQueryClient()
  const [typeCode, setTypeCode] = useState('')
  const [label, setLabel] = useState('')
  const [required, setRequired] = useState(true)
  const [error, setError] = useState('')

  // Fetch signatory types from API
  const { data: typesData, isLoading: loadingTypes } = useQuery({
    queryKey: ['signatory-types', { active: 'true' }],
    queryFn: () => signatoryTypeService.list({ active: 'true' }),
    enabled: isOpen
  })

  const signatoryTypes = typesData?.data?.data || []

  const createMutation = useMutation({
    mutationFn: (data) => templateService.createSignatory(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', templateId])
      queryClient.invalidateQueries(['template-signatories', templateId])
      onSuccess()
      handleClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al agregar firmante')
    }
  })

  const handleClose = () => {
    setTypeCode('')
    setLabel('')
    setRequired(true)
    setError('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!typeCode) {
      setError('Seleccione un tipo de firmante')
      return
    }
    const selectedType = signatoryTypes.find(t => t.code === typeCode)
    createMutation.mutate({
      signatory_type_code: typeCode,
      label: label || selectedType?.name || 'Firma',
      required
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Agregar Firmante</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Firmante
            </label>
            {loadingTypes ? (
              <div className="py-2 text-gray-500 text-sm">Cargando tipos...</div>
            ) : signatoryTypes.length === 0 ? (
              <div className="py-2 text-amber-600 text-sm">
                No hay tipos de firmante. Configure tipos en Admin &gt; Firmantes.
              </div>
            ) : (
              <select
                value={typeCode}
                onChange={(e) => {
                  setTypeCode(e.target.value)
                  const selectedType = signatoryTypes.find(t => t.code === e.target.value)
                  if (!label && selectedType) setLabel(selectedType.name)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Seleccionar tipo...</option>
                {signatoryTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <Input
            label="Etiqueta"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Firma del Empleado"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="required" className="text-sm text-gray-700">
              Firma requerida
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending} disabled={!typeCode || signatoryTypes.length === 0}>
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TemplateEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [showAddSignatory, setShowAddSignatory] = useState(false)
  const [editingMappings, setEditingMappings] = useState({})
  const [isSavingMappings, setIsSavingMappings] = useState(false)

  const { data: templateData, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => templateService.get(id)
  })

  const { data: mappingsData } = useQuery({
    queryKey: ['variable-mappings-grouped'],
    queryFn: () => variableMappingService.grouped()
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => templateService.upload(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => templateService.update(id, { template: data }),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const activateMutation = useMutation({
    mutationFn: () => templateService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const deleteSignatoryMutation = useMutation({
    mutationFn: (sigId) => templateService.deleteSignatory(id, sigId),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const reassignMutation = useMutation({
    mutationFn: () => templateService.reassignMappings(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
      setEditingMappings({})
    }
  })

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.docx')) {
      alert('Solo se permiten archivos Word (.docx)')
      return
    }

    uploadMutation.mutate(file)
  }

  const handleSaveMappings = async () => {
    setIsSavingMappings(true)
    try {
      await updateMutation.mutateAsync({ variable_mappings: editingMappings })
    } finally {
      setIsSavingMappings(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  const template = templateData?.data?.data
  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Template no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/admin/templates')} className="mt-4">
          Volver a Templates
        </Button>
      </div>
    )
  }

  const mappings = { ...template.variable_mappings, ...editingMappings }
  const availableMappings = template.available_mappings || {}
  const groupedMappings = mappingsData?.data?.data || {}

  const CATEGORY_LABELS = {
    employee: 'Empleado',
    organization: 'Organizacion',
    system: 'Sistema',
    request: 'Solicitud',
    custom: 'Personalizado'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/templates')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{template.category_label}</Badge>
            <Badge
              status={template.status === 'active' ? 'approved' : template.status === 'draft' ? 'pending' : 'rejected'}
            >
              {template.status === 'active' ? 'Activo' : template.status === 'draft' ? 'Borrador' : 'Archivado'}
            </Badge>
          </div>
        </div>

        {template.status === 'draft' && template.file_name && (
          <Button onClick={() => activateMutation.mutate()} loading={activateMutation.isPending}>
            <CheckCircle className="w-4 h-4" />
            Activar Template
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Archivo del Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              {template.file_name ? (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary-600" />
                    <div>
                      <p className="font-medium">{template.file_name}</p>
                      <p className="text-sm text-gray-500">
                        {(template.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploadMutation.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    Reemplazar
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Haz clic para subir un archivo Word (.docx)
                  </p>
                  <p className="text-sm text-gray-400">
                    El archivo debe contener variables en formato {"{{Variable}}"}
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Variables */}
          {template.variables?.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Variable className="w-5 h-5" />
                    Variables Detectadas ({template.variables.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reassignMutation.mutate()}
                      loading={reassignMutation.isPending}
                      title="Reasignar automaticamente desde variables del sistema"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Auto-asignar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMappings}
                      loading={isSavingMappings}
                      disabled={Object.keys(editingMappings).length === 0}
                    >
                      <Save className="w-4 h-4" />
                      Guardar Mapeo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {template.variables.map((variable) => (
                    <div key={variable} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <code className="px-2 py-1 bg-white border rounded text-sm flex-shrink-0">
                        {`{{${variable}}}`}
                      </code>
                      <span className="text-gray-400">=</span>
                      <select
                        value={mappings[variable] || ''}
                        onChange={(e) => setEditingMappings({
                          ...editingMappings,
                          [variable]: e.target.value
                        })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">-- Seleccionar mapeo --</option>
                        {Object.keys(groupedMappings).length > 0 ? (
                          // Use grouped mappings from API
                          Object.entries(groupedMappings).map(([category, items]) => (
                            <optgroup key={category} label={CATEGORY_LABELS[category] || category}>
                              {items.map((m) => (
                                <option key={m.key} value={m.key}>{m.name}</option>
                              ))}
                            </optgroup>
                          ))
                        ) : (
                          // Fallback to template's available mappings
                          <>
                            <optgroup label="Empleado">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('employee.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Organizacion">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('organization.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Sistema">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('system.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Solicitud">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('request.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                          </>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Signatories */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Firmantes
                </CardTitle>
                <Button size="sm" onClick={() => setShowAddSignatory(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {template.signatories?.length > 0 ? (
                <div className="space-y-2">
                  {template.signatories.map((sig, index) => (
                    <div
                      key={sig.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-400">{index + 1}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{sig.label}</p>
                        <p className="text-xs text-gray-500">{sig.role_label}</p>
                      </div>
                      {sig.required && (
                        <Badge variant="secondary" className="text-xs">Requerido</Badge>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar este firmante?')) {
                            deleteSignatoryMutation.mutate(sig.id)
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay firmantes configurados</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => setShowAddSignatory(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Firmante
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Informacion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="font-medium">{template.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Creado</span>
                <span className="font-medium">
                  {new Date(template.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Actualizado</span>
                <span className="font-medium">
                  {new Date(template.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Signatory Modal */}
      <AddSignatoryModal
        isOpen={showAddSignatory}
        onClose={() => setShowAddSignatory(false)}
        templateId={id}
        onSuccess={() => {}}
      />
    </div>
  )
}
