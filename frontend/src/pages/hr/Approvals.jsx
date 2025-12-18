import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { Calendar, Award, CheckCircle, XCircle, Eye, User, Clock } from 'lucide-react'

function ApprovalCard({ request, type, onApprove, onReject, onView }) {
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
                  <p className="text-sm font-medium text-primary-600">
                    {request.days_requested} días solicitados
                  </p>
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
              <div className="flex-1" />
              <Button variant="danger" size="sm" onClick={() => onReject(request, type)}>
                <XCircle className="w-4 h-4" />
                Rechazar
              </Button>
              <Button variant="success" size="sm" onClick={() => onApprove(request, type)}>
                <CheckCircle className="w-4 h-4" />
                Aprobar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Approvals() {
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalService.list(),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id }) => approvalService.approve(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => approvalService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      setShowRejectModal(false)
      setRejectReason('')
    },
  })

  const approvals = data?.data?.data || { vacation_requests: [], certification_requests: [] }
  const totalPending = (approvals.vacation_requests?.length || 0) + (approvals.certification_requests?.length || 0)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aprobaciones Pendientes</h1>
        <p className="text-gray-500">
          {totalPending > 0
            ? `Tienes ${totalPending} solicitud${totalPending > 1 ? 'es' : ''} pendiente${totalPending > 1 ? 's' : ''} de aprobación`
            : 'No hay solicitudes pendientes'}
        </p>
      </div>

      {/* Stats */}
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
              <p className="text-2xl font-bold text-gray-900">{approvals.vacation_requests?.length || 0}</p>
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
              <p className="text-2xl font-bold text-gray-900">{approvals.certification_requests?.length || 0}</p>
              <p className="text-sm text-gray-500">Certificaciones</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vacation Requests */}
      {approvals.vacation_requests?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Solicitudes de Vacaciones
          </h2>
          <div className="space-y-4">
            {approvals.vacation_requests.map((request) => (
              <ApprovalCard
                key={request.id}
                request={request}
                type="vacation"
                onApprove={handleApprove}
                onReject={handleReject}
                onView={handleView}
              />
            ))}
          </div>
        </div>
      )}

      {/* Certification Requests */}
      {approvals.certification_requests?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Solicitudes de Certificación
          </h2>
          <div className="space-y-4">
            {approvals.certification_requests.map((request) => (
              <ApprovalCard
                key={request.id}
                request={request}
                type="certification"
                onApprove={handleApprove}
                onReject={handleReject}
                onView={handleView}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalPending === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              ¡Todo al día!
            </h3>
            <p className="text-gray-500">
              No tienes solicitudes pendientes de aprobación
            </p>
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
          </div>
        )}
      </Modal>
    </div>
  )
}
