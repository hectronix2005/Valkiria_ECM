import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalService, certificationService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { Calendar, Award, CheckCircle, XCircle, Eye, User, Clock, History, FileText, Download, Loader2 } from 'lucide-react'

function ApprovalCard({ request, type, onApprove, onReject, onView, showActions = true }) {
  const isVacation = type === 'vacation'
  const Icon = isVacation ? Calendar : Award

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${isVacation ? 'bg-blue-50' : 'bg-purple-50'}`}>
            <Icon className={`w-6 h-6 ${isVacation ? 'text-blue-600' : 'text-purple-600'}`} />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {request.employee?.name || 'Empleado'}
                </p>
                <p className="text-sm text-gray-500">
                  {request.employee?.department} • {request.employee?.job_title}
                </p>
              </div>
              <Badge status={request.status} />
            </div>

            <div className="mt-3 space-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Solicitud:</span> {request.request_number}
              </p>
              {isVacation ? (
                <>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Tipo:</span> {request.vacation_type}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Fechas:</span>{' '}
                    {new Date(request.start_date).toLocaleDateString('es-ES')} -{' '}
                    {new Date(request.end_date).toLocaleDateString('es-ES')}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-sm font-medium text-primary-600">
                      {Math.floor(request.days_requested)} días solicitados
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-green-600">{Math.floor(request.employee?.available_vacation_days || 0)}</span> días disponibles
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Tipo:</span> Certificación {request.certification_type}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Propósito:</span> {request.purpose}
                  </p>
                  <p className="text-sm text-gray-500">
                    Tiempo estimado: {request.estimated_days} días
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <Button variant="ghost" size="sm" onClick={() => onView(request, type)}>
                <Eye className="w-4 h-4" />
                Detalle
              </Button>
              {showActions && (
                <>
                  <div className="flex-1" />
                  <Button variant="danger" size="sm" onClick={() => onReject(request, type)}>
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </Button>
                  <Button variant="success" size="sm" onClick={() => onApprove(request, type)}>
                    <CheckCircle className="w-4 h-4" />
                    Aprobar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Approvals() {
  const [activeTab, setActiveTab] = useState('pending')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const queryClient = useQueryClient()

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalService.list({ status: 'pending' }),
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['approvals', 'history'],
    queryFn: () => approvalService.list({ status: 'history' }),
    enabled: activeTab === 'history',
  })

  const approveMutation = useMutation({
    mutationFn: ({ id }) => approvalService.approve(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      queryClient.invalidateQueries(['approvals-count'])
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => approvalService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      queryClient.invalidateQueries(['approvals-count'])
      setShowRejectModal(false)
      setRejectReason('')
    },
  })

  const generateDocMutation = useMutation({
    mutationFn: (id) => certificationService.generateDocument(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['approvals'])
      alert('Documento generado exitosamente')
      // Update selectedRequest with the new document_uuid
      if (response.data?.data?.certification) {
        setSelectedRequest(prev => ({
          ...prev,
          document_uuid: response.data.data.certification.document_uuid,
          status: response.data.data.certification.status
        }))
      }
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al generar documento')
    }
  })

  const handleDownloadDocument = async (certificationId) => {
    try {
      const response = await certificationService.downloadDocument(certificationId)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `certificacion-${certificationId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al descargar documento')
    }
  }

  const pendingApprovals = pendingData?.data?.data || { vacation_requests: [], certification_requests: [] }
  const historyApprovals = historyData?.data?.data || { vacation_requests: [], certification_requests: [] }

  const totalPending = (pendingApprovals.vacation_requests?.length || 0) + (pendingApprovals.certification_requests?.length || 0)
  const totalHistory = (historyApprovals.vacation_requests?.length || 0) + (historyApprovals.certification_requests?.length || 0)

  const handleApprove = (request, type) => {
    if (window.confirm('¿Estás seguro de aprobar esta solicitud?')) {
      approveMutation.mutate({ id: request.id, type })
    }
  }

  const handleReject = (request, type) => {
    setSelectedRequest(request)
    setSelectedType(type)
    setShowRejectModal(true)
  }

  const handleView = (request, type) => {
    setSelectedRequest(request)
    setSelectedType(type)
    setShowDetailModal(true)
  }

  const confirmReject = () => {
    if (!rejectReason.trim()) {
      alert('Debes proporcionar un motivo de rechazo')
      return
    }
    rejectMutation.mutate({ id: selectedRequest.id, reason: rejectReason })
  }

  const currentApprovals = activeTab === 'pending' ? pendingApprovals : historyApprovals
  const isLoading = activeTab === 'pending' ? pendingLoading : historyLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Aprobaciones</h1>
        <p className="text-gray-500">
          Administra las solicitudes de vacaciones y certificaciones
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pendientes
            {totalPending > 0 && (
              <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                {totalPending}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            Historial
            {activeTab === 'history' && totalHistory > 0 && (
              <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                {totalHistory}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Stats - Only show for pending tab */}
      {activeTab === 'pending' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 bg-yellow-50 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
                <p className="text-sm text-gray-500">Total Pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingApprovals.vacation_requests?.length || 0}</p>
                <p className="text-sm text-gray-500">Vacaciones</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 bg-purple-50 rounded-xl">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingApprovals.certification_requests?.length || 0}</p>
                <p className="text-sm text-gray-500">Certificaciones</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-24 bg-gray-100 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vacation Requests */}
      {!isLoading && currentApprovals.vacation_requests?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Solicitudes de Vacaciones
          </h2>
          <div className="space-y-4">
            {currentApprovals.vacation_requests.map((request) => (
              <ApprovalCard
                key={request.id}
                request={request}
                type="vacation"
                onApprove={handleApprove}
                onReject={handleReject}
                onView={handleView}
                showActions={activeTab === 'pending'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Certification Requests */}
      {!isLoading && currentApprovals.certification_requests?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Solicitudes de Certificación
          </h2>
          <div className="space-y-4">
            {currentApprovals.certification_requests.map((request) => (
              <ApprovalCard
                key={request.id}
                request={request}
                type="certification"
                onApprove={handleApprove}
                onReject={handleReject}
                onView={handleView}
                showActions={activeTab === 'pending'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading &&
       currentApprovals.vacation_requests?.length === 0 &&
       currentApprovals.certification_requests?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            {activeTab === 'pending' ? (
              <>
                <CheckCircle className="w-16 h-16 mx-auto text-green-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  ¡Todo al día!
                </h3>
                <p className="text-gray-500">
                  No tienes solicitudes pendientes de aprobación
                </p>
              </>
            ) : (
              <>
                <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Sin historial
                </h3>
                <p className="text-gray-500">
                  Aún no hay solicitudes procesadas
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Rechazar Solicitud"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Por favor, proporciona el motivo del rechazo para la solicitud{' '}
            <span className="font-medium">{selectedRequest?.request_number}</span>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del Rechazo *
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explica el motivo del rechazo..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmReject}
              loading={rejectMutation.isPending}
            >
              Confirmar Rechazo
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle de Solicitud"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Employee Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedRequest.employee?.name}</p>
                <p className="text-sm text-gray-500">
                  {selectedRequest.employee?.department} • {selectedRequest.employee?.job_title}
                </p>
              </div>
            </div>

            {/* Request Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Número de Solicitud</p>
                <p className="font-medium">{selectedRequest.request_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <Badge status={selectedRequest.status} />
              </div>
              {selectedType === 'vacation' ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Tipo</p>
                    <p className="font-medium">{selectedRequest.vacation_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Días Solicitados</p>
                    <p className="font-medium text-primary-600">{selectedRequest.days_requested}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha Inicio</p>
                    <p className="font-medium">{new Date(selectedRequest.start_date).toLocaleDateString('es-ES')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha Fin</p>
                    <p className="font-medium">{new Date(selectedRequest.end_date).toLocaleDateString('es-ES')}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Tipo de Certificación</p>
                    <p className="font-medium">{selectedRequest.certification_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Propósito</p>
                    <p className="font-medium">{selectedRequest.purpose}</p>
                  </div>
                </>
              )}
            </div>

            {selectedRequest.reason && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Motivo</p>
                <p className="p-3 bg-gray-50 rounded-lg text-gray-700">{selectedRequest.reason}</p>
              </div>
            )}

            {selectedRequest.status === 'pending' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                  Cerrar
                </Button>
                <Button variant="danger" onClick={() => { setShowDetailModal(false); handleReject(selectedRequest, selectedType) }}>
                  Rechazar
                </Button>
                <Button variant="success" onClick={() => { setShowDetailModal(false); handleApprove(selectedRequest, selectedType) }}>
                  Aprobar
                </Button>
              </div>
            )}

            {selectedRequest.status !== 'pending' && (
              <div className="space-y-4 pt-4 border-t">
                {/* Document Generation for Certifications */}
                {selectedType === 'certification' && selectedRequest.status === 'approved' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Generacion de Documento
                    </h4>
                    {selectedRequest.document_uuid ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-blue-700">Documento generado</p>
                        <Button
                          size="sm"
                          onClick={() => handleDownloadDocument(selectedRequest.id)}
                        >
                          <Download className="w-4 h-4" />
                          Descargar PDF
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-blue-700">
                          Genera el documento de certificacion para el empleado
                        </p>
                        <Button
                          size="sm"
                          onClick={() => generateDocMutation.mutate(selectedRequest.id)}
                          loading={generateDocMutation.isPending}
                        >
                          <FileText className="w-4 h-4" />
                          Generar Documento
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
