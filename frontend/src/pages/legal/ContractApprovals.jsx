import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractApprovalService, contractService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { CheckCircle, XCircle, Clock, FileText, Building2, User, AlertCircle, Download, Eye, FileWarning } from 'lucide-react'

const STATUS_COLORS = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
}

const APPROVAL_ROLE_COLORS = {
  area_manager: 'blue',
  legal: 'purple',
  general_manager: 'orange',
  ceo: 'red',
}

function ApprovalTimeline({ approvals }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {approvals.map((approval, index) => (
          <div key={index} className="relative flex items-start gap-4 pl-10">
            <div className={`absolute left-2 w-4 h-4 rounded-full ${
              approval.status === 'approved' ? 'bg-green-500' :
              approval.status === 'rejected' ? 'bg-red-500' :
              'bg-gray-300'
            }`}>
              {approval.status === 'approved' && (
                <CheckCircle className="w-4 h-4 text-white" />
              )}
              {approval.status === 'rejected' && (
                <XCircle className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge status={APPROVAL_ROLE_COLORS[approval.role] || 'gray'}>
                  {approval.role_label}
                </Badge>
                <Badge status={STATUS_COLORS[approval.status]}>
                  {approval.status === 'pending' ? 'Pendiente' :
                   approval.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                </Badge>
              </div>
              {approval.approver_name && (
                <p className="text-sm text-gray-600 mt-1">
                  Por: {approval.approver_name}
                  {approval.decided_at && (
                    <span className="ml-2 text-gray-400">
                      {new Date(approval.decided_at).toLocaleString()}
                    </span>
                  )}
                </p>
              )}
              {approval.notes && (
                <p className="text-sm text-gray-500 mt-1 italic">"{approval.notes}"</p>
              )}
              {approval.reason && (
                <p className="text-sm text-red-600 mt-1">Motivo: {approval.reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApprovalCard({ contract, onApprove, onReject, onViewDetail, onViewDocument }) {
  const formatAmount = (amount, currency) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{contract.title}</h3>
              <p className="text-sm text-gray-500">{contract.contract_number}</p>
            </div>
          </div>
          <Badge status="blue">{contract.type_label}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Tercero</span>
            <p className="font-medium">{contract.third_party?.display_name || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Monto</span>
            <p className="font-medium">{formatAmount(contract.amount, contract.currency)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Solicitado por</span>
            <p className="font-medium">{contract.requested_by?.name || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Nivel de Aprobación</span>
            <p className="font-medium">{contract.approval_level_label}</p>
          </div>
        </div>

        {/* Approval Progress */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progreso de Aprobación</span>
            <span className="text-sm text-gray-500">{contract.approval_progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${contract.approval_progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Pendiente: <strong>{contract.current_approver_label}</strong>
          </p>
        </div>

        {/* Approval Timeline */}
        <div className="mt-4">
          <ApprovalTimeline approvals={contract.approvals} />
        </div>

        {/* Document Preview */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Documento del Contrato</span>
            </div>
            {contract.has_document ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onViewDocument(contract)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver Documento
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <FileWarning className="h-4 w-4" />
                <span className="text-sm">Sin documento generado</span>
              </div>
            )}
          </div>
          {!contract.has_document && (
            <p className="text-xs text-amber-700 mt-2">
              Este contrato no tiene un documento generado. Se recomienda generar el documento antes de aprobar.
            </p>
          )}
        </div>

        {/* Actions */}
        {contract.can_approve && (
          <div className="mt-4 pt-4 border-t flex justify-end gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onReject(contract)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rechazar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApprove(contract)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprobar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ApproveModal({ contract, onConfirm, onCancel, isLoading }) {
  const [notes, setNotes] = useState('')

  return (
    <div className="space-y-4">
      <div className="p-4 bg-green-50 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900">Aprobar Contrato</h4>
            <p className="text-sm text-green-700 mt-1">
              Estás a punto de aprobar el contrato <strong>{contract.contract_number}</strong>
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Agregar comentarios sobre la aprobación..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(notes)}
          loading={isLoading}
        >
          Confirmar Aprobación
        </Button>
      </div>
    </div>
  )
}

function RejectModal({ contract, onConfirm, onCancel, isLoading }) {
  const [reason, setReason] = useState('')

  return (
    <div className="space-y-4">
      <div className="p-4 bg-red-50 rounded-lg">
        <div className="flex items-start gap-3">
          <XCircle className="h-6 w-6 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Rechazar Contrato</h4>
            <p className="text-sm text-red-700 mt-1">
              Estás a punto de rechazar el contrato <strong>{contract.contract_number}</strong>.
              Esta acción detendrá el flujo de aprobación.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motivo del Rechazo <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          placeholder="Explica el motivo del rechazo..."
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          onClick={() => onConfirm(reason)}
          loading={isLoading}
          disabled={!reason.trim()}
        >
          Confirmar Rechazo
        </Button>
      </div>
    </div>
  )
}

export default function ContractApprovals() {
  const [activeTab, setActiveTab] = useState('pending')
  const [approveContract, setApproveContract] = useState(null)
  const [rejectContract, setRejectContract] = useState(null)
  const [documentContract, setDocumentContract] = useState(null)
  const [documentUrl, setDocumentUrl] = useState(null)
  const [documentLoading, setDocumentLoading] = useState(false)

  const queryClient = useQueryClient()

  // Handle document view
  const handleViewDocument = async (contract) => {
    setDocumentContract(contract)
    setDocumentLoading(true)
    try {
      const response = await contractService.downloadDocument(contract.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDocumentUrl(url)
    } catch (error) {
      console.error('Error loading document:', error)
      alert('Error al cargar el documento')
    } finally {
      setDocumentLoading(false)
    }
  }

  const handleCloseDocument = () => {
    if (documentUrl) {
      URL.revokeObjectURL(documentUrl)
    }
    setDocumentContract(null)
    setDocumentUrl(null)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['contract-approvals', activeTab],
    queryFn: () => contractApprovalService.list({ status: activeTab }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => contractApprovalService.approve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['contract-approvals'])
      setApproveContract(null)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => contractApprovalService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['contract-approvals'])
      setRejectContract(null)
    },
  })

  const contracts = data?.data?.data || []
  const totalPending = data?.data?.meta?.total_pending || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aprobaciones de Contratos</h1>
        <p className="text-gray-500">Aprobación multinivel de contratos según monto</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPending}</p>
                <p className="text-sm text-gray-500">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pendientes
            {totalPending > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                {totalPending}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Historial
          </button>
        </nav>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-48" />
            </Card>
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            {activeTab === 'pending' ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay aprobaciones pendientes</h3>
                <p className="text-gray-500">Todos los contratos están al día</p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sin historial</h3>
                <p className="text-gray-500">No has procesado ningún contrato aún</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => (
            <ApprovalCard
              key={contract.id}
              contract={contract}
              onApprove={setApproveContract}
              onReject={setRejectContract}
              onViewDocument={handleViewDocument}
            />
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={!!approveContract}
        onClose={() => setApproveContract(null)}
        title="Aprobar Contrato"
        size="md"
      >
        {approveContract && (
          <ApproveModal
            contract={approveContract}
            onConfirm={(notes) => approveMutation.mutate({ id: approveContract.id, notes })}
            onCancel={() => setApproveContract(null)}
            isLoading={approveMutation.isPending}
          />
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectContract}
        onClose={() => setRejectContract(null)}
        title="Rechazar Contrato"
        size="md"
      >
        {rejectContract && (
          <RejectModal
            contract={rejectContract}
            onConfirm={(reason) => rejectMutation.mutate({ id: rejectContract.id, reason })}
            onCancel={() => setRejectContract(null)}
            isLoading={rejectMutation.isPending}
          />
        )}
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!documentContract}
        onClose={handleCloseDocument}
        title={`Documento: ${documentContract?.contract_number || ''}`}
        size="xl"
      >
        <div className="space-y-4">
          {/* Contract Info Header */}
          {documentContract && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Contrato:</span>
                  <p className="font-medium">{documentContract.title}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tercero:</span>
                  <p className="font-medium">{documentContract.third_party?.display_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Monto:</span>
                  <p className="font-medium text-green-600">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: documentContract.currency || 'COP' }).format(documentContract.amount)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <Badge variant={documentContract.status}>{documentContract.status_label}</Badge>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          {documentLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-3 text-gray-500">Cargando documento...</span>
            </div>
          ) : documentUrl ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
              <iframe
                src={documentUrl}
                className="w-full h-full"
                title="Contract Document"
              />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileWarning className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No se pudo cargar el documento</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                if (documentUrl) {
                  const a = document.createElement('a')
                  a.href = documentUrl
                  a.download = `${documentContract?.contract_number || 'contrato'}.pdf`
                  a.click()
                }
              }}
              disabled={!documentUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCloseDocument}>
                Cerrar
              </Button>
              {documentContract?.can_approve && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      handleCloseDocument()
                      setRejectContract(documentContract)
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => {
                      handleCloseDocument()
                      setApproveContract(documentContract)
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aprobar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
