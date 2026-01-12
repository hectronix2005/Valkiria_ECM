import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractService, thirdPartyService, thirdPartyTypeService, publicTemplateService, variableMappingService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import {
  Plus, Search, FileText, Send, CheckCircle, XCircle, Clock,
  AlertTriangle, Download, Eye, FilePlus, MoreVertical, Edit2,
  Trash2, FileCheck, Building2, Calendar, DollarSign, ChevronRight,
  AlertCircle, FileWarning, UserPlus, Building, User, Variable,
  Settings, X, ToggleLeft, ToggleRight, Lock, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown, Archive, ArchiveRestore, Users
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

const PERSON_TYPES = [
  { value: 'juridical', label: 'Persona Jurídica (Empresa)' },
  { value: 'natural', label: 'Persona Natural' },
]

const IDENTIFICATION_TYPES = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'PA', label: 'Pasaporte' },
]

// Variables panel constants
const LEGAL_CATEGORIES = {
  third_party: 'Tercero',
  contract: 'Contrato',
  organization: 'Organización',
  system: 'Sistema',
  custom: 'Personalizado'
}

const DATA_TYPES = [
  { value: 'string', label: 'Texto' },
  { value: 'date', label: 'Fecha' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'email', label: 'Email' }
]

const CATEGORY_COLORS = {
  third_party: 'indigo',
  contract: 'blue',
  organization: 'purple',
  system: 'gray',
  custom: 'orange'
}

