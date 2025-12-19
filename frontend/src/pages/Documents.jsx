import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { generatedDocumentService } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
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
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Briefcase
} from 'lucide-react'

const statusConfig = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending_signatures: { label: 'Pendiente de firmas', color: 'bg-amber-100 text-amber-700', icon: PenTool },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle }
}

const templateCategories = {
  contract: 'Contrato',
  certification: 'Certificación',
  vacation: 'Vacaciones',
  other: 'Otro'
}

export default function Documents() {
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('admin')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['generated-documents', page],
    queryFn: () => generatedDocumentService.list({ page, per_page: 20 })
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => generatedDocumentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['generated-documents'])
      setShowDeleteConfirm(false)
      setDocumentToDelete(null)
      setShowDetailModal(false)
      setSelectedDocument(null)
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al eliminar el documento')
    }
  })

  const documentsRaw = data?.data?.data || []
  const meta = data?.data?.meta || {}
  const totalPages = meta.total_pages || 1

  // Filter and sort documents
  const documents = documentsRaw
    .filter(doc => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchName = (doc.name || '').toLowerCase().includes(q)
        const matchEmployee = (doc.employee_name || doc.requested_by || '').toLowerCase().includes(q)
        const matchTemplate = (doc.template_name || '').toLowerCase().includes(q)
        if (!matchName && !matchEmployee && !matchTemplate) return false
      }
      if (statusFilter && doc.status !== statusFilter) return false
      if (categoryFilter && doc.template_category !== categoryFilter) return false
      return true
    })
    .sort((a, b) => {
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
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0
          break
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
  }

  const hasFilters = searchQuery || statusFilter || categoryFilter

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />
  }

  const handleView = (document) => {
    setSelectedDocument(document)
    setShowDetailModal(true)
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

  const handleDownload = async (document) => {
    try {
      setDownloading(document.id)
      const response = await generatedDocumentService.download(document.id)

      // Create blob and download
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Mis Documentos</h1>
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
          <h1 className="text-2xl font-bold text-gray-900">Mis Documentos</h1>
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
          <h1 className="text-2xl font-bold text-gray-900">Mis Documentos</h1>
          <p className="text-gray-500 mt-1">Documentos generados desde templates</p>
        </div>
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tipo de documento</option>
              <option value="contract">Contrato</option>
              <option value="certification">Certificación</option>
              <option value="vacation">Vacaciones</option>
              <option value="other">Otro</option>
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
          {!isLoading && documentsRaw.length > 0 && (
            <div className="mt-3 text-sm text-gray-500">
              Mostrando <strong>{documents.length}</strong> de <strong>{documentsRaw.length}</strong> documentos
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
                {hasFilters ? 'No se encontraron documentos con los filtros aplicados' : 'Los documentos generados desde templates apareceran aqui'}
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
                        Fecha Creación
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
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
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
                            {isAdmin && (
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
                <p className="text-xs text-gray-500">Creado</p>
                <p className="text-sm font-medium">{formatDate(selectedDocument.created_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Solicitado por</p>
                <p className="text-sm font-medium">{selectedDocument.requested_by || '-'}</p>
              </div>
              {selectedDocument.file_name && (
                <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                  <p className="text-xs text-gray-500">Archivo</p>
                  <p className="text-sm font-medium">{selectedDocument.file_name}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <div>
                {isAdmin && (
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteClick(selectedDocument)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                  Cerrar
                </Button>
                <Button onClick={() => handleDownload(selectedDocument)} loading={downloading === selectedDocument.id}>
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </Button>
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
    </div>
  )
}
