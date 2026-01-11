import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { thirdPartyTypeService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Lock,
  Building2,
  Truck,
  Users,
  Briefcase,
  Handshake,
  AlertCircle
} from 'lucide-react'

const COLORS = [
  { value: 'gray', label: 'Gris' },
  { value: 'blue', label: 'Azul' },
  { value: 'green', label: 'Verde' },
  { value: 'purple', label: 'Morado' },
  { value: 'orange', label: 'Naranja' },
  { value: 'red', label: 'Rojo' },
  { value: 'yellow', label: 'Amarillo' },
  { value: 'indigo', label: 'Indigo' },
]

const ICONS = [
  { value: 'building', label: 'Edificio', Icon: Building2 },
  { value: 'truck', label: 'Camion', Icon: Truck },
  { value: 'users', label: 'Usuarios', Icon: Users },
  { value: 'briefcase', label: 'Maletin', Icon: Briefcase },
  { value: 'handshake', label: 'Alianza', Icon: Handshake },
]

const getIconComponent = (iconName) => {
  const found = ICONS.find(i => i.value === iconName)
  return found?.Icon || Building2
}

function TypeForm({ type, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(type || {
    code: '',
    name: '',
    description: '',
    color: 'gray',
    icon: 'building',
    active: true,
  })
  const [errors, setErrors] = useState({})

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.code?.trim()) newErrors.code = 'Codigo requerido'
    if (!formData.name?.trim()) newErrors.name = 'Nombre requerido'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  const IconComponent = getIconComponent(formData.icon)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Codigo"
          value={formData.code}
          onChange={(e) => handleChange('code', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
          placeholder="ej: provider"
          error={errors.code}
          disabled={!!type?.is_system}
          required
        />
        <Input
          label="Nombre"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="ej: Proveedor"
          error={errors.name}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
          placeholder="Descripcion del tipo de tercero..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Color"
          value={formData.color}
          onChange={(e) => handleChange('color', e.target.value)}
          options={COLORS}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Icono</label>
          <div className="flex gap-2">
            {ICONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleChange('icon', value)}
                className={`p-2 rounded-lg border-2 transition-all ${
                  formData.icon === value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={label}
              >
                <Icon className={`h-5 w-5 ${formData.icon === value ? 'text-indigo-600' : 'text-gray-500'}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Vista previa</p>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${formData.color}-100`}>
            <IconComponent className={`h-5 w-5 text-${formData.color}-600`} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{formData.name || 'Nombre del tipo'}</p>
            <p className="text-sm text-gray-500">{formData.code || 'codigo'}</p>
          </div>
          <Badge status={formData.color}>{formData.name || 'Tipo'}</Badge>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading}>
          {type ? 'Actualizar' : 'Crear'} Tipo
        </Button>
      </div>
    </form>
  )
}

function TypeRow({ type, onEdit, onToggle, onDelete }) {
  const IconComponent = getIconComponent(type.icon)

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${type.color}-100`}>
            <IconComponent className={`h-5 w-5 text-${type.color}-600`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{type.name}</p>
              {type.is_system && (
                <Lock className="h-3 w-3 text-gray-400" title="Tipo del sistema" />
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono">{type.code}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-600 max-w-[300px] truncate" title={type.description}>
          {type.description || '-'}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge status={type.color}>{type.name}</Badge>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-gray-900">{type.third_parties_count}</span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(type.id)}
          className={`p-1 rounded transition-colors ${
            type.active
              ? 'text-green-600 hover:bg-green-50'
              : 'text-gray-400 hover:bg-gray-100'
          }`}
          title={type.active ? 'Activo' : 'Inactivo'}
        >
          {type.active ? (
            <ToggleRight className="h-5 w-5" />
          ) : (
            <ToggleLeft className="h-5 w-5" />
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(type)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {type.deletable && (
            <button
              onClick={() => onDelete(type.id)}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function ThirdPartyTypes() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState(null)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['third-party-types'],
    queryFn: () => thirdPartyTypeService.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => thirdPartyTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-party-types'])
      setShowModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => thirdPartyTypeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-party-types'])
      setShowModal(false)
      setEditingType(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => thirdPartyTypeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-party-types'])
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => thirdPartyTypeService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-party-types'])
    },
  })

  const types = data?.data?.data || []

  const filteredTypes = types.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (type) => {
    setEditingType(type)
    setShowModal(true)
  }

  const handleSubmit = (formData) => {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (id) => {
    if (confirm('Estas seguro de eliminar este tipo de tercero?')) {
      deleteMutation.mutate(id)
    }
  }

  // Stats
  const stats = {
    total: types.length,
    active: types.filter(t => t.active).length,
    system: types.filter(t => t.is_system).length,
    totalThirdParties: types.reduce((sum, t) => sum + (t.third_parties_count || 0), 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tipos de Terceros</h1>
          <p className="text-gray-500">Gestiona las categorias de terceros (proveedores, clientes, etc.)</p>
        </div>
        <Button onClick={() => { setEditingType(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Building2 className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Tipos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ToggleRight className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-sm text-gray-500">Activos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Lock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.system}</p>
              <p className="text-sm text-gray-500">Del Sistema</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats.totalThirdParties}</p>
              <p className="text-sm text-gray-500">Terceros Totales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      {types.length === 0 && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Tipos de terceros no configurados</p>
              <p className="text-sm text-blue-700">
                Los tipos de terceros (Proveedor, Cliente, etc.) se crean automaticamente al iniciar el sistema.
                Si no aparecen, contacta al administrador.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o codigo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Descripcion
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Badge
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Terceros
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-100">
                    <td className="px-4 py-3"><div className="h-10 bg-gray-200 rounded w-48" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-64" /></td>
                    <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-8 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-8" /></td>
                    <td className="px-4 py-3"><div className="h-8 bg-gray-200 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {search ? 'No se encontraron tipos' : 'No hay tipos de terceros'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {search
                        ? 'Intenta con otros terminos de busqueda'
                        : 'Crea tu primer tipo de tercero'}
                    </p>
                    {!search && (
                      <Button onClick={() => setShowModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Tipo
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTypes.map((type) => (
                  <TypeRow
                    key={type.id}
                    type={type}
                    onEdit={handleEdit}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingType(null) }}
        title={editingType ? 'Editar Tipo de Tercero' : 'Nuevo Tipo de Tercero'}
      >
        <TypeForm
          type={editingType}
          onSubmit={handleSubmit}
          onCancel={() => { setShowModal(false); setEditingType(null) }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  )
}
