import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { signatoryTypeService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  AlertCircle,
  Save,
  Lock,
  Database,
  UserCheck,
  Eye
} from 'lucide-react'

function TypeModal({ type, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const isEdit = !!type

  const [formData, setFormData] = useState({
    name: type?.name || '',
    code: type?.code || '',
    description: type?.description || ''
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (data) => signatoryTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['signatory-types'])
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Error al crear tipo de firmante')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => signatoryTypeService.update(type.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['signatory-types'])
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Error al actualizar tipo de firmante')
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
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar Tipo de Firmante' : 'Nuevo Tipo de Firmante'}
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
            label="Nombre"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Gerente de Operaciones"
            required
          />

          {!isEdit && (
            <Input
              label="Codigo (se genera automaticamente)"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Ej: operations_manager"
              hint="Solo letras minusculas, numeros y guiones bajos"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripcion del tipo de firmante..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
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
              {isEdit ? 'Guardar Cambios' : 'Crear Tipo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailModal({ type, isOpen, onClose }) {
  if (!isOpen || !type) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Detalle del Tipo de Firmante</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Nombre</label>
            <p className="text-sm font-medium mt-0.5">{type.name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Codigo</label>
            <p className="mt-0.5"><code className="px-2 py-1 bg-gray-100 rounded text-xs">{type.code}</code></p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Descripcion</label>
            <p className="text-sm text-gray-700 mt-0.5">{type.description || 'Sin descripcion'}</p>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Tipo</label>
              <p className="mt-0.5">
                <Badge variant={type.is_system ? 'secondary' : 'default'} className="text-xs">
                  {type.is_system ? 'Sistema' : 'Personalizado'}
                </Badge>
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Estado</label>
              <p className="mt-0.5">
                <Badge variant={type.active ? 'success' : 'secondary'} className="text-xs">
                  {type.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Uso</label>
              <p className="text-sm mt-0.5">
                {type.in_use ? `${type.usage_count} plantilla(s)` : 'Sin usar'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end p-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function TypeRow({ type, onEdit, onToggle, onDelete, onView }) {
  const isSystem = type.is_system

  return (
    <tr className={`${!type.active ? 'opacity-50 bg-gray-50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isSystem && <Lock className="w-3 h-3 text-gray-400" />}
          <UserCheck className="w-4 h-4 text-primary-500" />
          <span className="font-medium">{type.name}</span>
        </div>
        {type.description && (
          <p className="text-xs text-gray-500 mt-0.5 ml-6">{type.description}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <code className="px-2 py-1 bg-gray-100 rounded text-xs">{type.code}</code>
      </td>
      <td className="px-4 py-3">
        <Badge variant={isSystem ? 'secondary' : 'default'} className="text-xs">
          {isSystem ? 'Sistema' : 'Personalizado'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {type.in_use ? (
          <span className="text-sm text-gray-600">{type.usage_count} plantilla(s)</span>
        ) : (
          <span className="text-sm text-gray-400">Sin usar</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(type)}
          className={`p-1 rounded ${type.active ? 'text-green-600' : 'text-gray-400'}`}
          title={type.active ? 'Desactivar' : 'Activar'}
        >
          {type.active ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(type)}
            className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(type)}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(type)}
            className={`p-1.5 rounded ${type.in_use ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-red-50 text-red-500'}`}
            title={type.in_use ? 'No se puede eliminar (en uso)' : 'Eliminar'}
            disabled={type.in_use}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function SignatoryTypes() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [viewingType, setViewingType] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: typesData, isLoading } = useQuery({
    queryKey: ['signatory-types', { type: typeFilter }],
    queryFn: () => signatoryTypeService.list({
      type: typeFilter || undefined
    })
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => signatoryTypeService.toggleActive(id),
    onSuccess: () => queryClient.invalidateQueries(['signatory-types'])
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => signatoryTypeService.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['signatory-types']),
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  })

  const seedMutation = useMutation({
    mutationFn: () => signatoryTypeService.seedSystem(),
    onSuccess: () => {
      queryClient.invalidateQueries(['signatory-types'])
    }
  })

  const handleView = (type) => {
    setViewingType(type)
  }

  const handleEdit = (type) => {
    setEditingType(type)
    setShowModal(true)
  }

  const handleToggle = (type) => {
    toggleMutation.mutate(type.id)
  }

  const handleDelete = (type) => {
    if (type.in_use) {
      alert(`No se puede eliminar este tipo porque esta siendo usado en ${type.usage_count} plantilla(s)`)
      return
    }
    if (confirm(`¿Esta seguro de eliminar el tipo de firmante "${type.name}"?`)) {
      deleteMutation.mutate(type.id)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingType(null)
  }

  const types = typesData?.data?.data || []
  const meta = typesData?.data?.meta || {}

  // Filter by search
  const filteredTypes = searchQuery
    ? types.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : types

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tipos de Firmante</h1>
          <p className="text-gray-500">Gestiona los tipos de firmante disponibles para plantillas</p>
        </div>
        <div className="flex gap-2">
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
            Nuevo Tipo
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
                  placeholder="Buscar tipos de firmante..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos los tipos</option>
              <option value="system">Sistema</option>
              <option value="custom">Personalizados</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Types Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay tipos de firmante
              </h3>
              <p className="text-gray-500 mb-4">
                {types.length === 0
                  ? 'Inicializa los tipos del sistema o crea uno personalizado'
                  : 'No se encontraron tipos con los filtros aplicados'
                }
              </p>
              {types.length === 0 && (
                <Button onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
                  <Database className="w-4 h-4" />
                  Inicializar Tipos del Sistema
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Codigo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Uso
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTypes.map((type) => (
                    <TypeRow
                      key={type.id}
                      type={type}
                      onView={handleView}
                      onEdit={handleEdit}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {meta.total > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Mostrando {filteredTypes.length} de {meta.total} tipos de firmante
        </div>
      )}

      {/* Edit/Create Modal */}
      <TypeModal
        type={editingType}
        isOpen={showModal}
        onClose={handleCloseModal}
      />

      {/* Detail Modal */}
      <DetailModal
        type={viewingType}
        isOpen={!!viewingType}
        onClose={() => setViewingType(null)}
      />
    </div>
  )
}
