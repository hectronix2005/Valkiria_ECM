import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { thirdPartyService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Building2, User, MoreVertical, Edit, Trash2, Ban, CheckCircle, XCircle } from 'lucide-react'

const THIRD_PARTY_TYPES = [
  { value: 'provider', label: 'Proveedor' },
  { value: 'client', label: 'Cliente' },
  { value: 'contractor', label: 'Contratista' },
  { value: 'partner', label: 'Aliado' },
  { value: 'other', label: 'Otro' },
]

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

function ThirdPartyForm({ thirdParty, onSubmit, onCancel, isLoading }) {
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
          options={THIRD_PARTY_TYPES}
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

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['third-parties', search, typeFilter, statusFilter],
    queryFn: () => thirdPartyService.list({
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
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
        <Button onClick={() => { setEditingThirdParty(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tercero
        </Button>
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
              options={[{ value: '', label: 'Todos los tipos' }, ...THIRD_PARTY_TYPES]}
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
          onSubmit={handleSubmit}
          onCancel={() => { setShowModal(false); setEditingThirdParty(null) }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  )
}
