import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { variableMappingService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import {
  Variable,
  Plus,
  Search,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Filter,
  X,
  RefreshCw,
  Lock,
  Building2,
  FileText,
  CheckCircle,
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

// Solo categorías del módulo Legal
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

const CATEGORY_ICONS = {
  third_party: Building2,
  contract: FileText,
  organization: Settings,
  system: Settings,
  custom: Variable
}

const CATEGORY_COLORS = {
  third_party: 'indigo',
  contract: 'blue',
  organization: 'purple',
  system: 'gray',
  custom: 'orange'
}

function VariableRow({ mapping, onToggle, onEdit }) {
  const CategoryIcon = CATEGORY_ICONS[mapping.category] || Variable
  const categoryColor = CATEGORY_COLORS[mapping.category] || 'gray'

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
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
          <CategoryIcon className="h-3 w-3 mr-1" />
          {LEGAL_CATEGORIES[mapping.category] || mapping.category}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">
          {DATA_TYPES.find(t => t.value === mapping.data_type)?.label || mapping.data_type}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-500 truncate max-w-[200px]" title={mapping.description}>
          {mapping.description || '-'}
        </p>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(mapping.id)}
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
      <td className="px-4 py-3">
        {!mapping.is_system && (
          <button
            onClick={() => onEdit(mapping)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  )
}

function TableSkeleton() {
  return (
    <tbody>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-b border-gray-100 animate-pulse">
          <td className="px-4 py-3"><div className="h-10 bg-gray-200 rounded w-48" /></td>
          <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-16" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-40" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-8" /></td>
          <td className="px-4 py-3"><div className="h-8 bg-gray-200 rounded w-8" /></td>
        </tr>
      ))}
    </tbody>
  )
}

function VariableModal({ mapping, isOpen, onClose, onSuccess }) {
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

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? variableMappingService.update(mapping.id, data)
      : variableMappingService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['variable-mappings'])
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar Variable' : 'Nueva Variable'}
    >
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

export default function LegalVariables() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showSystemOnly, setShowSystemOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const queryClient = useQueryClient()

  // Fetch mappings - filter by legal categories
  const { data, isLoading } = useQuery({
    queryKey: ['variable-mappings-legal'],
    queryFn: () => variableMappingService.list(),
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
    const matchesSystem = !showSystemOnly || m.is_system
    return matchesSearch && matchesCategory && matchesSystem
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

  // Stats
  const stats = {
    total: filteredByModule.length,
    thirdParty: filteredByModule.filter(m => m.category === 'third_party').length,
    contract: filteredByModule.filter(m => m.category === 'contract').length,
    system: filteredByModule.filter(m => m.is_system).length,
  }

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingMapping(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variables de Contratos</h1>
          <p className="text-gray-500">Gestiona las variables para documentos comerciales</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => seedMutation.mutate()}
            loading={seedMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar Sistema
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Variable
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Variable className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Variables</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{stats.thirdParty}</p>
              <p className="text-sm text-gray-500">Terceros</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.contract}</p>
              <p className="text-sm text-gray-500">Contratos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Lock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.system}</p>
              <p className="text-sm text-gray-500">Del Sistema</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
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
            <button
              onClick={() => setShowSystemOnly(!showSystemOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showSystemOnly
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Lock className="h-4 w-4" />
              Solo Sistema
            </button>
            {(search || categoryFilter || showSystemOnly) && (
              <button
                onClick={() => {
                  setSearch('')
                  setCategoryFilter('')
                  setShowSystemOnly(false)
                }}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
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
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton />
            ) : mappings.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Variable className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay variables
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {search || categoryFilter
                        ? 'No se encontraron variables con los filtros aplicados'
                        : 'Haz clic en "Sincronizar Sistema" para cargar las variables'}
                    </p>
                    {!search && !categoryFilter && (
                      <Button onClick={() => seedMutation.mutate()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Sistema
                      </Button>
                    )}
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {mappings.map((mapping) => (
                  <VariableRow
                    key={mapping.id}
                    mapping={mapping}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onEdit={handleEdit}
                  />
                ))}
              </tbody>
            )}
          </table>
        </div>
        {mappings.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            Mostrando {mappings.length} de {filteredByModule.length} variables
          </div>
        )}
      </Card>

      {/* Modal */}
      <VariableModal
        mapping={editingMapping}
        isOpen={showModal}
        onClose={handleCloseModal}
      />
    </div>
  )
}
