import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { generatedDocumentService, variableMappingService, signatureService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import {
  FileText,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  PenTool,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  AlertCircle,
  AlertTriangle,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Briefcase,
  Users,
  FileCheck,
  Filter,
  Variable,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Save,
  RefreshCw,
  Lock,
  Database,
  Wand2,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Link2
} from 'lucide-react'

const statusConfig = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending_signatures: { label: 'Pendiente de firmas', color: 'bg-amber-100 text-amber-700', icon: PenTool },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle }
}

const templateCategories = {
  contract: 'Contrato',
  employee_contract: 'Contrato Laboral',
  certification: 'Certificacion',
  vacation: 'Vacaciones',
  employee: 'Empleado',
  other: 'Otro'
}

const categoryColors = {
  contract: 'bg-blue-100 text-blue-700',
  employee_contract: 'bg-indigo-100 text-indigo-700',
  certification: 'bg-purple-100 text-purple-700',
  vacation: 'bg-green-100 text-green-700',
  employee: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700'
}

// Variable Mapping Constants
const VARIABLE_CATEGORIES = {
  employee: 'Empleado',
  organization: 'Organización',
  request: 'Solicitud',
  system: 'Sistema',
  custom: 'Personalizado'
}

const HR_CATEGORIES = ['employee', 'organization', 'request', 'system', 'custom']

const DATA_TYPES = [
  { value: 'string', label: 'Texto' },
  { value: 'date', label: 'Fecha' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'email', label: 'Email' }
]

const FORMAT_PATTERNS = [
  { value: '', label: 'Sin formato', example: '1234567' },
  { value: 'currency_cop', label: 'Moneda (COP)', example: '$1.234.567' },
  { value: 'currency_usd', label: 'Moneda (USD)', example: '$1,234.56' },
  { value: 'date_short', label: 'Fecha corta', example: '15/01/2024' },
  { value: 'date_long', label: 'Fecha larga', example: '15 de enero de 2024' },
  { value: 'text_upper', label: 'Mayúsculas', example: 'JUAN PÉREZ' },
  { value: 'text_title', label: 'Título', example: 'Juan Pérez' }
]

