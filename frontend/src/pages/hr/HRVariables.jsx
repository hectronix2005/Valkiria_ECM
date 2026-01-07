import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { variableMappingService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import {
  Variable,
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Filter,
  X,
  AlertCircle,
  Save,
  RefreshCw,
  Lock,
  Database,
  FileSearch,
  FileText,
  CheckCircle,
  Wand2,
  ChevronDown,
  ChevronRight,
  Link2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

// Solo categorías de Recursos Humanos
const CATEGORIES = {
  employee: 'Empleado',
  organization: 'Organización',
  request: 'Solicitud',
  system: 'Sistema',
  custom: 'Personalizado'
}

// Lista de categorías HR para filtrar
const HR_CATEGORIES = ['employee', 'organization', 'request', 'system', 'custom']

const DATA_TYPES = [
  { value: 'string', label: 'Texto' },
  { value: 'date', label: 'Fecha' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'email', label: 'Email' }
]

const FORMAT_PATTERNS = [
  { value: '', label: 'Sin formato', example: '1234567', description: 'Valor sin formato' },
  { value: 'currency_cop', label: 'Moneda (COP)', example: '$1.234.567', description: 'Pesos colombianos' },
  { value: 'currency_usd', label: 'Moneda (USD)', example: '$1,234.56', description: 'Dólares americanos' },
  { value: 'accounting', label: 'Contabilidad', example: '$ 1.234.567,00', description: 'Formato contable con decimales' },
  { value: 'number_thousands', label: 'Número con miles', example: '1.234.567', description: 'Separador de miles' },
  { value: 'number_decimals', label: 'Número con decimales', example: '1.234,56', description: '2 decimales' },
  { value: 'percentage', label: 'Porcentaje', example: '85,5%', description: 'Valor porcentual' },
  { value: 'date_short', label: 'Fecha corta', example: '15/01/2024', description: 'DD/MM/YYYY' },
  { value: 'date_long', label: 'Fecha larga', example: '15 de enero de 2024', description: 'Formato completo' },
  { value: 'date_text', label: 'Fecha en texto', example: 'Quince (15) de Enero de 2024', description: 'Para documentos legales' },
  { value: 'text_upper', label: 'Texto mayúsculas', example: 'JUAN PÉREZ', description: 'Todo en mayúsculas' },
  { value: 'text_lower', label: 'Texto minúsculas', example: 'juan pérez', description: 'Todo en minúsculas' },
  { value: 'text_title', label: 'Texto título', example: 'Juan Pérez', description: 'Primera letra mayúscula' },
  { value: 'text_words', label: 'Número en letras', example: 'Un millón doscientos...', description: 'Número escrito' },
  { value: 'phone', label: 'Teléfono', example: '(+57) 300 123 4567', description: 'Formato telefónico' },
  { value: 'identification', label: 'Identificación', example: '1.234.567.890', description: 'Cédula/NIT con puntos' },
  { value: 'custom', label: 'Personalizado', example: '', description: 'Patrón personalizado' }
]

function MappingModal({ mapping, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const isEdit = !!mapping

  const [formData, setFormData] = useState({
    name: '',
    key: '',
    category: 'custom',
    description: '',
    data_type: 'string',
    format_pattern: '',
    source_model: '',
    source_field: ''
  })
  const [error, setError] = useState('')

  // Update form when mapping changes (for editing)
  useEffect(() => {
    if (mapping) {
      setFormData({
        name: mapping.name || '',
        key: mapping.key || '',
        category: mapping.category || 'custom',
        description: mapping.description || '',
        data_type: mapping.data_type || 'string',
        format_pattern: mapping.format_pattern || '',
        source_model: mapping.source_model || '',
        source_field: mapping.source_field || ''
      })
    } else {
      // Reset form for new mapping
      setFormData({
        name: '',
        key: '',
        category: 'custom',
        description: '',
        data_type: 'string',
        format_pattern: '',
        source_model: '',
        source_field: ''
      })
    }
    setError('')
  }, [mapping, isOpen])

  const createMutation = useMutation({
    mutationFn: (data) => variableMappingService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings'])
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al crear mapeo')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => variableMappingService.update(mapping.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings'])
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al actualizar mapeo')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('El nombre es requerido')
      return
    }

    if (isEdit) {
      // Don't send key when editing - it can't be changed
      const { key, ...updateData } = formData
      updateMutation.mutate(updateData)
    } else {
      createMutation.mutate(formData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar Mapeo' : 'Nuevo Mapeo de Variable'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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

          <Input
            label="Nombre del Mapeo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Salario Mensual"
            required
          />

          {!isEdit && (
            <Input
              label="Clave (se genera automáticamente)"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="Ej: custom.salario_mensual"
              hint="Formato: categoria.campo (solo minúsculas y guiones bajos)"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Dato
            </label>
            <select
              value={formData.data_type}
              onChange={(e) => setFormData({ ...formData, data_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DATA_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción de qué representa este mapeo..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Configuración Avanzada (Opcional)</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formato de Salida
                </label>
                <select
                  value={formData.format_pattern?.startsWith('custom:') ? 'custom' : (formData.format_pattern || '')}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'custom') {
                      setFormData({ ...formData, format_pattern: 'custom:' })
                    } else {
                      setFormData({ ...formData, format_pattern: val })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {FORMAT_PATTERNS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label} {fmt.example && `(${fmt.example})`}
                    </option>
                  ))}
                </select>
                {formData.format_pattern && formData.format_pattern !== 'custom' && !formData.format_pattern.startsWith('custom:') && (
                  <p className="mt-1 text-xs text-gray-500">
                    {FORMAT_PATTERNS.find(f => f.value === formData.format_pattern)?.description}
                  </p>
                )}
              </div>

              {formData.format_pattern?.startsWith('custom:') && (
                <Input
                  label="Patrón Personalizado"
                  value={formData.format_pattern.replace('custom:', '')}
                  onChange={(e) => setFormData({ ...formData, format_pattern: `custom:${e.target.value}` })}
                  placeholder='Ej: $%{value} COP'
                  hint="Use %{value} para indicar donde va el valor"
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Modelo Fuente"
                  value={formData.source_model}
                  onChange={(e) => setFormData({ ...formData, source_model: e.target.value })}
                  placeholder="Ej: Hr::Employee"
                />
                <Input
                  label="Campo Fuente"
                  value={formData.source_field}
                  onChange={(e) => setFormData({ ...formData, source_field: e.target.value })}
                  placeholder="Ej: monthly_salary"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              <Save className="w-4 h-4" />
              {isEdit ? 'Guardar Cambios' : 'Crear Mapeo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PendingVariablesModal({ isOpen, onClose }) {
  const queryClient = useQueryClient()
  const [expandedVars, setExpandedVars] = useState({})
  const [selectedMapping, setSelectedMapping] = useState({})
  const [creatingNew, setCreatingNew] = useState({})
  const [newMappingData, setNewMappingData] = useState({})

  const { data: pendingData, isLoading, refetch } = useQuery({
    queryKey: ['pending-variables-hr'],
    queryFn: () => variableMappingService.pendingVariables({ module_type: 'hr' }),
    enabled: isOpen
  })

  const { data: mappingsData } = useQuery({
    queryKey: ['variable-mappings-grouped'],
    queryFn: () => variableMappingService.grouped(),
    enabled: isOpen
  })

  const [error, setError] = useState('')

  const autoAssignMutation = useMutation({
    mutationFn: (data) => variableMappingService.autoAssign(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-variables'])
      queryClient.invalidateQueries(['variable-mappings'])
      queryClient.invalidateQueries(['template'])
      setError('')
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al asignar mapeo')
    }
  })

  const createAndAssignMutation = useMutation({
    mutationFn: (data) => variableMappingService.createAndAssign(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['pending-variables'])
      queryClient.invalidateQueries(['variable-mappings'])
      queryClient.invalidateQueries(['template'])
      setCreatingNew({})
      setNewMappingData({})
      setError('')
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Error al crear mapeo')
    }
  })

  const toggleExpand = (variable) => {
    setExpandedVars(prev => ({ ...prev, [variable]: !prev[variable] }))
  }

  const handleAssign = (variable, mappingKey, templateIds) => {
    autoAssignMutation.mutate({
      variable,
      mapping_key: mappingKey,
      template_ids: templateIds
    })
  }

  // Helper to normalize strings for key generation
  const normalizeForKey = (str) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
      .replace(/^_+|_+$/g, '') // Trim underscores
  }

  const handleCreateAndAssign = (variable, templateIds) => {
    const data = newMappingData[variable] || {}
    createAndAssignMutation.mutate({
      variable,
      mapping: {
        name: data.name || variable,
        key: data.key || `custom.${normalizeForKey(variable)}`,
        category: data.category || 'custom',
        description: data.description || `Variable personalizada: ${variable}`,
        data_type: data.data_type || 'string'
      },
      template_ids: templateIds
    })
  }

  if (!isOpen) return null

  const grouped = pendingData?.data?.data?.grouped_by_variable || {}
  const summary = pendingData?.data?.data?.summary || {}
  const groupedMappings = mappingsData?.data?.data || {}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-primary-600" />
              Revision de Variables Pendientes
            </h3>
            {summary.total_pending > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {summary.unique_variables} variables unicas en {summary.templates_with_pending} templates
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Todas las variables estan mapeadas
              </h3>
              <p className="text-gray-500">
                No hay variables pendientes de asignacion en las plantillas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([variable, data]) => (
                <div key={variable} className="border rounded-lg overflow-hidden">
                  {/* Variable Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleExpand(variable)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedVars[variable] ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <code className="px-2 py-1 bg-white border rounded text-sm font-mono">
                        {`{{${variable}}}`}
                      </code>
                      <Badge variant="secondary">
                        {data.count} {data.count === 1 ? 'template' : 'templates'}
                      </Badge>
                    </div>
                    {data.suggestions?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-amber-500" />
                        <span className="text-sm text-amber-600">
                          {data.suggestions.length} sugerencia{data.suggestions.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedVars[variable] && (
                    <div className="p-4 space-y-4">
                      {/* Templates using this variable */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Plantillas que usan esta variable:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {data.templates.map((t) => (
                            <span key={t.id} className="px-2 py-1 bg-gray-100 rounded text-sm">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Suggestions */}
                      {data.suggestions?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-amber-500" />
                            Sugerencias de mapeo:
                          </h4>
                          <div className="space-y-2">
                            {data.suggestions.map((suggestion) => (
                              <div
                                key={suggestion.id}
                                className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                              >
                                <div>
                                  <span className="font-medium">{suggestion.name}</span>
                                  <span className="text-gray-500 mx-2">=</span>
                                  <code className="text-sm text-gray-600">{suggestion.key}</code>
                                  {suggestion.match_score && (
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      {suggestion.match_score}% match
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleAssign(
                                    variable,
                                    suggestion.key,
                                    data.templates.map(t => t.id)
                                  )}
                                  loading={autoAssignMutation.isPending}
                                >
                                  <Link2 className="w-4 h-4" />
                                  Asignar
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Manual Selection */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Seleccionar mapeo existente:
                        </h4>
                        <div className="flex gap-2">
                          <select
                            value={selectedMapping[variable] || ''}
                            onChange={(e) => setSelectedMapping({
                              ...selectedMapping,
                              [variable]: e.target.value
                            })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">-- Seleccionar mapeo --</option>
                            {Object.entries(groupedMappings).map(([category, items]) => (
                              <optgroup key={category} label={CATEGORIES[category] || category}>
                                {items.map((m) => (
                                  <option key={m.id} value={m.key}>{m.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <Button
                            variant="secondary"
                            disabled={!selectedMapping[variable]}
                            onClick={() => handleAssign(
                              variable,
                              selectedMapping[variable],
                              data.templates.map(t => t.id)
                            )}
                            loading={autoAssignMutation.isPending}
                          >
                            <Link2 className="w-4 h-4" />
                            Asignar
                          </Button>
                        </div>
                      </div>

                      {/* Create New */}
                      <div className="border-t pt-4">
                        {!creatingNew[variable] ? (
                          <Button
                            variant="secondary"
                            onClick={() => setCreatingNew({ ...creatingNew, [variable]: true })}
                          >
                            <Plus className="w-4 h-4" />
                            Crear nuevo mapeo para esta variable
                          </Button>
                        ) : (
                          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium">Crear nuevo mapeo</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                label="Nombre"
                                value={newMappingData[variable]?.name || variable}
                                onChange={(e) => setNewMappingData({
                                  ...newMappingData,
                                  [variable]: { ...newMappingData[variable], name: e.target.value }
                                })}
                                placeholder="Nombre del mapeo"
                              />
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Categoria
                                </label>
                                <select
                                  value={newMappingData[variable]?.category || 'custom'}
                                  onChange={(e) => setNewMappingData({
                                    ...newMappingData,
                                    [variable]: { ...newMappingData[variable], category: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                  {Object.entries(CATEGORIES).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleCreateAndAssign(
                                  variable,
                                  data.templates.map(t => t.id)
                                )}
                                loading={createAndAssignMutation.isPending}
                              >
                                <Save className="w-4 h-4" />
                                Crear y Asignar
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  const newCreating = { ...creatingNew }
                                  delete newCreating[variable]
                                  setCreatingNew(newCreating)
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

function AliasModal({ isOpen, onClose, mappings }) {
  const [search, setSearch] = useState('')

  // Group mappings by key to show shared keys
  const keyGroups = mappings.reduce((acc, m) => {
    if (!acc[m.key]) acc[m.key] = []
    acc[m.key].push(m)
    return acc
  }, {})

  // Filter groups based on search
  const filteredGroups = Object.entries(keyGroups).filter(([key, vars]) =>
    key.toLowerCase().includes(search.toLowerCase()) ||
    vars.some(v => v.name.toLowerCase().includes(search.toLowerCase()))
  )

  // Only show groups with multiple variables (shared keys)
  const sharedKeyGroups = filteredGroups.filter(([_, vars]) => vars.length > 1)

  // Count totals
  const totalSharedKeys = Object.values(keyGroups).filter(vars => vars.length > 1).length
  const totalAliasVariables = Object.values(keyGroups)
    .filter(vars => vars.length > 1)
    .reduce((sum, vars) => sum + vars.length, 0)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary-600" />
              Variables con Clave Compartida
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Estas variables apuntan a la misma fuente de datos
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por clave o nombre..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {sharedKeyGroups.map(([key, variables]) => (
              <div
                key={key}
                className="p-4 rounded-lg border border-primary-200 bg-primary-50/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <code className="text-sm font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded">
                    {key}
                  </code>
                  <Badge variant="primary" className="text-xs">
                    {variables.length} variables
                  </Badge>
                </div>

                <div className="space-y-2">
                  {variables.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200"
                    >
                      {v.is_system && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{v.name}</div>
                        <div className="text-xs text-gray-500 truncate">{v.description}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {CATEGORIES[v.category] || v.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {sharedKeyGroups.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {search ? 'No se encontraron coincidencias' : 'No hay variables con claves compartidas'}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-between">
          <div className="text-sm text-gray-500">
            {totalSharedKeys} claves compartidas · {totalAliasVariables} variables
          </div>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

function MappingRow({ mapping, onEdit, onToggle, onDelete, isAdmin, siblingNames }) {
  const isSystem = mapping.is_system
  const hasSiblings = siblingNames && siblingNames.length > 0

  return (
    <tr className={`${!mapping.active ? 'opacity-50 bg-gray-50' : ''}`}>
      {/* Primera columna: Clave */}
      <td className="px-4 py-3">
        <code className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{mapping.key}</code>
      </td>
      {/* Segunda columna: Nombre(s) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isSystem && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          <span className="font-medium">{mapping.name}</span>
        </div>
        {hasSiblings && (
          <div className="mt-1 flex flex-wrap gap-1">
            {siblingNames.map(name => (
              <span key={name} className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">
                {name}
              </span>
            ))}
          </div>
        )}
        {mapping.description && (
          <p className="text-xs text-gray-500 mt-0.5">{mapping.description}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="text-xs">
          {CATEGORIES[mapping.category] || mapping.category}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">
          {DATA_TYPES.find(t => t.value === mapping.data_type)?.label || mapping.data_type}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(mapping)}
          className={`p-1 rounded ${mapping.active ? 'text-green-600' : 'text-gray-400'}`}
          title={mapping.active ? 'Desactivar' : 'Activar'}
        >
          {mapping.active ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(mapping)}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {(isAdmin || !isSystem) && (
            <button
              onClick={() => onDelete(mapping)}
              className="p-1.5 hover:bg-red-50 rounded text-red-500"
              title={isSystem ? "Eliminar (Solo Admin)" : "Eliminar"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function VariableMappings() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showAliasModal, setShowAliasModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dataTypeFilter, setDataTypeFilter] = useState('')
  const [sortColumn, setSortColumn] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ['variable-mappings', { category: categoryFilter, type: typeFilter }],
    queryFn: () => variableMappingService.list({
      category: categoryFilter || undefined,
      type: typeFilter || undefined
    })
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => variableMappingService.toggleActive(id),
    onSuccess: () => queryClient.invalidateQueries(['variable-mappings'])
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => variableMappingService.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['variable-mappings'])
  })

  const seedMutation = useMutation({
    mutationFn: () => variableMappingService.seedSystem(),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings'])
    }
  })

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setShowModal(true)
  }

  const handleToggle = (mapping) => {
    toggleMutation.mutate(mapping.id)
  }

  const handleDelete = (mapping) => {
    if (confirm(`¿Está seguro de eliminar el mapeo "${mapping.name}"?`)) {
      deleteMutation.mutate(mapping.id)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingMapping(null)
  }

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />
  }

  const allMappings = mappingsData?.data?.data || []
  const meta = mappingsData?.data?.meta || {}

  // Filtrar solo variables de HR
  const hrMappings = allMappings.filter(m => HR_CATEGORIES.includes(m.category))

  // Filter and sort
  const filteredMappings = hrMappings
    .filter(m => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!m.name.toLowerCase().includes(q) && !m.key.toLowerCase().includes(q)) {
          return false
        }
      }
      // Status filter
      if (statusFilter === 'active' && !m.active) return false
      if (statusFilter === 'inactive' && m.active) return false
      // Data type filter
      if (dataTypeFilter && m.data_type !== dataTypeFilter) return false
      return true
    })
    .sort((a, b) => {
      let aVal, bVal
      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'key':
          aVal = a.key.toLowerCase()
          bVal = b.key.toLowerCase()
          break
        case 'category':
          aVal = CATEGORIES[a.category] || a.category
          bVal = CATEGORIES[b.category] || b.category
          break
        case 'data_type':
          aVal = a.data_type || ''
          bVal = b.data_type || ''
          break
        case 'status':
          aVal = a.active ? 1 : 0
          bVal = b.active ? 1 : 0
          break
        default:
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  // Group all mappings by key to find siblings (names sharing the same key)
  const keyToNames = hrMappings.reduce((acc, m) => {
    if (!acc[m.key]) acc[m.key] = []
    acc[m.key].push(m.name)
    return acc
  }, {})

  // Get sibling names for a mapping (other names with the same key, excluding itself)
  const getSiblingNames = (mapping) => {
    const allNames = keyToNames[mapping.key] || []
    return allNames.filter(name => name !== mapping.name)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variables de Recursos Humanos</h1>
          <p className="text-gray-500">Variables para templates de empleados, certificaciones y solicitudes</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowAliasModal(true)}
          >
            <Link2 className="w-4 h-4" />
            Gestionar Aliases
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowPendingModal(true)}
          >
            <FileSearch className="w-4 h-4" />
            Revisar Plantillas
          </Button>
          <Button
            variant="secondary"
            onClick={() => seedMutation.mutate()}
            loading={seedMutation.isPending}
          >
            <Database className="w-4 h-4" />
            Inicializar Sistema
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Nuevo Mapeo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar mapeos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sistema/Custom</option>
              <option value="system">Sistema</option>
              <option value="custom">Personalizados</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>

            <select
              value={dataTypeFilter}
              onChange={(e) => setDataTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tipo de dato</option>
              {DATA_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>

            {(searchQuery || categoryFilter || typeFilter || statusFilter || dataTypeFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setCategoryFilter('')
                  setTypeFilter('')
                  setStatusFilter('')
                  setDataTypeFilter('')
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Limpiar
              </button>
            )}
          </div>
          {/* Results counter */}
          {!isLoading && hrMappings.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>
                Mostrando <strong>{filteredMappings.length}</strong> de <strong>{hrMappings.length}</strong> variables
                {sortColumn && (
                  <span className="ml-2 text-gray-400">
                    · Ordenado por {sortColumn === 'name' ? 'nombre' : sortColumn === 'key' ? 'clave' : sortColumn === 'category' ? 'categoría' : sortColumn === 'data_type' ? 'tipo' : 'estado'} ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})
                  </span>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mappings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-12">
              <Variable className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay mapeos
              </h3>
              <p className="text-gray-500 mb-4">
                {hrMappings.length === 0
                  ? 'Inicializa los mapeos del sistema o crea uno personalizado'
                  : 'No se encontraron mapeos con los filtros aplicados'
                }
              </p>
              {hrMappings.length === 0 && (
                <Button onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
                  <Database className="w-4 h-4" />
                  Inicializar Mapeos del Sistema
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th
                      onClick={() => handleSort('key')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Clave
                        <SortIcon column="key" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Nombre(s)
                        <SortIcon column="name" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('category')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Categoría
                        <SortIcon column="category" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('data_type')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Tipo
                        <SortIcon column="data_type" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Estado
                        <SortIcon column="status" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMappings.map((mapping) => (
                    <MappingRow
                      key={mapping.id}
                      mapping={mapping}
                      onEdit={handleEdit}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      isAdmin={isAdmin}
                      siblingNames={getSiblingNames(mapping)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {hrMappings.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Mostrando {filteredMappings.length} de {hrMappings.length} variables de Recursos Humanos
        </div>
      )}

      {/* Modal */}
      <MappingModal
        mapping={editingMapping}
        isOpen={showModal}
        onClose={handleCloseModal}
      />

      {/* Pending Variables Modal */}
      <PendingVariablesModal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
      />

      {/* Alias Variables Modal */}
      <AliasModal
        isOpen={showAliasModal}
        onClose={() => setShowAliasModal(false)}
        mappings={hrMappings}
      />
    </div>
  )
}