// Variable Form Modal
function VariableFormModal({ mapping, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const isEdit = !!mapping

  const [formData, setFormData] = useState({
    name: mapping?.name || '',
    key: mapping?.key || '',
    category: mapping?.category || 'custom',
    description: mapping?.description || '',
    data_type: mapping?.data_type || 'string'
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (mapping && isOpen) {
      setFormData({
        name: mapping.name || '',
        key: mapping.key || '',
        category: mapping.category || 'custom',
        description: mapping.description || '',
        data_type: mapping.data_type || 'string'
      })
    } else if (!mapping && isOpen) {
      setFormData({
        name: '',
        key: '',
        category: 'custom',
        description: '',
        data_type: 'string'
      })
    }
  }, [mapping, isOpen])

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? variableMappingService.update(mapping.id, data)
      : variableMappingService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings-legal'])
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al guardar')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    mutation.mutate(formData)
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar Variable' : 'Nueva Variable'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <Input
          label="Nombre de la Variable"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ej: Nombre del Tercero"
          required
        />
        <Input
          label="Clave (key)"
          value={formData.key}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          placeholder="Ej: third_party.display_name"
          required
          disabled={isEdit}
        />
        <Select
          label="Categoría"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          options={Object.entries(LEGAL_CATEGORIES).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Tipo de Dato"
          value={formData.data_type}
          onChange={(e) => setFormData({ ...formData, data_type: e.target.value })}
          options={DATA_TYPES}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Descripción de la variable..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Legal Variables Panel
function LegalVariablesPanel({ isOpen, onClose }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['variable-mappings-legal'],
    queryFn: () => variableMappingService.list(),
    enabled: isOpen,
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => variableMappingService.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings-legal'])
    }
  })

  const seedMutation = useMutation({
    mutationFn: () => variableMappingService.seedSystem(),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings-legal'])
    }
  })

  // Filter to only legal categories
  const legalCategories = Object.keys(LEGAL_CATEGORIES)
  const allMappings = data?.data?.data || []
  const filteredByModule = allMappings.filter(m => legalCategories.includes(m.category))

  // Apply search and filters
  let mappings = filteredByModule.filter(m => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.key.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || m.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Sort
  mappings = [...mappings].sort((a, b) => {
    const aVal = a[sortField] || ''
    const bVal = b[sortField] || ''
    const cmp = aVal.localeCompare(bVal)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-indigo-600" />
      : <ArrowDown className="h-3 w-3 text-indigo-600" />
  }

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setShowModal(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Variables de Contratos</h2>
            <p className="text-sm text-gray-500">Gestiona las variables para documentos comerciales</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => seedMutation.mutate()}
              loading={seedMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Sincronizar
            </Button>
            <Button size="sm" onClick={() => { setEditingMapping(null); setShowModal(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Nueva Variable
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o clave..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las categorías</option>
              {Object.entries(LEGAL_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {(search || categoryFilter) && (
              <button
                onClick={() => { setSearch(''); setCategoryFilter('') }}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-12">
              <Variable className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay variables</h3>
              <p className="text-gray-500 mb-4">
                {search || categoryFilter
                  ? 'No se encontraron variables con los filtros aplicados'
                  : 'Haz clic en "Sincronizar" para cargar las variables del sistema'}
              </p>
              {!search && !categoryFilter && (
                <Button onClick={() => seedMutation.mutate()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Sistema
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b border-gray-200">
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Variable <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Categoría <SortIcon field="category" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const categoryColor = CATEGORY_COLORS[mapping.category] || 'gray'
                  return (
                    <tr key={mapping.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {mapping.is_system && (
                            <Lock className="h-3 w-3 text-gray-400" title="Variable del sistema" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{mapping.name}</p>
                            <p className="text-xs text-gray-500 font-mono">{mapping.key}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={categoryColor}>
                          {LEGAL_CATEGORIES[mapping.category] || mapping.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {DATA_TYPES.find(t => t.value === mapping.data_type)?.label || mapping.data_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleMutation.mutate(mapping.id)}
                          className={`p-1 rounded transition-colors ${
                            mapping.active
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={mapping.active ? 'Activa' : 'Inactiva'}
                        >
                          {mapping.active ? (
                            <ToggleRight className="h-5 w-5" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!mapping.is_system && (
                          <button
                            onClick={() => handleEdit(mapping)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {mappings.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            Mostrando {mappings.length} de {filteredByModule.length} variables
          </div>
        )}

        {/* Variable Form Modal */}
        <VariableFormModal
          mapping={editingMapping}
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingMapping(null) }}
        />
      </div>
    </div>
  )
}

// Formulario rápido para crear terceros desde el template
function ThirdPartyQuickForm({ template, onSubmit, onCancel, isLoading, thirdPartyTypes }) {
  const [personType, setPersonType] = useState('juridical')
  const [formData, setFormData] = useState({
    third_party_type: 'provider',
    person_type: 'juridical',
    identification_type: 'NIT',
    identification_number: '',
    verification_digit: '',
    business_name: '',
    trade_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    country: 'Colombia',
    legal_rep_name: '',
    legal_rep_id_type: 'CC',
    legal_rep_id_number: '',
    legal_rep_id_city: '',
    legal_rep_email: '',
    legal_rep_phone: '',
    bank_name: '',
    bank_account_type: '',
    bank_account_number: '',
    tax_regime: '',
    industry: '',
    website: '',
  })
  const [errors, setErrors] = useState({})

  // Fetch template requirements from API
  const { data: requirementsData, isLoading: loadingRequirements } = useQuery({
    queryKey: ['template-requirements', template?.id],
    queryFn: () => templateService.getThirdPartyRequirements(template.id),
    enabled: !!template?.id,
  })

  const templateRequirements = requirementsData?.data?.data || {}
  const requiredFields = templateRequirements.required_fields || []
  const requiredFieldNames = requiredFields.map(f => f.field)

  // Update person type and form data when requirements load
  useEffect(() => {
    if (templateRequirements.suggested_person_type) {
      setPersonType(templateRequirements.suggested_person_type)
      setFormData(prev => ({
        ...prev,
        person_type: templateRequirements.suggested_person_type,
        identification_type: templateRequirements.suggested_person_type === 'juridical' ? 'NIT' : 'CC',
        third_party_type: templateRequirements.default_third_party_type || prev.third_party_type,
      }))
    }
  }, [templateRequirements])

  // Check if a field is required based on template
  const isFieldRequired = (fieldName) => {
    // Always required
    if (['identification_number', 'email'].includes(fieldName)) return true
    if (personType === 'juridical' && fieldName === 'business_name') return true
    if (personType === 'natural' && ['first_name', 'last_name'].includes(fieldName)) return true
    // Required by template
    return requiredFieldNames.includes(fieldName)
  }

  // Check if field should be shown (always show required + template required)
  const shouldShowField = (fieldName) => {
    // Always show basic fields
    const basicFields = ['identification_type', 'identification_number', 'email', 'phone']
    if (basicFields.includes(fieldName)) return true

    // Show based on person type
    if (personType === 'juridical') {
      if (['business_name', 'trade_name', 'verification_digit'].includes(fieldName)) return true
    } else {
      if (['first_name', 'last_name'].includes(fieldName)) return true
    }

    // Show if required by template
    return requiredFieldNames.includes(fieldName)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handlePersonTypeChange = (type) => {
    setPersonType(type)
    setFormData(prev => ({
      ...prev,
      person_type: type,
      identification_type: type === 'juridical' ? 'NIT' : 'CC'
    }))
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.identification_number.trim()) {
      newErrors.identification_number = 'Número de identificación requerido'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Correo electrónico requerido'
    }
    if (personType === 'juridical' && !formData.business_name.trim()) {
      newErrors.business_name = 'Razón social requerida'
    }
    if (personType === 'natural') {
      if (!formData.first_name.trim()) newErrors.first_name = 'Nombre requerido'
      if (!formData.last_name.trim()) newErrors.last_name = 'Apellido requerido'
    }

    // Check template required fields
    requiredFields.forEach(field => {
      if (field.person_type && field.person_type !== personType) return
      if (!formData[field.field]?.toString().trim()) {
        newErrors[field.field] = `${field.label} es requerido por el template`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  if (loadingRequirements) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Cargando requisitos del template...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info del template con TODAS las variables */}
      {template && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">
                Crear tercero para: {template.name} ({template.variables?.length || 0} variables)
              </p>

              {/* Variables del Tercero - que el usuario debe llenar */}
              {requiredFields.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-blue-700 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Datos del Tercero ({requiredFields.length} campos a completar):
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {requiredFields.map((f, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                        {f.variable}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variables del Contrato - ya llenadas en el formulario de contrato */}
              <div className="mt-2">
                <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Datos del Contrato (se toman del formulario):
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(template.variables || []).filter(v =>
                    ['Valor', 'Periodicidad de Pago', 'Monto', 'Condiciones de Pago'].some(k => v.toLowerCase().includes(k.toLowerCase()))
                  ).map((v, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                      {v} ✓
                    </span>
                  ))}
                </div>
              </div>

              {/* Variables del Sistema - automáticas */}
              <div className="mt-2">
                <p className="text-sm text-gray-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  Automático (fecha del sistema):
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(template.variables || []).filter(v =>
                    v.toLowerCase().includes('fecha') || v.toLowerCase().includes('dia') || v.toLowerCase().includes('año') || v.toLowerCase().includes('ano')
                  ).map((v, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {v} ✓
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tipo de persona */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handlePersonTypeChange('juridical')}
          className={`p-4 border-2 rounded-lg text-left transition-all ${
            personType === 'juridical'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Building className={`h-6 w-6 mb-2 ${personType === 'juridical' ? 'text-indigo-600' : 'text-gray-400'}`} />
          <p className={`font-medium ${personType === 'juridical' ? 'text-indigo-900' : 'text-gray-700'}`}>
            Persona Jurídica
          </p>
          <p className="text-sm text-gray-500">Empresa, sociedad</p>
        </button>
        <button
          type="button"
          onClick={() => handlePersonTypeChange('natural')}
          className={`p-4 border-2 rounded-lg text-left transition-all ${
            personType === 'natural'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <User className={`h-6 w-6 mb-2 ${personType === 'natural' ? 'text-indigo-600' : 'text-gray-400'}`} />
          <p className={`font-medium ${personType === 'natural' ? 'text-indigo-900' : 'text-gray-700'}`}>
            Persona Natural
          </p>
          <p className="text-sm text-gray-500">Individuo, freelancer</p>
        </button>
      </div>

      {/* Tipo de tercero */}
      <Select
        label="Tipo de Tercero"
        value={formData.third_party_type}
        onChange={(e) => handleChange('third_party_type', e.target.value)}
        options={thirdPartyTypes.map(t => ({ value: t.code, label: t.name }))}
      />

      {/* Identificación */}
      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Tipo ID"
          value={formData.identification_type}
          onChange={(e) => handleChange('identification_type', e.target.value)}
          options={IDENTIFICATION_TYPES}
        />
        <Input
          label="Número de Identificación *"
          value={formData.identification_number}
          onChange={(e) => handleChange('identification_number', e.target.value)}
          placeholder={personType === 'juridical' ? '900123456' : '12345678'}
          error={errors.identification_number}
        />
        {personType === 'juridical' && (
          <Input
            label="Dígito Verificación"
            value={formData.verification_digit}
            onChange={(e) => handleChange('verification_digit', e.target.value)}
            placeholder="7"
            maxLength={1}
          />
        )}
      </div>

      {/* Nombre según tipo */}
      {personType === 'juridical' ? (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Razón Social *"
            value={formData.business_name}
            onChange={(e) => handleChange('business_name', e.target.value)}
            placeholder="EMPRESA S.A.S."
            error={errors.business_name}
          />
          <Input
            label="Nombre Comercial"
            value={formData.trade_name}
            onChange={(e) => handleChange('trade_name', e.target.value)}
            placeholder="Mi Empresa"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombre *"
            value={formData.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            placeholder="Juan"
            error={errors.first_name}
          />
          <Input
            label="Apellido *"
            value={formData.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            placeholder="Pérez"
            error={errors.last_name}
          />
        </div>
      )}

      {/* Contacto básico */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Correo Electrónico *"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="contacto@empresa.com"
          error={errors.email}
        />
        <Input
          label="Teléfono"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="(601) 234-5678"
        />
      </div>

      {/* Campos adicionales requeridos por template */}
      {(shouldShowField('address') || shouldShowField('city')) && (
        <div className="grid grid-cols-2 gap-4">
          {shouldShowField('address') && (
            <Input
              label={`Dirección${isFieldRequired('address') ? ' *' : ''}`}
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Calle 123 # 45-67"
              error={errors.address}
            />
          )}
          {shouldShowField('city') && (
            <Input
              label={`Ciudad${isFieldRequired('city') ? ' *' : ''}`}
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Bogotá"
              error={errors.city}
            />
          )}
        </div>
      )}

      {/* Representante legal (solo jurídica) */}
      {personType === 'juridical' && (shouldShowField('legal_rep_name') || shouldShowField('legal_rep_id_number') || shouldShowField('legal_rep_id_city')) && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Representante Legal</h4>
          <div className="grid grid-cols-2 gap-4">
            {shouldShowField('legal_rep_name') && (
              <Input
                label={`Nombre${isFieldRequired('legal_rep_name') ? ' *' : ''}`}
                value={formData.legal_rep_name}
                onChange={(e) => handleChange('legal_rep_name', e.target.value)}
                placeholder="Carlos García"
                error={errors.legal_rep_name}
              />
            )}
            {shouldShowField('legal_rep_id_number') && (
              <Input
                label={`Cédula${isFieldRequired('legal_rep_id_number') ? ' *' : ''}`}
                value={formData.legal_rep_id_number}
                onChange={(e) => handleChange('legal_rep_id_number', e.target.value)}
                placeholder="12345678"
                error={errors.legal_rep_id_number}
              />
            )}
            {shouldShowField('legal_rep_id_city') && (
              <Input
                label={`Ciudad Expedición Cédula${isFieldRequired('legal_rep_id_city') ? ' *' : ''}`}
                value={formData.legal_rep_id_city}
                onChange={(e) => handleChange('legal_rep_id_city', e.target.value)}
                placeholder="Bogotá"
                error={errors.legal_rep_id_city}
              />
            )}
            {shouldShowField('legal_rep_email') && (
              <Input
                label={`Email${isFieldRequired('legal_rep_email') ? ' *' : ''}`}
                type="email"
                value={formData.legal_rep_email}
                onChange={(e) => handleChange('legal_rep_email', e.target.value)}
                placeholder="representante@empresa.com"
                error={errors.legal_rep_email}
              />
            )}
          </div>
        </div>
      )}

      {/* Info bancaria */}
      {(shouldShowField('bank_name') || shouldShowField('bank_account_number')) && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Información Bancaria</h4>
          <div className="grid grid-cols-3 gap-4">
            {shouldShowField('bank_name') && (
              <Input
                label={`Banco${isFieldRequired('bank_name') ? ' *' : ''}`}
                value={formData.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="Bancolombia"
                error={errors.bank_name}
              />
            )}
            {shouldShowField('bank_account_type') && (
              <Select
                label={`Tipo Cuenta${isFieldRequired('bank_account_type') ? ' *' : ''}`}
                value={formData.bank_account_type}
                onChange={(e) => handleChange('bank_account_type', e.target.value)}
                options={[
                  { value: '', label: 'Seleccionar...' },
                  { value: 'savings', label: 'Ahorros' },
                  { value: 'checking', label: 'Corriente' },
                ]}
                error={errors.bank_account_type}
              />
            )}
            {shouldShowField('bank_account_number') && (
              <Input
                label={`Número Cuenta${isFieldRequired('bank_account_number') ? ' *' : ''}`}
                value={formData.bank_account_number}
                onChange={(e) => handleChange('bank_account_number', e.target.value)}
                placeholder="1234567890"
                error={errors.bank_account_number}
              />
            )}
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading}>
          <UserPlus className="h-4 w-4 mr-2" />
          Crear Tercero
        </Button>
      </div>
    </form>
  )
}

const CONTRACT_TYPES = [
  { value: 'services', label: 'Prestación de Servicios' },
  { value: 'purchase', label: 'Compraventa' },
  { value: 'nda', label: 'Confidencialidad (NDA)' },
  { value: 'lease', label: 'Arrendamiento' },
  { value: 'partnership', label: 'Alianza/Asociación' },
  { value: 'consulting', label: 'Consultoría' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'license', label: 'Licencia' },
  { value: 'other', label: 'Otro' },
]

const STATUS_CONFIG = {
  draft: { color: 'gray', bg: 'bg-gray-100', text: 'text-gray-700', icon: FileText, label: 'Borrador' },
  pending_approval: { color: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock, label: 'En Aprobación' },
  pending_signatures: { color: 'purple', bg: 'bg-purple-100', text: 'text-purple-700', icon: FileCheck, label: 'Pendiente Firmas' },
  approved: { color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle, label: 'Aprobado' },
  rejected: { color: 'red', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Rechazado' },
  active: { color: 'green', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Activo' },
  expired: { color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle, label: 'Vencido' },
  terminated: { color: 'gray', bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle, label: 'Terminado' },
  cancelled: { color: 'gray', bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle, label: 'Cancelado' },
  archived: { color: 'slate', bg: 'bg-slate-100', text: 'text-slate-600', icon: Archive, label: 'Archivado' },
}

// Formulario de contrato (paso 2: después de seleccionar template)
function ContractForm({ template, thirdParties, thirdPartyTypes, onSubmit, onCancel, onBack, isLoading, onEditThirdParty, onCreateThirdParty, creatingThirdParty }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contract_type: 'services',
    third_party_id: '',
    start_date: '',
    end_date: '',
    amount: '',
    currency: 'COP',
    payment_terms: '',
    payment_frequency: '',
    template_id: template?.id || '',
  })
  const [useSuggestedTitle, setUseSuggestedTitle] = useState(true)
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [showCreateThirdParty, setShowCreateThirdParty] = useState(false)

  // Validate template variables when third party or other contract data changes
  useEffect(() => {
    const validateData = async () => {
      if (!template?.id || !formData.third_party_id) {
        setValidation(null)
        return
      }

      setValidating(true)
      try {
        const response = await contractService.validateTemplate({
          template_id: template.id,
          third_party_id: formData.third_party_id,
          amount: formData.amount || 0,
          start_date: formData.start_date,
          end_date: formData.end_date,
          description: formData.description,
          contract_type: formData.contract_type,
          payment_terms: formData.payment_terms,
          payment_frequency: formData.payment_frequency,
        })
        setValidation(response.data)
      } catch (error) {
        console.error('Validation error:', error)
        setValidation(null)
      } finally {
        setValidating(false)
      }
    }

    // Debounce validation
    const timer = setTimeout(validateData, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, formData.third_party_id, formData.amount, formData.start_date, formData.end_date, formData.payment_terms || '', formData.payment_frequency || ''])

  // Generate suggested title from contract type and third party
  const getSuggestedTitle = () => {
    const typeLabel = CONTRACT_TYPES.find(t => t.value === formData.contract_type)?.label || ''
    const thirdParty = thirdParties.find(tp => tp.id === formData.third_party_id)
    const thirdPartyName = thirdParty?.trade_name || thirdParty?.business_name || thirdParty?.display_name || ''

    if (typeLabel && thirdPartyName) {
      return `${typeLabel} - ${thirdPartyName}`
    }
    return ''
  }

  // Auto-update title when using suggested and type/third_party changes
  useEffect(() => {
    if (useSuggestedTitle) {
      const suggested = getSuggestedTitle()
      if (suggested) {
        setFormData(prev => ({ ...prev, title: suggested }))
      }
    }
  }, [formData.contract_type, formData.third_party_id, useSuggestedTitle])

  const handleChange = (field, value) => {
    // If user manually changes title, switch to manual mode
    if (field === 'title') {
      setUseSuggestedTitle(false)
    }
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <>
      {/* Modal para crear tercero - OUTSIDE form to avoid nested forms */}
      {showCreateThirdParty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Tercero</h3>
              <p className="text-sm text-gray-500">El tercero se creará con los campos requeridos por el template</p>
            </div>
            <div className="p-6">
              <ThirdPartyQuickForm
                template={template}
                thirdPartyTypes={thirdPartyTypes}
                onSubmit={(data) => {
                  onCreateThirdParty(data, (newThirdParty) => {
                    setFormData(prev => ({ ...prev, third_party_id: newThirdParty.id }))
                    setShowCreateThirdParty(false)
                  })
                }}
                onCancel={() => setShowCreateThirdParty(false)}
                isLoading={creatingThirdParty}
              />
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template seleccionado */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileCheck className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Template seleccionado</p>
              <p className="font-semibold text-indigo-900">{template?.name}</p>
              <p className="text-xs text-indigo-500">{template?.variables?.length || 0} variables configuradas</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de Contrato"
            value={formData.contract_type}
            onChange={(e) => handleChange('contract_type', e.target.value)}
            options={CONTRACT_TYPES}
            required
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Tercero *</label>
              <button
                type="button"
                onClick={() => setShowCreateThirdParty(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <UserPlus className="h-3 w-3" />
                Crear nuevo
              </button>
            </div>
            <select
              value={formData.third_party_id}
              onChange={(e) => handleChange('third_party_id', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Seleccionar tercero...</option>
              {thirdParties.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.display_name} ({tp.code})</option>
              ))}
            </select>
            {thirdParties.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No hay terceros activos. Crea uno nuevo para continuar.
              </p>
            )}
          </div>
        </div>

        {/* Título del contrato con sugerencia automática */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Título del Contrato</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useSuggestedTitle}
              onChange={(e) => {
                setUseSuggestedTitle(e.target.checked)
                if (e.target.checked) {
                  const suggested = getSuggestedTitle()
                  if (suggested) {
                    setFormData(prev => ({ ...prev, title: suggested }))
                  }
                }
              }}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-gray-600">Sugerir nombre</span>
          </label>
        </div>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder={useSuggestedTitle ? 'Selecciona tipo y tercero...' : 'Ej: Contrato de Servicios TI 2025'}
          required
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            useSuggestedTitle ? 'border-primary-300 bg-primary-50' : 'border-gray-300'
          }`}
        />
        {useSuggestedTitle && getSuggestedTitle() && (
          <p className="mt-1 text-xs text-primary-600">
            Nombre generado automáticamente desde Tipo + Tercero
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          placeholder="Describe el objeto del contrato..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Fecha Inicio"
          type="date"
          value={formData.start_date}
          onChange={(e) => handleChange('start_date', e.target.value)}
          required
        />
        <Input
          label="Fecha Fin"
          type="date"
          value={formData.end_date}
          onChange={(e) => handleChange('end_date', e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Monto"
          type="number"
          value={formData.amount}
          onChange={(e) => handleChange('amount', e.target.value)}
          placeholder="0"
          required
        />
        <Select
          label="Moneda"
          value={formData.currency}
          onChange={(e) => handleChange('currency', e.target.value)}
          options={[
            { value: 'COP', label: 'COP (Pesos)' },
            { value: 'USD', label: 'USD (Dólares)' },
            { value: 'EUR', label: 'EUR (Euros)' },
          ]}
        />
        <Select
          label="Periodicidad de Pago"
          value={formData.payment_frequency}
          onChange={(e) => handleChange('payment_frequency', e.target.value)}
          options={[
            { value: '', label: 'Seleccionar...' },
            { value: 'monthly', label: 'Mensual' },
            { value: 'bimonthly', label: 'Bimestral' },
            { value: 'quarterly', label: 'Trimestral' },
            { value: 'semiannual', label: 'Semestral' },
            { value: 'annual', label: 'Anual' },
            { value: 'one_time', label: 'Pago Único' },
          ]}
        />
        <Input
          label="Condiciones de Pago"
          value={formData.payment_terms || ''}
          onChange={(e) => handleChange('payment_terms', e.target.value)}
          placeholder="Ej: 30 días"
        />
      </div>

      {/* Info de nivel de aprobación */}
      {formData.amount && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Nivel de aprobación estimado:</span>{' '}
            {Number(formData.amount) <= 10000000 && 'Nivel 1 (Jefe de Área)'}
            {Number(formData.amount) > 10000000 && Number(formData.amount) <= 50000000 && 'Nivel 2 (Jefe de Área → Legal)'}
            {Number(formData.amount) > 50000000 && Number(formData.amount) <= 200000000 && 'Nivel 3 (Jefe de Área → Legal → Gerente)'}
            {Number(formData.amount) > 200000000 && 'Nivel 4 (Jefe de Área → Legal → Gerente → CEO)'}
          </p>
        </div>
      )}

      {/* Validation status */}
      {validating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-700">Validando datos del template...</span>
          </div>
        </div>
      )}

      {validation && !validating && (
        validation.valid ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Todos los datos están completos ({validation.validation.resolved_count}/{validation.template.total_variables} variables)
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 mb-2">
                  Faltan datos para generar el documento ({validation.validation.missing_count} de {validation.template.total_variables})
                </p>
                <div className="space-y-1">
                  {validation.validation.missing_by_source?.third_party?.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-red-600">Datos del Tercero:</span>
                      <ul className="ml-4 list-disc text-red-600">
                        {validation.validation.missing_by_source.third_party.map((m, i) => (
                          <li key={i}>{m.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {validation.validation.missing_by_source?.contract?.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-red-600">Datos del Contrato:</span>
                      <ul className="ml-4 list-disc text-red-600">
                        {validation.validation.missing_by_source.contract.map((m, i) => (
                          <li key={i}>{m.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {validation.validation.missing_by_source?.unmapped?.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-amber-600">Variables sin mapear:</span>
                      <ul className="ml-4 list-disc text-amber-600">
                        {validation.validation.missing_by_source.unmapped.map((m, i) => (
                          <li key={i}>{m.variable}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <p className="text-xs text-red-500 mt-2">
                  Complete los datos faltantes del tercero o contacte a un administrador para mapear las variables.
                </p>
                {validation.validation.missing_by_source?.third_party?.length > 0 && formData.third_party_id && onEditThirdParty && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      const tp = thirdParties.find(t => t.id === formData.third_party_id)
                      if (tp) {
                        onEditThirdParty(tp, validation.validation.missing_by_source.third_party)
                      }
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Completar datos del tercero
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Cambiar Template
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={isLoading}
            disabled={validating || (validation && !validation.valid)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear Contrato
          </Button>
        </div>
      </div>
      </form>
    </>
  )
}

// Selector de Template (paso 1)
function TemplateSelector({ templates, onSelect, onCancel, isLoading }) {
  const [selectedId, setSelectedId] = useState('')
  const selectedTemplate = templates.find(t => t.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Selecciona un template</p>
            <p className="text-sm text-blue-700">
              Los contratos se generan a partir de templates predefinidos.
              Selecciona el template que mejor se ajuste al tipo de contrato.
            </p>
          </div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8">
          <FileWarning className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay templates disponibles</h3>
          <p className="text-gray-500 mb-4">
            Para crear contratos, primero debes crear templates en la categoría "Comercial".
          </p>
          <Button variant="secondary" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedId(template.id)}
                className={`
                  p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${selectedId === template.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selectedId === template.id ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <FileText className={`h-5 w-5 ${selectedId === template.id ? 'text-indigo-600' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className={`font-medium ${selectedId === template.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {template.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {template.category_label} • {template.variables?.length || 0} variables
                      </p>
                    </div>
                  </div>
                  {selectedId === template.id && (
                    <CheckCircle className="h-5 w-5 text-indigo-600" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={() => onSelect(selectedTemplate)}
              disabled={!selectedId}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// Fila de contrato en la tabla
function ContractRow({ contract, onView, onEdit, onSubmit, onDownload, onViewDocument, onGenerate, onDelete, onArchive, onUnarchive, isAdmin, showArchived }) {
  const [showMenu, setShowMenu] = useState(false)
  const status = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft
  const StatusIcon = status.icon

  const formatAmount = (amount, currency) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const canGenerate = ['approved', 'active'].includes(contract.status) && !contract.has_document
  const canSubmit = contract.status === 'draft'
  const canEdit = contract.status === 'draft'

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100">
      {/* Contrato */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status.bg}`}>
            <StatusIcon className={`h-4 w-4 ${status.text}`} />
          </div>
          <div>
            <p className="font-medium text-gray-900 truncate max-w-[200px]" title={contract.title}>
              {contract.title}
            </p>
            <p className="text-xs text-gray-500">{contract.contract_number}</p>
          </div>
        </div>
      </td>

      {/* Tercero */}
      <td className="px-4 py-3">
        {contract.third_party ? (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900 truncate max-w-[150px]" title={contract.third_party.display_name}>
              {contract.third_party.display_name}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>

      {/* Tipo */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-700">{contract.type_label}</span>
      </td>

      {/* Monto */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {formatAmount(contract.amount, contract.currency)}
          </span>
        </div>
      </td>

      {/* Vigencia */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar className="h-3 w-3 text-gray-400" />
          <span>{formatDate(contract.start_date)}</span>
          <span className="text-gray-400">→</span>
          <span>{formatDate(contract.end_date)}</span>
        </div>
        {contract.expiring_soon && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3 text-orange-500" />
            <span className="text-xs text-orange-600">Vence en {contract.days_until_expiry} días</span>
          </div>
        )}
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <Badge status={status.color}>{status.label}</Badge>
      </td>

      {/* Aprobación */}
      <td className="px-4 py-3">
        {contract.status === 'pending_approval' ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-20">
                <div
                  className="bg-yellow-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${contract.approval_progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{contract.approval_progress}%</span>
            </div>
            <p className="text-xs text-gray-500 truncate" title={contract.current_approver_label}>
              → {contract.current_approver_label}
            </p>
          </div>
        ) : contract.status === 'approved' || contract.status === 'active' ? (
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-600">Completa</span>
          </div>
        ) : contract.status === 'rejected' ? (
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600">Rechazado</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="relative flex items-center justify-end gap-1">
          {/* Acciones principales */}
          {canSubmit && (
            <button
              onClick={() => onSubmit(contract.id)}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Enviar a Aprobación"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          {canGenerate && (
            <button
              onClick={() => onGenerate(contract)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Generar Documento"
            >
              <FilePlus className="h-4 w-4" />
            </button>
          )}
          {contract.has_document && (
            <>
              <button
                onClick={() => onViewDocument(contract)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Ver Documento"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDownload(contract.id)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Descargar PDF"
              >
                <Download className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Menú adicional */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                  <button
                    onClick={() => { onView(contract.id); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Detalle
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => { onEdit(contract); setShowMenu(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                  {contract.can_delete && (
                    <button
                      onClick={() => {
                        if (confirm('¿Estás seguro de eliminar este contrato? Esta acción no se puede deshacer.')) {
                          onDelete(contract.id)
                        }
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  )}
                  {/* Archive/Unarchive - Admin only */}
                  {isAdmin && !showArchived && ['active', 'expired', 'terminated', 'cancelled'].includes(contract.status) && (
                    <button
                      onClick={() => { onArchive(contract.id); setShowMenu(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                    >
                      <Archive className="h-4 w-4" />
                      Archivar
                    </button>
                  )}
                  {isAdmin && showArchived && contract.status === 'archived' && (
                    <button
                      onClick={() => { onUnarchive(contract.id); setShowMenu(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                      Restaurar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// Skeleton para carga
function TableSkeleton() {
  return (
    <tbody>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-b border-gray-100 animate-pulse">
          <td className="px-4 py-3"><div className="h-10 bg-gray-200 rounded w-48" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-32" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-28" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-36" /></td>
          <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-3"><div className="h-8 bg-gray-200 rounded w-24" /></td>
        </tr>
      ))}
    </tbody>
  )
}

export default function Contracts() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState(1) // 1: select template, 2: fill form
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [generateTemplateId, setGenerateTemplateId] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailContract, setDetailContract] = useState(null)
  const [editingThirdParty, setEditingThirdParty] = useState(null)
  const [missingFields, setMissingFields] = useState([])
  // Document viewer states
  const [documentContract, setDocumentContract] = useState(null)
  const [documentUrl, setDocumentUrl] = useState(null)
  const [documentLoading, setDocumentLoading] = useState(false)
  // Variables panel state
  const [showVariablesPanel, setShowVariablesPanel] = useState(false)
  // Archived contracts state
  const [showArchived, setShowArchived] = useState(false)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', search, typeFilter, statusFilter, showArchived],
    queryFn: () => contractService.list({
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      archived: showArchived ? 'true' : undefined,
    }),
  })

  const { data: thirdPartiesData } = useQuery({
    queryKey: ['third-parties-active'],
    queryFn: () => thirdPartyService.list({ status: 'active', per_page: 100 }),
  })

  const { data: templatesData } = useQuery({
    queryKey: ['templates-comercial'],
    queryFn: () => publicTemplateService.list({ main_category: 'comercial' }),
  })

  const { data: thirdPartyTypesData } = useQuery({
    queryKey: ['third-party-types-active'],
    queryFn: () => thirdPartyTypeService.list({ active: 'true' }),
  })

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Create the contract
      const createResponse = await contractService.create(data)
      const contract = createResponse.data?.data

      // 2. If contract has a template, auto-generate the document
      if (contract?.id && data.template_id) {
        try {
          await contractService.generateDocument(contract.id, data.template_id)
        } catch (genError) {
          console.warn('Auto-generate failed:', genError)
          // Don't fail the whole operation, document can be generated later
        }
      }

      return createResponse
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      handleCloseCreateModal()
    },
    onError: (error) => {
      const message = error.response?.data?.error || error.response?.data?.errors?.join(', ') || 'Error al crear contrato'
      alert(message)
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id) => contractService.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => contractService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      alert('Contrato eliminado correctamente')
    },
    onError: (error) => {
      alert(error.response?.data?.error || error.response?.data?.errors?.join(', ') || 'Error al eliminar contrato')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id) => contractService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al archivar contrato')
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id) => contractService.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al restaurar contrato')
    },
  })

  const generateMutation = useMutation({
    mutationFn: ({ contractId, templateId }) => contractService.generateDocument(contractId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      setShowGenerateModal(false)
      setSelectedContract(null)
      setGenerateTemplateId('')
    },
    onError: (error) => {
      alert(error.response?.data?.error || error.response?.data?.missing_variables || 'Error al generar documento')
    }
  })

  const updateThirdPartyMutation = useMutation({
    mutationFn: ({ id, data }) => thirdPartyService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-parties-active'])
      setEditingThirdParty(null)
      setMissingFields([])
    },
  })

  const createThirdPartyMutation = useMutation({
    mutationFn: (data) => thirdPartyService.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['third-parties-active'])
      return response.data?.data // Return the created third party
    },
    onError: (error) => {
      const errors = error.response?.data?.errors || []
      const message = errors.length > 0 ? errors.join(', ') : (error.response?.data?.error || 'Error al crear tercero')
      alert(message)
    },
  })

  const contracts = data?.data?.data || []
  const thirdParties = thirdPartiesData?.data?.data || []
  const templates = templatesData?.data?.data || []
  const thirdPartyTypes = thirdPartyTypesData?.data?.data || []

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setCreateStep(1)
    setSelectedTemplate(null)
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setCreateStep(2)
  }

  const handleDownload = async (id) => {
    try {
      const response = await contractService.downloadDocument(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `contrato-${id}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading document:', error)
    }
  }

  // View document in modal
  const handleViewDocument = async (contract) => {
    setDocumentContract(contract)
    setDocumentLoading(true)
    try {
      const response = await contractService.downloadDocument(contract.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDocumentUrl(url)
    } catch (error) {
      console.error('Error loading document:', error)
      alert('Error al cargar el documento')
    } finally {
      setDocumentLoading(false)
    }
  }

  const handleCloseDocument = () => {
    if (documentUrl) {
      URL.revokeObjectURL(documentUrl)
    }
    setDocumentContract(null)
    setDocumentUrl(null)
  }

  const handleGenerateClick = (contract) => {
    // If contract already has a template, generate directly
    if (contract.template_id) {
      generateMutation.mutate({
        contractId: contract.id,
        templateId: contract.template_id
      })
    } else {
      // Show modal to select template
      setSelectedContract(contract)
      setGenerateTemplateId('')
      setShowGenerateModal(true)
    }
  }

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar este contrato?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleArchive = (id) => {
    if (confirm('¿Estás seguro de archivar este contrato? Los contratos archivados no aparecen en la lista principal.')) {
      archiveMutation.mutate(id)
    }
  }

  const handleUnarchive = (id) => {
    if (confirm('¿Restaurar este contrato del archivo?')) {
      unarchiveMutation.mutate(id)
    }
  }

  // Estadísticas rápidas
  const stats = {
    total: contracts.length,
    pending: contracts.filter(c => c.status === 'pending_approval').length,
    pendingSignatures: contracts.filter(c => c.status === 'pending_signatures').length,
    active: contracts.filter(c => c.status === 'active').length,
    expiring: contracts.filter(c => c.expiring_soon).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {showArchived ? 'Contratos Archivados' : 'Contratos'}
          </h1>
          <p className="text-gray-500">
            {showArchived
              ? 'Contratos que han sido archivados'
              : 'Gestión de contratos con aprobación multinivel'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant={showArchived ? 'primary' : 'secondary'}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Activos
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Ver Archivados
                </>
              )}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowVariablesPanel(true)}>
            <Variable className="h-4 w-4 mr-2" />
            Variables
          </Button>
          <Link to="/legal/third-parties">
            <Button variant="secondary">
              <Users className="h-4 w-4 mr-2" />
              Terceros
            </Button>
          </Link>
          {!showArchived && (
            <Button onClick={() => setShowCreateModal(true)} disabled={templates.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Contrato
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-sm text-gray-500">En Aprobación</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats.pendingSignatures}</p>
              <p className="text-sm text-gray-500">Pend. Firmas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-sm text-gray-500">Activos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.expiring}</p>
              <p className="text-sm text-gray-500">Por Vencer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta si no hay templates */}
      {templates.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">No hay templates de contratos</p>
              <p className="text-sm text-yellow-700">
                Para crear contratos, primero debes crear templates en la categoría "Comercial"
                desde Administración → Templates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título, número, tercero..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[{ value: '', label: 'Todos los tipos' }, ...CONTRACT_TYPES]}
              className="w-48"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'draft', label: 'Borrador' },
                { value: 'pending_approval', label: 'En Aprobación' },
                { value: 'pending_signatures', label: 'Pendiente Firmas' },
                { value: 'approved', label: 'Aprobado' },
                { value: 'active', label: 'Activo' },
                { value: 'rejected', label: 'Rechazado' },
                { value: 'expired', label: 'Vencido' },
              ]}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Contrato
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tercero
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Vigencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aprobación
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton />
            ) : contracts.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay contratos</h3>
                    <p className="text-gray-500 mb-4">
                      {templates.length === 0
                        ? 'Primero crea un template de contrato comercial'
                        : 'Comienza creando tu primer contrato'}
                    </p>
                    {templates.length > 0 && (
                      <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Contrato
                      </Button>
                    )}
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {contracts.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    onView={(id) => {
                      const contract = contracts.find(c => c.id === id)
                      if (contract) {
                        setDetailContract(contract)
                        setShowDetailModal(true)
                      }
                    }}
                    onEdit={(c) => {
                      setDetailContract(c)
                      setShowDetailModal(true)
                    }}
                    onSubmit={(id) => submitMutation.mutate(id)}
                    onDownload={handleDownload}
                    onViewDocument={handleViewDocument}
                    onGenerate={handleGenerateClick}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    isAdmin={isAdmin}
                    showArchived={showArchived}
                  />
                ))}
              </tbody>
            )}
          </table>
        </div>
      </Card>

      {/* Create Modal - 2 steps */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title={createStep === 1 ? 'Nuevo Contrato - Seleccionar Template' : 'Nuevo Contrato - Información'}
        size="lg"
      >
        {createStep === 1 ? (
          <TemplateSelector
            templates={templates}
            onSelect={handleTemplateSelect}
            onCancel={handleCloseCreateModal}
          />
        ) : (
          <ContractForm
            template={selectedTemplate}
            thirdParties={thirdParties}
            thirdPartyTypes={thirdPartyTypes}
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={handleCloseCreateModal}
            onBack={() => setCreateStep(1)}
            isLoading={createMutation.isPending}
            onEditThirdParty={(tp, missing) => {
              setEditingThirdParty(tp)
              setMissingFields(missing)
            }}
            onCreateThirdParty={(data, onSuccess) => {
              createThirdPartyMutation.mutate(data, {
                onSuccess: (response) => {
                  const newThirdParty = response.data?.data
                  if (newThirdParty && onSuccess) {
                    onSuccess(newThirdParty)
                  }
                }
              })
            }}
            creatingThirdParty={createThirdPartyMutation.isPending}
          />
        )}
      </Modal>

      {/* Generate Document Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false)
          setSelectedContract(null)
          setGenerateTemplateId('')
        }}
        title="Generar Documento"
      >
        <div className="space-y-4">
          {selectedContract && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">{selectedContract.title}</p>
                  <p className="text-sm text-gray-500">{selectedContract.contract_number}</p>
                  <p className="text-sm text-gray-500">
                    Tercero: {selectedContract.third_party?.display_name}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Select
            label="Template para Generar"
            value={generateTemplateId}
            onChange={(e) => setGenerateTemplateId(e.target.value)}
            options={[
              { value: '', label: 'Seleccionar template...' },
              ...templates.map(t => ({
                value: t.id,
                label: `${t.name} (${t.variables?.length || 0} variables)`
              }))
            ]}
          />

          {templates.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                No hay templates de contratos comerciales activos.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowGenerateModal(false)
                setSelectedContract(null)
                setGenerateTemplateId('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => generateMutation.mutate({
                contractId: selectedContract.id,
                templateId: generateTemplateId
              })}
              loading={generateMutation.isPending}
              disabled={!generateTemplateId}
            >
              <FilePlus className="h-4 w-4 mr-2" />
              Generar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setDetailContract(null)
        }}
        title="Detalle del Contrato"
        size="lg"
      >
        {detailContract && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{detailContract.title}</h3>
                <p className="text-sm text-gray-500">{detailContract.contract_number}</p>
              </div>
              <Badge variant={detailContract.status}>
                {detailContract.status_label || detailContract.status}
              </Badge>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Tercero</p>
                <p className="font-medium">{detailContract.third_party?.display_name || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Tipo</p>
                <p className="font-medium">{detailContract.type_label || detailContract.contract_type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Monto</p>
                <p className="font-medium text-green-600">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: detailContract.currency || 'COP' }).format(detailContract.amount || 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nivel de Aprobación</p>
                <p className="font-medium">{detailContract.approval_level_label || detailContract.approval_level}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha Inicio</p>
                <p className="font-medium">{detailContract.start_date ? new Date(detailContract.start_date).toLocaleDateString('es-CO') : 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha Fin</p>
                <p className="font-medium">{detailContract.end_date ? new Date(detailContract.end_date).toLocaleDateString('es-CO') : 'N/A'}</p>
              </div>
            </div>

            {/* Description */}
            {detailContract.description && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Descripción</p>
                <p className="text-gray-700">{detailContract.description}</p>
              </div>
            )}

            {/* Payment Terms */}
            {detailContract.payment_terms && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Términos de Pago</p>
                <p className="text-gray-700">{detailContract.payment_terms}</p>
              </div>
            )}

            {/* Document */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Documento del Contrato</span>
                </div>
                {detailContract.has_document ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowDetailModal(false)
                        handleViewDocument(detailContract)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Documento
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(detailContract.id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600">Sin documento</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowDetailModal(false)
                        handleGenerateClick(detailContract)
                      }}
                    >
                      <FilePlus className="h-4 w-4 mr-1" />
                      Generar
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Approvals */}
            {detailContract.approvals && detailContract.approvals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Aprobaciones</p>
                <div className="space-y-2">
                  {detailContract.approvals.map((approval, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-sm">{approval.role_label || approval.role}</p>
                        {approval.approver_name && <p className="text-xs text-gray-500">{approval.approver_name}</p>}
                      </div>
                      <Badge variant={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'error' : 'warning'}>
                        {approval.status === 'approved' ? 'Aprobado' : approval.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDetailModal(false)
                  setDetailContract(null)
                }}
              >
                Cerrar
              </Button>
              {detailContract.status === 'draft' && (
                <Button
                  onClick={() => {
                    submitMutation.mutate(detailContract.id)
                    setShowDetailModal(false)
                    setDetailContract(null)
                  }}
                  loading={submitMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar a Aprobación
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Third Party Modal */}
      <Modal
        isOpen={!!editingThirdParty}
        onClose={() => {
          setEditingThirdParty(null)
          setMissingFields([])
        }}
        title="Completar datos del tercero"
        size="lg"
      >
        {editingThirdParty && (
          <ThirdPartyQuickEdit
            thirdParty={editingThirdParty}
            missingFields={missingFields}
            onSubmit={(data) => updateThirdPartyMutation.mutate({ id: editingThirdParty.id, data })}
            onCancel={() => {
              setEditingThirdParty(null)
              setMissingFields([])
            }}
            isLoading={updateThirdPartyMutation.isPending}
          />
        )}
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!documentContract}
        onClose={handleCloseDocument}
        title={`Documento: ${documentContract?.contract_number || ''}`}
        size="xl"
      >
        <div className="space-y-4">
          {/* Contract Info Header */}
          {documentContract && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Contrato:</span>
                  <p className="font-medium">{documentContract.title}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tercero:</span>
                  <p className="font-medium">{documentContract.third_party?.display_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Monto:</span>
                  <p className="font-medium text-green-600">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: documentContract.currency || 'COP' }).format(documentContract.amount)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <Badge variant={documentContract.status}>{documentContract.status_label || documentContract.status}</Badge>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          {documentLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-3 text-gray-500">Cargando documento...</span>
            </div>
          ) : documentUrl ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
              <iframe
                src={documentUrl}
                className="w-full h-full"
                title="Contract Document"
              />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileWarning className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No se pudo cargar el documento</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                if (documentUrl) {
                  const a = document.createElement('a')
                  a.href = documentUrl
                  a.download = `${documentContract?.contract_number || 'contrato'}.pdf`
                  a.click()
                }
              }}
              disabled={!documentUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button variant="secondary" onClick={handleCloseDocument}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Legal Variables Panel */}
      <LegalVariablesPanel
        isOpen={showVariablesPanel}
        onClose={() => setShowVariablesPanel(false)}
      />
    </div>
  )
}

// Quick edit form for third party - shows only missing fields
function ThirdPartyQuickEdit({ thirdParty, missingFields, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    ...thirdParty,
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  // Map field paths to form fields
  const getFieldConfig = (fieldPath) => {
    const fieldMap = {
      'legal_rep_name': { label: 'Nombre del Representante Legal', type: 'text', field: 'legal_rep_name' },
      'legal_rep_id': { label: 'Cédula del Representante Legal', type: 'text', field: 'legal_rep_id_number' },
      'legal_rep_email': { label: 'Email del Representante Legal', type: 'email', field: 'legal_rep_email' },
      'display_name': { label: 'Nombre', type: 'text', field: 'business_name' },
      'business_name': { label: 'Razón Social', type: 'text', field: 'business_name' },
      'trade_name': { label: 'Nombre Comercial', type: 'text', field: 'trade_name' },
      'identification_number': { label: 'Número de Identificación', type: 'text', field: 'identification_number' },
      'address': { label: 'Dirección', type: 'text', field: 'address' },
      'city': { label: 'Ciudad', type: 'text', field: 'city' },
      'phone': { label: 'Teléfono', type: 'text', field: 'phone' },
      'email': { label: 'Email', type: 'email', field: 'email' },
      'bank_name': { label: 'Banco', type: 'text', field: 'bank_name' },
      'bank_account_number': { label: 'Número de Cuenta', type: 'text', field: 'bank_account_number' },
      'bank_account_type': { label: 'Tipo de Cuenta', type: 'select', field: 'bank_account_type', options: [
        { value: '', label: 'Seleccionar...' },
        { value: 'savings', label: 'Ahorros' },
        { value: 'checking', label: 'Corriente' },
      ]},
    }
    return fieldMap[fieldPath] || null
  }

  // Get unique fields to show
  const fieldsToShow = [...new Set(missingFields.map(m => m.field))].map(field => getFieldConfig(field)).filter(Boolean)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Datos faltantes para {thirdParty.display_name}</p>
            <p className="text-sm text-amber-700">
              Complete los siguientes campos para poder generar el documento del contrato.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {fieldsToShow.map((config, idx) => (
          <div key={idx}>
            {config.type === 'select' ? (
              <Select
                label={config.label}
                value={formData[config.field] || ''}
                onChange={(e) => handleChange(config.field, e.target.value)}
                options={config.options}
                required
              />
            ) : (
              <Input
                label={config.label}
                type={config.type}
                value={formData[config.field] || ''}
                onChange={(e) => handleChange(config.field, e.target.value)}
                required
              />
            )}
          </div>
        ))}
      </div>

      {fieldsToShow.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <p>No se pudieron determinar los campos faltantes.</p>
          <p className="text-sm">Por favor, edite el tercero desde la sección de Terceros.</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading} disabled={fieldsToShow.length === 0}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Guardar y Continuar
        </Button>
      </div>
    </form>
  )
}
