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
  X,
  AlertCircle,
  Save,
  Database,
  Lock,
  Link2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

const CATEGORIES = {
  employee:     'Empleado',
  organization: 'Organización',
  request:      'Solicitud',
  system:       'Sistema',
  third_party:  'Tercero',
  contract:     'Contrato',
  custom:       'Personalizado'
}

const DATA_TYPES = [
  { value: 'string',  label: 'Texto' },
  { value: 'date',    label: 'Fecha' },
  { value: 'number',  label: 'Número' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'email',   label: 'Email' }
]

// ─── Modal crear / editar ────────────────────────────────────────────────────

function MappingModal({ mapping, isOpen, onClose }) {
  const queryClient = useQueryClient()
  const isEdit = !!mapping

  const empty = {
    name: '', key: '', category: 'custom',
    description: '', data_type: 'string'
  }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(mapping
      ? { name: mapping.name, key: mapping.key, category: mapping.category,
          description: mapping.description || '', data_type: mapping.data_type || 'string' }
      : empty
    )
    setError('')
  }, [mapping, isOpen])

  const createMutation = useMutation({
    mutationFn: (data) => variableMappingService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['variable-mappings-admin'] }); onClose() },
    onError:   (err) => setError(err.response?.data?.errors?.join(', ') || err.response?.data?.error || 'Error al guardar')
  })

  const updateMutation = useMutation({
    mutationFn: (data) => variableMappingService.update(mapping.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['variable-mappings-admin'] }); onClose() },
    onError:   (err) => setError(err.response?.data?.errors?.join(', ') || err.response?.data?.error || 'Error al guardar')
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (isEdit) {
      const { key, ...data } = form
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(form)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar Variable' : 'Nueva Variable de Mapeo'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Salario Mensual"
            required
          />

          {!isEdit && (
            <Input
              label="Clave (opcional — se genera automáticamente)"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="Ej: custom.salario_mensual"
              hint="Formato: categoria.campo (minúsculas y guiones bajos)"
            />
          )}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave (no editable)</label>
              <code className="block w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-500">
                {mapping.key}
              </code>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(CATEGORIES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Dato</label>
            <select
              value={form.data_type}
              onChange={(e) => setForm({ ...form, data_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qué representa esta variable..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isPending}>
              <Save className="w-4 h-4" />
              {isEdit ? 'Guardar cambios' : 'Crear variable'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Fila de tabla ───────────────────────────────────────────────────────────

function MappingRow({ mapping, onEdit, onToggle, onDelete, isAdmin, siblingNames }) {
  const isSystem = mapping.is_system

  return (
    <tr className={!mapping.active ? 'opacity-50 bg-gray-50' : undefined}>
      <td className="px-4 py-3">
        <code className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{mapping.key}</code>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isSystem && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          <span className="font-medium text-sm">{mapping.name}</span>
        </div>
        {siblingNames?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {siblingNames.map(n => (
              <span key={n} className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">
                <Link2 className="w-2.5 h-2.5 mr-1" />{n}
              </span>
            ))}
          </div>
        )}
        {mapping.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{mapping.description}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="text-xs">
          {CATEGORIES[mapping.category] || mapping.category}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {DATA_TYPES.find(t => t.value === mapping.data_type)?.label || mapping.data_type}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(mapping)}
          className={`p-1 rounded ${mapping.active ? 'text-green-600' : 'text-gray-400'}`}
          title={mapping.active ? 'Desactivar' : 'Activar'}
        >
          {mapping.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
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
              title={isSystem ? 'Eliminar (solo admin)' : 'Eliminar'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function VariableMappings() {
  const { hasAdminAccess: isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [showModal,    setShowModal]    = useState(false)
  const [editMapping,  setEditMapping]  = useState(null)
  const [search,       setSearch]       = useState('')
  const [catFilter,    setCatFilter]    = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortCol,      setSortCol]      = useState('name')
  const [sortDir,      setSortDir]      = useState('asc')

  const { data, isLoading } = useQuery({
    queryKey: ['variable-mappings-admin', { category: catFilter, type: typeFilter }],
    queryFn:  () => variableMappingService.list({
      category: catFilter  || undefined,
      type:     typeFilter || undefined
    })
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => variableMappingService.toggleActive(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['variable-mappings-admin'] })
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => variableMappingService.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['variable-mappings-admin'] })
  })

  const seedMutation = useMutation({
    mutationFn: () => variableMappingService.seedSystem(),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['variable-mappings-admin'] })
  })

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />
  }

  const allMappings = data?.data?.data || []

  const filtered = allMappings
    .filter(m => {
      if (search) {
        const q = search.toLowerCase()
        if (!m.name.toLowerCase().includes(q) && !m.key.toLowerCase().includes(q)) return false
      }
      if (statusFilter === 'active'   && !m.active) return false
      if (statusFilter === 'inactive' &&  m.active) return false
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortCol === 'key')       { av = a.key;       bv = b.key }
      else if (sortCol === 'cat')  { av = CATEGORIES[a.category] || a.category; bv = CATEGORIES[b.category] || b.category }
      else if (sortCol === 'type') { av = a.data_type; bv = b.data_type }
      else { av = a.name; bv = b.name }
      av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })

  // Build key → sibling names map
  const keyToNames = allMappings.reduce((acc, m) => {
    if (!acc[m.key]) acc[m.key] = []
    acc[m.key].push(m.name)
    return acc
  }, {})
  const getSiblings = (m) => (keyToNames[m.key] || []).filter(n => n !== m.name)

  const hasFilters = search || catFilter || typeFilter || statusFilter

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variables de Mapeo</h1>
          <p className="text-gray-500">
            Variables del sistema disponibles para templates de todos los módulos
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="secondary"
              onClick={() => seedMutation.mutate()}
              loading={seedMutation.isPending}
              title="Reinicializar variables del sistema (no borra las personalizadas)"
            >
              <Database className="w-4 h-4" />
              Inicializar sistema
            </Button>
          )}
          <Button onClick={() => { setEditMapping(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" />
            Nueva variable
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o clave..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sistema / Custom</option>
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

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setCatFilter(''); setTypeFilter(''); setStatusFilter('') }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Limpiar
              </button>
            )}
          </div>

          {!isLoading && allMappings.length > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Mostrando <strong>{filtered.length}</strong> de <strong>{allMappings.length}</strong> variables
            </p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Variable className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin variables</h3>
              <p className="text-gray-500 mb-4">
                {allMappings.length === 0
                  ? 'Inicializa las variables del sistema o crea una personalizada'
                  : 'No hay resultados con los filtros aplicados'}
              </p>
              {allMappings.length === 0 && isAdmin && (
                <Button onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
                  <Database className="w-4 h-4" />
                  Inicializar variables del sistema
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[['key','Clave'],['name','Nombre'],['cat','Categoría'],['type','Tipo']].map(([col, label]) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((m) => (
                    <MappingRow
                      key={m.id}
                      mapping={m}
                      onEdit={(m) => { setEditMapping(m); setShowModal(true) }}
                      onToggle={(m) => toggleMutation.mutate(m.id)}
                      onDelete={(m) => {
                        if (confirm(`¿Eliminar la variable "${m.name}"?`)) deleteMutation.mutate(m.id)
                      }}
                      isAdmin={isAdmin}
                      siblingNames={getSiblings(m)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <MappingModal
        mapping={editMapping}
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditMapping(null) }}
      />
    </div>
  )
}
