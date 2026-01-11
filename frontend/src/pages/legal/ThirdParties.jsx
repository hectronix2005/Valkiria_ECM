import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { thirdPartyService, thirdPartyTypeService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import {
  Plus,
  Search,
  Building2,
  User,
  MoreVertical,
  Edit,
  Edit2,
  Trash2,
  Ban,
  CheckCircle,
  XCircle,
  Settings,
  ToggleLeft,
  ToggleRight,
  Lock,
  Truck,
  Users,
  Briefcase,
  Handshake,
  X
} from 'lucide-react'

const PERSON_TYPES = [
  { value: 'juridical', label: 'Persona Jurídica' },
  { value: 'natural', label: 'Persona Natural' },
]

const ID_TYPES = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
]

const STATUS_COLORS = {
  active: 'green',
  inactive: 'gray',
  blocked: 'red',
}

// Third Party Types Management
const TYPE_COLORS = [
  { value: 'gray', label: 'Gris' },
  { value: 'blue', label: 'Azul' },
  { value: 'green', label: 'Verde' },
  { value: 'purple', label: 'Morado' },
  { value: 'orange', label: 'Naranja' },
  { value: 'red', label: 'Rojo' },
  { value: 'yellow', label: 'Amarillo' },
  { value: 'indigo', label: 'Indigo' },
]

const TYPE_ICONS = [
  { value: 'building', label: 'Edificio', Icon: Building2 },
  { value: 'truck', label: 'Camion', Icon: Truck },
  { value: 'users', label: 'Usuarios', Icon: Users },
  { value: 'briefcase', label: 'Maletin', Icon: Briefcase },
  { value: 'handshake', label: 'Alianza', Icon: Handshake },
]

