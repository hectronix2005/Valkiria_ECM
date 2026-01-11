import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractApprovalService, contractService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { CheckCircle, XCircle, Clock, FileText, Building2, User, AlertCircle, Download, Eye, FileWarning, PenTool, FileCheck } from 'lucide-react'

const STATUS_COLORS = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  signed: 'green',
}

const CONTRACT_STATUS_CONFIG = {
  pending_approval: { color: 'yellow', icon: Clock, label: 'En Aprobación' },
  pending_signatures: { color: 'purple', icon: FileCheck, label: 'Pendiente Firmas' },
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

function SignatureTimeline({ signatures }) {
  if (!signatures || signatures.length === 0) return null

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-3">
        {signatures.map((sig, index) => (
          <div key={index} className="relative flex items-start gap-4 pl-10">
            <div className={`absolute left-2 w-4 h-4 rounded-full flex items-center justify-center ${
              sig.status === 'signed' ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {sig.status === 'signed' && (
                <CheckCircle className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{sig.signatory_label}</span>
                <Badge status={sig.status === 'signed' ? 'green' : 'gray'}>
                  {sig.status === 'signed' ? 'Firmado' : 'Pendiente'}
                </Badge>
              </div>
              {sig.user_name && (
                <p className="text-sm text-gray-600">
                  {sig.user_name}
                </p>
              )}
              {sig.signed_at && (
                <p className="text-xs text-gray-400">
                  {new Date(sig.signed_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApprovalCard({ contract, onApprove, onReject, onSign, onViewDetail, onViewDocument }) {
  const formatAmount = (amount, currency) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const isPendingSignatures = contract.status === 'pending_signatures'
  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.pending_approval
  const StatusIcon = statusConfig.icon

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isPendingSignatures ? 'bg-purple-100' : 'bg-yellow-100'}`}>
              <StatusIcon className={`h-5 w-5 ${isPendingSignatures ? 'text-purple-600' : 'text-yellow-600'}`} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{contract.title}</h3>
              <p className="text-sm text-gray-500">{contract.contract_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={statusConfig.color}>{statusConfig.label}</Badge>
            <Badge status="blue">{contract.type_label}</Badge>
          </div>
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

        {/* Approval Progress - only show for pending_approval status */}
        {!isPendingSignatures && (
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
        )}

        {/* Approval Timeline */}
        {contract.approvals && contract.approvals.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Aprobaciones</p>
            <ApprovalTimeline approvals={contract.approvals} />
          </div>
        )}

        {/* Signature Progress - show for pending_signatures status */}
        {isPendingSignatures && contract.document_signatures && contract.document_signatures.length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-700">Progreso de Firmas</span>
              {contract.document_signatures_status && (
                <span className="text-sm text-purple-600">
                  {contract.document_signatures_status.signed}/{contract.document_signatures_status.total}
                </span>
              )}
            </div>
            {contract.document_signatures_status && (
              <div className="w-full bg-purple-200 rounded-full h-2 mb-3">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${(contract.document_signatures_status.signed / contract.document_signatures_status.total) * 100}%` }}
                />
              </div>
            )}
            <SignatureTimeline signatures={contract.document_signatures} />
          </div>
        )}

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
          {!contract.has_document && !isPendingSignatures && (
            <p className="text-xs text-amber-700 mt-2">
              Este contrato no tiene un documento generado. Se recomienda generar el documento antes de aprobar.
            </p>
          )}
        </div>

        {/* Actions - Approval */}
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

        {/* Actions - Signature */}
        {contract.can_sign && (
          <div className="mt-4 pt-4 border-t flex justify-end gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSign(contract)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <PenTool className="h-4 w-4 mr-1" />
              Firmar Documento
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

function SignModal({ contract, onConfirm, onCancel, isLoading }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(true)
  // Store absolute Y position (across all pages)
  const [signatureX, setSignatureX] = useState(350)
  const [signatureY, setSignatureY] = useState(700)
  const [signatureSize, setSignatureSize] = useState({ width: 200, height: 80 })
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const containerRef = useRef(null)
  const scrollContainerRef = useRef(null)

  // Use actual document dimensions from template (Letter: 612x792, A4: 595x842)
  const PDF_WIDTH = contract.pdf_width || 612
  const PDF_HEIGHT = contract.pdf_height || 792
  const totalPages = contract.document_page_count || 1
  const scale = 0.65 // Scale factor for display

  // Display dimensions
  const displayWidth = PDF_WIDTH * scale
  const displayHeight = PDF_HEIGHT * scale
  const totalHeightScaled = displayHeight * totalPages

  // Find the user's pending signature from contract data
  const mySignature = contract.document_signatures?.find(
    sig => sig.status === 'pending' && sig.is_mine
  )

  // Calculate which page the signature is on
  const signaturePage = Math.floor(signatureY / PDF_HEIGHT) + 1

  // Load PDF and get signature position
  useEffect(() => {
    const loadPdf = async () => {
      setPdfLoading(true)
      try {
        const response = await contractService.downloadDocument(contract.id)
        const blob = new Blob([response.data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)

        // Set initial position from signatory config if available
        if (mySignature) {
          const page = mySignature.page_number || totalPages
          // Calculate absolute Y from page + relative position
          const relativeY = mySignature.y_position || 700
          // If y_position seems to be within a single page, it's relative; otherwise absolute
          const absoluteY = relativeY < PDF_HEIGHT ? (page - 1) * PDF_HEIGHT + relativeY : relativeY

          setSignatureX(mySignature.x_position || 350)
          setSignatureY(absoluteY)
          setSignatureSize({
            width: mySignature.width || 200,
            height: mySignature.height || 80
          })
          setCurrentPage(page)

          // Scroll to signature page after a short delay
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const targetY = (page - 1) * displayHeight
              scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' })
            }
          }, 300)
        } else {
          // Default to last page
          const defaultY = (totalPages - 1) * PDF_HEIGHT + 600
          setSignatureY(defaultY)
          setCurrentPage(totalPages)
        }
      } catch (error) {
        console.error('Error loading PDF:', error)
      } finally {
        setPdfLoading(false)
      }
    }
    loadPdf()

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [contract.id])

  // Track scroll to update current page indicator
  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop
    const page = Math.floor(scrollTop / displayHeight) + 1
    setCurrentPage(Math.min(Math.max(1, page), totalPages))
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    // Convert mouse position to native PDF coordinates
    const mouseXInPdf = (e.clientX - rect.left) / scale
    const mouseYInPdf = (e.clientY - rect.top) / scale

    setDragOffset({
      x: mouseXInPdf - signatureX,
      y: mouseYInPdf - signatureY
    })
    setDragging(true)
  }

  const handleMouseMove = (e) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseXInPdf = (e.clientX - rect.left) / scale
    const mouseYInPdf = (e.clientY - rect.top) / scale

    // Calculate new position
    const newX = mouseXInPdf - dragOffset.x
    const newY = mouseYInPdf - dragOffset.y

    // Clamp to document bounds
    const totalDocHeight = PDF_HEIGHT * totalPages
    const clampedX = Math.max(0, Math.min(PDF_WIDTH - signatureSize.width, newX))
    const clampedY = Math.max(0, Math.min(totalDocHeight - signatureSize.height, newY))

    setSignatureX(Math.round(clampedX))
    setSignatureY(Math.round(clampedY))
  }

  const handleMouseUp = () => {
    setDragging(false)
  }

  const scrollToPage = (page) => {
    if (scrollContainerRef.current) {
      const targetY = (page - 1) * displayHeight
      scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }

  const scrollToSignature = () => {
    if (scrollContainerRef.current) {
      const targetY = signatureY * scale - 100 // A bit above the signature
      scrollContainerRef.current.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' })
    }
  }

  const handleConfirm = () => {
    // Convert absolute Y to page-relative Y for the backend
    const page = Math.floor(signatureY / PDF_HEIGHT) + 1
    const pageRelativeY = signatureY - (page - 1) * PDF_HEIGHT

    onConfirm({
      x_position: Math.round(signatureX),
      y_position: Math.round(pageRelativeY),
      width: signatureSize.width,
      height: signatureSize.height,
      page_number: page
    })
  }

  // For display purposes, get Y relative to its page
  const signatureYInPage = signatureY - (signaturePage - 1) * PDF_HEIGHT

  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <PenTool className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-purple-900">Firmar Documento</h4>
              <p className="text-sm text-purple-700">
                Contrato <strong>{contract.contract_number}</strong>
              </p>
            </div>
          </div>
          {mySignature && (
            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
              {mySignature.signatory_label}
            </span>
          )}
        </div>
      </div>

      {/* Header with page navigation */}
      <div className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Página {currentPage} de {totalPages}</span>
          {totalPages > 1 && (
            <div className="flex gap-1">
              {[...Array(Math.min(totalPages, 10))].map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i + 1)}
                  className={`w-5 h-5 text-[10px] rounded ${
                    currentPage === i + 1
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>X={signatureX}, Y={signatureYInPage} en Pág {signaturePage}</span>
          <span className="text-gray-300">|</span>
          <span>{PDF_WIDTH > 600 ? 'Carta' : 'A4'} ({Math.round(PDF_WIDTH)}x{Math.round(PDF_HEIGHT)})</span>
        </div>
      </div>

      {/* PDF Preview with draggable signature - Similar to TemplateEdit */}
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
        {pdfLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            <span className="ml-3 text-gray-500">Cargando documento...</span>
          </div>
        ) : pdfUrl ? (
          <div
            ref={scrollContainerRef}
            className="mx-auto overflow-auto"
            style={{
              width: displayWidth + 24,
              maxHeight: 450,
              padding: 10,
            }}
            onScroll={handleScroll}
          >
            {/* Wrapper for scroll height */}
            <div style={{ width: displayWidth, height: totalHeightScaled, margin: '0 auto' }}>
              {/* Scaled container using CSS transform */}
              <div
                ref={containerRef}
                className="relative origin-top-left"
                style={{
                  width: PDF_WIDTH,
                  height: PDF_HEIGHT * totalPages,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* PDF iframe at native size */}
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: PDF_WIDTH,
                    height: PDF_HEIGHT * totalPages,
                    border: 'none',
                  }}
                  title="PDF Preview"
                />

                {/* Page backgrounds and separators */}
                {[...Array(totalPages)].map((_, pageIndex) => (
                  <div
                    key={pageIndex}
                    className="absolute border border-gray-200"
                    style={{
                      width: PDF_WIDTH,
                      height: PDF_HEIGHT,
                      top: pageIndex * PDF_HEIGHT,
                      left: 0,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div className="absolute top-2 right-2 bg-gray-100/80 text-gray-500 text-xs px-2 py-1 rounded">
                      Página {pageIndex + 1}
                    </div>
                  </div>
                ))}

                {/* Page separators */}
                {totalPages > 1 && [...Array(totalPages - 1)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t-2 border-dashed border-purple-300 pointer-events-none"
                    style={{ top: PDF_HEIGHT * (i + 1) }}
                  >
                    <span className="absolute left-2 -top-4 bg-purple-100 px-2 py-0.5 text-xs text-purple-600 rounded">
                      Página {i + 2}
                    </span>
                  </div>
                ))}

                {/* Draggable Signature Box - positioned at absolute PDF coordinates */}
                <div
                  className={`absolute cursor-move transition-all duration-100 ${
                    dragging ? 'z-50' : 'z-10'
                  }`}
                  style={{
                    left: signatureX,
                    top: signatureY,
                    width: signatureSize.width,
                    height: signatureSize.height,
                    backgroundColor: 'rgba(147, 51, 234, 0.3)',
                    border: '2px dashed #9333ea',
                    borderRadius: 4,
                    boxShadow: dragging
                      ? '0 8px 20px rgba(0,0,0,0.2)'
                      : '0 0 0 3px rgba(147, 51, 234, 0.2), 0 4px 12px rgba(0,0,0,0.15)',
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-700">
                    <PenTool style={{ width: 20, height: 20, opacity: 0.8 }} />
                    <span className="font-medium text-center px-1" style={{ fontSize: 11 }}>
                      {mySignature?.signatory_label || 'Tu firma'}
                    </span>
                    <span style={{ fontSize: 9, color: '#7c3aed' }}>
                      Pág. {signaturePage}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No se pudo cargar el documento</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-3 bg-amber-50 rounded-lg text-sm border border-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-amber-800">
            <p className="font-medium">Arrastra el cuadro morado para posicionar tu firma.</p>
            <p className="text-amber-600 mt-1">Usa el scroll para navegar entre páginas. La firma se moverá con el arrastre.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          loading={isLoading}
          disabled={pdfLoading}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <PenTool className="h-4 w-4 mr-1" />
          Confirmar Firma
        </Button>
      </div>
    </div>
  )
}

export default function ContractApprovals() {
  const [activeTab, setActiveTab] = useState('pending')
  const [approveContract, setApproveContract] = useState(null)
  const [rejectContract, setRejectContract] = useState(null)
  const [signContract, setSignContract] = useState(null)
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

  const signMutation = useMutation({
    mutationFn: ({ id, position }) => contractApprovalService.sign(id, position),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['contract-approvals'])
      setSignContract(null)
      if (response.data?.all_signed) {
        alert('Todas las firmas han sido completadas. El contrato ha sido aprobado.')
      }
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al firmar el documento')
    },
  })

  const contracts = data?.data?.data || []
  const totalPending = data?.data?.meta?.total_pending || 0
  const totalPendingApprovals = data?.data?.meta?.total_pending_approvals || 0
  const totalPendingSignatures = data?.data?.meta?.total_pending_signatures || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aprobaciones de Contratos</h1>
        <p className="text-gray-500">Aprobación multinivel de contratos según monto</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPending}</p>
                <p className="text-sm text-gray-500">Total Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{totalPendingApprovals}</p>
                <p className="text-sm text-gray-500">Por Aprobar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <PenTool className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{totalPendingSignatures}</p>
                <p className="text-sm text-gray-500">Por Firmar</p>
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
              onSign={setSignContract}
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

      {/* Sign Modal */}
      <Modal
        isOpen={!!signContract}
        onClose={() => setSignContract(null)}
        title="Firmar Documento"
        size="lg"
      >
        {signContract && (
          <SignModal
            contract={signContract}
            onConfirm={(position) => signMutation.mutate({ id: signContract.id, position })}
            onCancel={() => setSignContract(null)}
            isLoading={signMutation.isPending}
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
              {documentContract?.can_sign && (
                <Button
                  onClick={() => {
                    handleCloseDocument()
                    setSignContract(documentContract)
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <PenTool className="h-4 w-4 mr-1" />
                  Firmar
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