// Variable Mapping Modal Component
function MappingFormModal({ mapping, isOpen, onClose, onSuccess }) {
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
      const { key, ...updateData } = formData
      updateMutation.mutate(updateData)
    } else {
      createMutation.mutate(formData)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar Variable' : 'Nueva Variable'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="Ej: Salario Mensual"
          required
        />
        {!isEdit && (
          <Input
            label="Clave"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            placeholder="Ej: custom.salario_mensual"
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(VARIABLE_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Dato</label>
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
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Descripción de la variable..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
          <select
            value={formData.format_pattern || ''}
            onChange={(e) => setFormData({ ...formData, format_pattern: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {FORMAT_PATTERNS.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.label} {fmt.example && `(${fmt.example})`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            <Save className="w-4 h-4" />
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Variables Panel Component
function VariablesPanel({ isOpen, onClose }) {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ['variable-mappings'],
    queryFn: () => variableMappingService.list(),
    enabled: isOpen
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
    onSuccess: () => queryClient.invalidateQueries(['variable-mappings'])
  })

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setShowMappingModal(true)
  }

  const handleDelete = (mapping) => {
    if (confirm(`¿Eliminar "${mapping.name}"?`)) {
      deleteMutation.mutate(mapping.id)
    }
  }

  const allMappings = mappingsData?.data?.data || []
  const hrMappings = allMappings.filter(m => HR_CATEGORIES.includes(m.category))

  const filteredMappings = hrMappings.filter(m => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!m.name.toLowerCase().includes(q) && !m.key.toLowerCase().includes(q)) return false
    }
    if (categoryFilter && m.category !== categoryFilter) return false
    return true
  })

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Variables de HR" size="full">
      <div className="space-y-4">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas las categorías</option>
              {Object.entries(VARIABLE_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => seedMutation.mutate()}
              loading={seedMutation.isPending}
            >
              <Database className="w-4 h-4" />
              Inicializar
            </Button>
            <Button size="sm" onClick={() => { setEditingMapping(null); setShowMappingModal(true) }}>
              <Plus className="w-4 h-4" />
              Nueva Variable
            </Button>
          </div>
        </div>

        {/* Variables Table */}
        <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-12">
              <Variable className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay variables</h3>
              <p className="text-gray-500 mb-4">
                {hrMappings.length === 0 ? 'Inicializa las variables del sistema' : 'No se encontraron variables con los filtros aplicados'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clave</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMappings.map((mapping) => (
                  <tr key={mapping.id} className={`${!mapping.active ? 'opacity-50 bg-gray-50' : ''}`}>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{mapping.key}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {mapping.is_system && <Lock className="w-3 h-3 text-gray-400" />}
                        <span className="font-medium text-sm">{mapping.name}</span>
                      </div>
                      {mapping.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{mapping.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {VARIABLE_CATEGORIES[mapping.category] || mapping.category}
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
                        className={`p-1 rounded ${mapping.active ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {mapping.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(mapping)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(isAdmin || !mapping.is_system) && (
                          <button
                            onClick={() => handleDelete(mapping)}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <span className="text-sm text-gray-500">
            {filteredMappings.length} de {hrMappings.length} variables
          </span>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>

      {/* Nested Mapping Modal */}
      <MappingFormModal
        mapping={editingMapping}
        isOpen={showMappingModal}
        onClose={() => { setShowMappingModal(false); setEditingMapping(null) }}
      />
    </Modal>
  )
}

export default function HRDocuments() {
  const { isAdmin, isHR } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVariablesPanel, setShowVariablesPanel] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showNoSignatureModal, setShowNoSignatureModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  // Fetch HR documents (filtered by module=hr)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr-documents', page, statusFilter, categoryFilter, searchQuery],
    queryFn: () => generatedDocumentService.list({
      page,
      per_page: 20,
      module: 'hr',
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      q: searchQuery || undefined
    })
  })

  // Fetch user's digital signatures
  const { data: signaturesData } = useQuery({
    queryKey: ['signatures'],
    queryFn: () => signatureService.list()
  })

  const hasActiveSignature = () => {
    const signatures = signaturesData?.data?.data || []
    return signatures.some(sig => sig.active)
  }

  const deleteMutation = useMutation({
    mutationFn: (id) => generatedDocumentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['hr-documents'])
      setShowDeleteConfirm(false)
      setDocumentToDelete(null)
      setShowDetailModal(false)
      setSelectedDocument(null)
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al eliminar el documento')
    }
  })

  const signMutation = useMutation({
    mutationFn: (id) => generatedDocumentService.sign(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['hr-documents'])
      if (selectedDocument) {
        // Refresh the selected document
        generatedDocumentService.get(selectedDocument.id).then(res => {
          setSelectedDocument(res.data.data)
        })
      }
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al firmar el documento')
    }
  })

  const documentsRaw = data?.data?.data || []
  const meta = data?.data?.meta || {}
  const totalPages = meta.total_pages || 1

  // Sort documents locally (backend already filters)
  const documents = [...documentsRaw].sort((a, b) => {
    let aVal, bVal
    switch (sortColumn) {
      case 'employee_name':
        aVal = (a.employee_name || a.requested_by || '').toLowerCase()
        bVal = (b.employee_name || b.requested_by || '').toLowerCase()
        break
      case 'template_name':
        aVal = (a.template_name || '').toLowerCase()
        bVal = (b.template_name || '').toLowerCase()
        break
      case 'template_category':
        aVal = templateCategories[a.template_category] || a.template_category || ''
        bVal = templateCategories[b.template_category] || b.template_category || ''
        break
      case 'status':
        aVal = statusConfig[a.status]?.label || a.status || ''
        bVal = statusConfig[b.status]?.label || b.status || ''
        break
      case 'created_at':
      default:
        aVal = a.created_at ? new Date(a.created_at).getTime() : 0
        bVal = b.created_at ? new Date(b.created_at).getTime() : 0
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setCategoryFilter('')
    setPage(1)
  }

  const hasFilters = searchQuery || statusFilter || categoryFilter

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />
  }

  const handleView = async (document) => {
    try {
      const response = await generatedDocumentService.get(document.id)
      setSelectedDocument(response.data.data)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading document details:', error)
      setSelectedDocument(document)
      setShowDetailModal(true)
    }
  }

  const handleDeleteClick = (document) => {
    setDocumentToDelete(document)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    if (documentToDelete) {
      deleteMutation.mutate(documentToDelete.id)
    }
  }

  const handleSign = (document) => {
    // First check if user has a digital signature configured
    if (!document.user_has_digital_signature && !hasActiveSignature()) {
      setShowNoSignatureModal(true)
      return
    }
    // If blocked by sequential signing, show alert with waiting info
    if (!document.can_sign && document.has_pending_signature) {
      const userSig = document.signatures?.find(s => s.status === 'pending' && s.waiting_for?.length > 0)
      if (userSig?.waiting_for?.length > 0) {
        alert(`Debes esperar las firmas de: ${userSig.waiting_for.join(', ')}`)
        return
      }
    }
    signMutation.mutate(document.id)
  }

  const handleDownload = async (document) => {
    try {
      setDownloading(document.id)
      const response = await generatedDocumentService.download(document.id)

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.file_name || `${document.name}.pdf`
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error al descargar el documento')
      console.error('Download error:', error)
    } finally {
      setDownloading(null)
    }
  }

  const handlePreview = (document) => {
    setPreviewDocument(document)
    setShowPreviewModal(true)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Stats cards
  const stats = {
    total: documentsRaw.length,
    pending: documentsRaw.filter(d => d.status === 'pending_signatures').length,
    completed: documentsRaw.filter(d => d.status === 'completed').length,
    draft: documentsRaw.filter(d => d.status === 'draft').length
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documentacion HR</h1>
            <p className="text-gray-500 mt-1">Documentos generados por Recursos Humanos</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Documentacion HR</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-600">Error al cargar los documentos</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentacion HR</h1>
          <p className="text-gray-500 mt-1">Documentos generados por Recursos Humanos</p>
        </div>
        {(isAdmin || isHR) && (
          <Button variant="secondary" onClick={() => setShowVariablesPanel(true)}>
            <Variable className="w-4 h-4" />
            Variables
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{meta.total_count || stats.total}</p>
                <p className="text-sm text-gray-500">Total documentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <PenTool className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pendientes de firma</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                <p className="text-sm text-gray-500">Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
                <p className="text-sm text-gray-500">Borradores</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por empleado, documento..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="pending_signatures">Pendiente de firmas</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tipo de documento</option>
              <option value="employee_contract">Contrato Laboral</option>
              <option value="certification">Certificacion</option>
              <option value="vacation">Vacaciones</option>
              <option value="employee">Empleado</option>
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Limpiar
              </button>
            )}
          </div>
          {!isLoading && (
            <div className="mt-3 text-sm text-gray-500">
              Mostrando <strong>{documents.length}</strong> de <strong>{meta.total_count || 0}</strong> documentos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay documentos</h3>
              <p className="text-gray-500">
                {hasFilters ? 'No se encontraron documentos con los filtros aplicados' : 'Los documentos generados por HR apareceran aqui'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th
                      onClick={() => handleSort('employee_name')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Empleado
                        <SortIcon column="employee_name" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('template_name')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Documento
                        <SortIcon column="template_name" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('template_category')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Tipo
                        <SortIcon column="template_category" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('created_at')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Fecha
                        <SortIcon column="created_at" />
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {documents.map((doc) => {
                    const status = statusConfig[doc.status] || statusConfig.draft
                    const StatusIcon = status.icon
                    const catColor = categoryColors[doc.template_category] || categoryColors.other

                    return (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-primary-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {doc.employee_name || doc.requested_by || '-'}
                              </p>
                              {doc.employee_number && (
                                <p className="text-xs text-gray-500">{doc.employee_number}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-900">{doc.name}</p>
                              {doc.template_name && (
                                <p className="text-xs text-gray-500">{doc.template_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${catColor}`}>
                            <Briefcase className="w-3 h-3" />
                            {templateCategories[doc.template_category] || doc.template_category || 'Otro'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(doc)}
                              title="Previsualizar"
                            >
                              <FileSearch className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(doc)}
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                              loading={downloading === doc.id}
                              title="Descargar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {(doc.can_sign || doc.has_pending_signature) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSign(doc)}
                                loading={signMutation.isPending}
                                title="Firmar documento"
                                className="text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                              >
                                <PenTool className="w-4 h-4" />
                              </Button>
                            )}
                            {(isAdmin || isHR) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(doc)}
                                title="Eliminar documento"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Pagina {page} de {totalPages} ({meta.total_count} documentos)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle del Documento"
        size="lg"
      >
        {selectedDocument && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedDocument.name}</h3>
                  {selectedDocument.template_name && (
                    <p className="text-sm text-gray-500">Template: {selectedDocument.template_name}</p>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig[selectedDocument.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                {statusConfig[selectedDocument.status]?.label || selectedDocument.status}
              </span>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Empleado</p>
                <p className="text-sm font-medium">{selectedDocument.employee_name || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Creado</p>
                <p className="text-sm font-medium">{formatDate(selectedDocument.created_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Tipo</p>
                <p className="text-sm font-medium">
                  {templateCategories[selectedDocument.template_category] || selectedDocument.template_category || 'Otro'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Solicitado por</p>
                <p className="text-sm font-medium">{selectedDocument.requested_by || '-'}</p>
              </div>
            </div>

            {/* Signatures */}
            {selectedDocument.signatures && selectedDocument.signatures.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Firmas</h4>
                  {selectedDocument.sequential_signing && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <ArrowDown className="w-3 h-3" />
                      Firma secuencial
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {selectedDocument.signatures.map((sig, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${
                      sig.status === 'signed' ? 'bg-green-50' :
                      sig.can_sign_now === false ? 'bg-gray-100 opacity-60' : 'bg-amber-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center font-medium">
                            {idx + 1}
                          </span>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            sig.status === 'signed' ? 'bg-green-100' :
                            sig.can_sign_now === false ? 'bg-gray-200' : 'bg-amber-100'
                          }`}>
                            {sig.status === 'signed' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : sig.can_sign_now === false ? (
                              <Lock className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-600" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sig.signatory_label}</p>
                          <p className="text-xs text-gray-500">
                            {sig.status === 'signed'
                              ? `Firmado por ${sig.signed_by_name} - ${formatDate(sig.signed_at)}`
                              : sig.can_sign_now === false && sig.waiting_for?.length > 0
                              ? `Esperando: ${sig.waiting_for.join(', ')}`
                              : sig.user_name || 'Pendiente'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sig.required && (
                          <Badge variant="secondary" size="sm">Requerida</Badge>
                        )}
                        {sig.status !== 'signed' && sig.can_sign_now === false && (
                          <Badge variant="secondary" size="sm" className="bg-gray-200 text-gray-600">
                            Bloqueada
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  Progreso: {selectedDocument.completed_signatures_count || 0} de {selectedDocument.total_required_signatures || 0} firmas
                  {selectedDocument.next_signatory && (
                    <span className="ml-2 text-primary-600">
                      • Siguiente: {selectedDocument.next_signatory}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <div className="flex gap-2">
                {(isAdmin || isHR) && (
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteClick(selectedDocument)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </Button>
                )}
                {(selectedDocument.can_sign || selectedDocument.has_pending_signature) && (
                  <Button
                    variant="primary"
                    onClick={() => handleSign(selectedDocument)}
                    loading={signMutation.isPending}
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                  Cerrar
                </Button>
                {selectedDocument.can_download && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowDetailModal(false)
                        handlePreview(selectedDocument)
                      }}
                    >
                      <FileSearch className="w-4 h-4" />
                      Previsualizar
                    </Button>
                    <Button onClick={() => handleDownload(selectedDocument)} loading={downloading === selectedDocument.id}>
                      <Download className="w-4 h-4" />
                      Descargar PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDocumentToDelete(null) }}
        title="Confirmar eliminacion"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
            <Trash2 className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-700">
                Esta seguro que desea eliminar el documento:
              </p>
              <p className="font-medium text-gray-900 mt-1">
                {documentToDelete?.name}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Esta accion no se puede deshacer. El archivo PDF sera eliminado permanentemente.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => { setShowDeleteConfirm(false); setDocumentToDelete(null) }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Variables Panel */}
      <VariablesPanel
        isOpen={showVariablesPanel}
        onClose={() => setShowVariablesPanel(false)}
      />

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => { setShowPreviewModal(false); setPreviewDocument(null) }}
        title={previewDocument?.name || 'Previsualización'}
        size="full"
      >
        {previewDocument && (
          <div className="h-[calc(100vh-200px)]">
            <iframe
              src={`/api/v1/documents/${previewDocument.id}/preview`}
              className="w-full h-full border-0 rounded-lg"
              title="Vista previa del documento"
            />
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                {previewDocument.template_name && (
                  <span>Template: {previewDocument.template_name}</span>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => { setShowPreviewModal(false); setPreviewDocument(null) }}
                >
                  Cerrar
                </Button>
                <Button onClick={() => handleDownload(previewDocument)} loading={downloading === previewDocument.id}>
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* No Signature Modal */}
      <Modal
        isOpen={showNoSignatureModal}
        onClose={() => setShowNoSignatureModal(false)}
        title="Firma Digital Requerida"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">
                No tienes una firma digital configurada
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Para firmar documentos necesitas crear tu firma digital primero.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Ve a tu perfil para crear tu firma digital. Puedes dibujarla o usar una firma estilizada con tu nombre.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowNoSignatureModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setShowNoSignatureModal(false)
                navigate('/profile')
              }}
            >
              <PenTool className="w-4 h-4" />
              Ir a Crear Firma
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
