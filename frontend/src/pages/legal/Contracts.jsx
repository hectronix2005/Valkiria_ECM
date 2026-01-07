import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractService, thirdPartyService, templateService } from '../../services/api'
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
  AlertCircle, FileWarning
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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
  approved: { color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle, label: 'Aprobado' },
  rejected: { color: 'red', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Rechazado' },
  active: { color: 'green', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Activo' },
  expired: { color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle, label: 'Vencido' },
  terminated: { color: 'gray', bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle, label: 'Terminado' },
  cancelled: { color: 'gray', bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle, label: 'Cancelado' },
}

// Formulario de contrato (paso 2: después de seleccionar template)
function ContractForm({ template, thirdParties, onSubmit, onCancel, onBack, isLoading }) {
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
    template_id: template?.id || '',
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
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

      <Input
        label="Título del Contrato"
        value={formData.title}
        onChange={(e) => handleChange('title', e.target.value)}
        placeholder="Ej: Contrato de Servicios TI 2025"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo de Contrato"
          value={formData.contract_type}
          onChange={(e) => handleChange('contract_type', e.target.value)}
          options={CONTRACT_TYPES}
          required
        />
        <Select
          label="Tercero"
          value={formData.third_party_id}
          onChange={(e) => handleChange('third_party_id', e.target.value)}
          options={[
            { value: '', label: 'Seleccionar tercero...' },
            ...thirdParties.map(tp => ({ value: tp.id, label: `${tp.display_name} (${tp.code})` }))
          ]}
          required
        />
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

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Cambiar Template
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Contrato
          </Button>
        </div>
      </div>
    </form>
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
function ContractRow({ contract, onView, onEdit, onSubmit, onDownload, onGenerate, onDelete }) {
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
            <button
              onClick={() => onDownload(contract.id)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Descargar PDF"
            >
              <Download className="h-4 w-4" />
            </button>
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
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
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
                  {contract.status === 'draft' && (
                    <button
                      onClick={() => { onDelete(contract.id); setShowMenu(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
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

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', search, typeFilter, statusFilter],
    queryFn: () => contractService.list({
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  })

  const { data: thirdPartiesData } = useQuery({
    queryKey: ['third-parties-active'],
    queryFn: () => thirdPartyService.list({ status: 'active', per_page: 100 }),
  })

  const { data: templatesData } = useQuery({
    queryKey: ['templates-comercial'],
    queryFn: () => templateService.list({ main_category: 'comercial', status: 'active' }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => contractService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      handleCloseCreateModal()
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

  const contracts = data?.data?.data || []
  const thirdParties = thirdPartiesData?.data?.data || []
  const templates = templatesData?.data?.data || []

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

  const handleGenerateClick = (contract) => {
    setSelectedContract(contract)
    setGenerateTemplateId('')
    setShowGenerateModal(true)
  }

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar este contrato?')) {
      deleteMutation.mutate(id)
    }
  }

  // Estadísticas rápidas
  const stats = {
    total: contracts.length,
    pending: contracts.filter(c => c.status === 'pending_approval').length,
    active: contracts.filter(c => c.status === 'active').length,
    expiring: contracts.filter(c => c.expiring_soon).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-500">Gestión de contratos con aprobación multinivel</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} disabled={templates.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Contrato
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Contratos</p>
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
                    onView={(id) => navigate(`/legal/contracts/${id}`)}
                    onEdit={(c) => navigate(`/legal/contracts/${c.id}`)}
                    onSubmit={(id) => submitMutation.mutate(id)}
                    onDownload={handleDownload}
                    onGenerate={handleGenerateClick}
                    onDelete={handleDelete}
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
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={handleCloseCreateModal}
            onBack={() => setCreateStep(1)}
            isLoading={createMutation.isPending}
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
    </div>
  )
}