const getTypeIconComponent = (iconName) => {
  const found = TYPE_ICONS.find(i => i.value === iconName)
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

  const IconComponent = getTypeIconComponent(formData.icon)

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
          options={TYPE_COLORS}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Icono</label>
          <div className="flex gap-2">
            {TYPE_ICONS.map(({ value, label, Icon }) => (
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

function ThirdPartyTypesPanel({ isOpen, onClose }) {
  const [search, setSearch] = useState('')
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType] = useState(null)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['third-party-types'],
    queryFn: () => thirdPartyTypeService.list(),
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: (data) => thirdPartyTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-party-types'])
      setShowTypeModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => thirdPartyTypeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-party-types'])
      setShowTypeModal(false)
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
    setShowTypeModal(true)
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tipos de Terceros</h2>
            <p className="text-sm text-gray-500">Gestiona las categorias de terceros</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { setEditingType(null); setShowTypeModal(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo Tipo
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {search ? 'No se encontraron tipos' : 'No hay tipos de terceros'}
              </h3>
              <p className="text-gray-500 mb-4">
                {search ? 'Intenta con otros terminos' : 'Crea tu primer tipo de tercero'}
              </p>
              {!search && (
                <Button onClick={() => setShowTypeModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Tipo
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTypes.map((type) => {
                const IconComponent = getTypeIconComponent(type.icon)
                return (
                  <div
                    key={type.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
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
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {type.third_parties_count || 0} terceros
                      </span>
                      <button
                        onClick={() => toggleMutation.mutate(type.id)}
                        className={`p-1 rounded transition-colors ${
                          type.active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-200'
                        }`}
                        title={type.active ? 'Activo' : 'Inactivo'}
                      >
                        {type.active ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(type)}
                        className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {type.deletable && (
                        <button
                          onClick={() => handleDelete(type.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Type Form Modal */}
        <Modal
          isOpen={showTypeModal}
          onClose={() => { setShowTypeModal(false); setEditingType(null) }}
          title={editingType ? 'Editar Tipo de Tercero' : 'Nuevo Tipo de Tercero'}
        >
          <TypeForm
            type={editingType}
            onSubmit={handleSubmit}
            onCancel={() => { setShowTypeModal(false); setEditingType(null) }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </Modal>
      </div>
    </div>
  )
}

function ThirdPartyForm({ thirdParty, thirdPartyTypes, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(thirdParty || {
    third_party_type: 'provider',
    person_type: 'juridical',
    identification_type: 'NIT',
    identification_number: '',
    business_name: '',
    trade_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Colombia',
    legal_rep_name: '',
    legal_rep_id_number: '',
    legal_rep_email: '',
    bank_name: '',
    bank_account_type: '',
    bank_account_number: '',
    notes: '',
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const isJuridical = formData.person_type === 'juridical'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo de Tercero"
          value={formData.third_party_type}
          onChange={(e) => handleChange('third_party_type', e.target.value)}
          options={thirdPartyTypes.map(t => ({ value: t.code, label: t.name }))}
          required
        />
        <Select
          label="Tipo de Persona"
          value={formData.person_type}
          onChange={(e) => handleChange('person_type', e.target.value)}
          options={PERSON_TYPES}
          required
        />
      </div>

      {/* Identification */}
      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Tipo Documento"
          value={formData.identification_type}
          onChange={(e) => handleChange('identification_type', e.target.value)}
          options={ID_TYPES}
          required
        />
        <Input
          label="Número Documento"
          value={formData.identification_number}
          onChange={(e) => handleChange('identification_number', e.target.value)}
          required
        />
        {formData.identification_type === 'NIT' && (
          <Input
            label="Dígito Verificación"
            value={formData.verification_digit || ''}
            onChange={(e) => handleChange('verification_digit', e.target.value)}
            maxLength={1}
          />
        )}
      </div>

      {/* Name based on person type */}
      {isJuridical ? (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Razón Social"
            value={formData.business_name}
            onChange={(e) => handleChange('business_name', e.target.value)}
            required
          />
          <Input
            label="Nombre Comercial"
            value={formData.trade_name || ''}
            onChange={(e) => handleChange('trade_name', e.target.value)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombres"
            value={formData.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            required
          />
          <Input
            label="Apellidos"
            value={formData.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            required
          />
        </div>
      )}

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          required
        />
        <Input
          label="Teléfono"
          value={formData.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value)}
        />
      </div>

      {/* Address */}
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Dirección"
          value={formData.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
          className="col-span-2"
        />
        <Input
          label="Ciudad"
          value={formData.city || ''}
          onChange={(e) => handleChange('city', e.target.value)}
        />
      </div>

      {/* Legal Representative (for juridical) */}
      {isJuridical && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-3">Representante Legal</h4>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Nombre Completo"
              value={formData.legal_rep_name || ''}
              onChange={(e) => handleChange('legal_rep_name', e.target.value)}
            />
            <Input
              label="Documento"
              value={formData.legal_rep_id_number || ''}
              onChange={(e) => handleChange('legal_rep_id_number', e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={formData.legal_rep_email || ''}
              onChange={(e) => handleChange('legal_rep_email', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Banking */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-700 mb-3">Información Bancaria</h4>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Banco"
            value={formData.bank_name || ''}
            onChange={(e) => handleChange('bank_name', e.target.value)}
          />
          <Select
            label="Tipo de Cuenta"
            value={formData.bank_account_type || ''}
            onChange={(e) => handleChange('bank_account_type', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'savings', label: 'Ahorros' },
              { value: 'checking', label: 'Corriente' },
            ]}
          />
          <Input
            label="Número de Cuenta"
            value={formData.bank_account_number || ''}
            onChange={(e) => handleChange('bank_account_number', e.target.value)}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading}>
          {thirdParty ? 'Actualizar' : 'Crear'} Tercero
        </Button>
      </div>
    </form>
  )
}

function ThirdPartyRow({ thirdParty, onEdit, onDelete, onStatusChange }) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {thirdParty.person_type === 'juridical' ? (
            <Building2 className="h-4 w-4 text-blue-600" />
          ) : (
            <User className="h-4 w-4 text-purple-600" />
          )}
          <span className="text-sm font-medium text-gray-600">{thirdParty.code}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{thirdParty.display_name}</div>
        {thirdParty.trade_name && thirdParty.trade_name !== thirdParty.business_name && (
          <div className="text-xs text-gray-500">{thirdParty.trade_name}</div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-600">{thirdParty.type_label}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-600">{thirdParty.full_identification}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-600">{thirdParty.email}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge status={STATUS_COLORS[thirdParty.status]}>
          {thirdParty.status_label}
        </Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span className="text-sm font-medium text-gray-900">{thirdParty.contracts_count}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="relative inline-block">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-20">
                <button
                  onClick={() => { onEdit(thirdParty); setShowMenu(false) }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" /> Editar
                </button>
                {thirdParty.status === 'active' && (
                  <button
                    onClick={() => { onStatusChange(thirdParty.id, 'deactivate'); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-yellow-600"
                  >
                    <XCircle className="h-4 w-4" /> Desactivar
                  </button>
                )}
                {thirdParty.status === 'inactive' && (
                  <button
                    onClick={() => { onStatusChange(thirdParty.id, 'activate'); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                  >
                    <CheckCircle className="h-4 w-4" /> Activar
                  </button>
                )}
                {thirdParty.status !== 'blocked' && (
                  <button
                    onClick={() => { onStatusChange(thirdParty.id, 'block'); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                  >
                    <Ban className="h-4 w-4" /> Bloquear
                  </button>
                )}
                {thirdParty.contracts_count === 0 && (
                  <button
                    onClick={() => { onDelete(thirdParty.id); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function ThirdParties() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingThirdParty, setEditingThirdParty] = useState(null)
  const [showTypesPanel, setShowTypesPanel] = useState(false)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['third-parties', search, typeFilter, statusFilter],
    queryFn: () => thirdPartyService.list({
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  })

  const { data: thirdPartyTypesData } = useQuery({
    queryKey: ['third-party-types'],
    queryFn: () => thirdPartyTypeService.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => thirdPartyService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-parties'])
      setShowModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => thirdPartyService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-parties'])
      setShowModal(false)
      setEditingThirdParty(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => thirdPartyService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['third-parties'])
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, action }) => {
      if (action === 'activate') return thirdPartyService.activate(id)
      if (action === 'deactivate') return thirdPartyService.deactivate(id)
      if (action === 'block') return thirdPartyService.block(id, 'Bloqueado por usuario')
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['third-parties'])
    },
  })

  const thirdParties = data?.data?.data || []
  const thirdPartyTypes = thirdPartyTypesData?.data?.data || []

  const handleEdit = (tp) => {
    setEditingThirdParty(tp)
    setShowModal(true)
  }

  const handleSubmit = (formData) => {
    if (editingThirdParty) {
      updateMutation.mutate({ id: editingThirdParty.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terceros</h1>
          <p className="text-gray-500">Proveedores, clientes, contratistas y aliados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowTypesPanel(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Tipos
          </Button>
          <Button onClick={() => { setEditingThirdParty(null); setShowModal(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Tercero
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, documento, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[{ value: '', label: 'Todos los tipos' }, ...thirdPartyTypes.map(t => ({ value: t.code, label: t.name }))]}
              className="w-48"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'active', label: 'Activo' },
                { value: 'inactive', label: 'Inactivo' },
                { value: 'blocked', label: 'Bloqueado' },
              ]}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identificación</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="h-6 bg-gray-200 rounded"></div>
                    </td>
                  </tr>
                ))
              ) : thirdParties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay terceros</h3>
                    <p className="text-gray-500 mb-4">Comienza agregando tu primer tercero</p>
                    <Button onClick={() => setShowModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Tercero
                    </Button>
                  </td>
                </tr>
              ) : (
                thirdParties.map((tp) => (
                  <ThirdPartyRow
                    key={tp.id}
                    thirdParty={tp}
                    onEdit={handleEdit}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onStatusChange={(id, action) => statusMutation.mutate({ id, action })}
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
        onClose={() => { setShowModal(false); setEditingThirdParty(null) }}
        title={editingThirdParty ? 'Editar Tercero' : 'Nuevo Tercero'}
        size="xl"
      >
        <ThirdPartyForm
          thirdParty={editingThirdParty}
          thirdPartyTypes={thirdPartyTypes}
          onSubmit={handleSubmit}
          onCancel={() => { setShowModal(false); setEditingThirdParty(null) }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      {/* Types Management Panel */}
      <ThirdPartyTypesPanel
        isOpen={showTypesPanel}
        onClose={() => setShowTypesPanel(false)}
      />
    </div>
  )
}
