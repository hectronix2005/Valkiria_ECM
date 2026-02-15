import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { renderAsync } from 'docx-preview'
import { approvalService, certificationService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import {
  Calendar, Award, CheckCircle, XCircle, Eye, User, Clock, History,
  FileText, Download, Loader2, PenTool, ExternalLink, AlertCircle
} from 'lucide-react'

function VacationApprovalsTable({ requests, onApprove, onReject, onView, onSign, signingId, showActions = true }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Empleado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Solicitud</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Periodo</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Dias</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha Solicitud</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{request.employee?.name || 'Empleado'}</p>
                    <p className="text-xs text-gray-500">{request.employee?.department}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{request.request_number}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {request.vacation_type}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(request.start_date).toLocaleDateString('es-ES')} - {new Date(request.end_date).toLocaleDateString('es-ES')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-primary-600">{Math.floor(request.days_requested)}</span>
                  <span className="text-xs text-gray-400 ml-1">/ <span className="text-green-600">{Math.floor(request.employee?.available_vacation_days || 0)}</span></span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {request.submitted_at
                    ? new Date(request.submitted_at).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge status={request.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView(request, 'vacation')} title="Ver detalle">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {showActions && (
                      <>
                        {request.can_sign && request.has_document && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSign(request)}
                            loading={signingId === request.id}
                            title="Firmar"
                          >
                            <PenTool className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="danger" size="sm" onClick={() => onReject(request, 'vacation')} title="Rechazar">
                          <XCircle className="w-4 h-4" />
                        </Button>
                        <Button variant="success" size="sm" onClick={() => onApprove(request, 'vacation')} title="Aprobar">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CertificationApprovalsTable({ requests, onApprove, onReject, onView, onSign, signingId, showActions = true }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Empleado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Solicitud</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Proposito</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha Solicitud</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{request.employee?.name || 'Empleado'}</p>
                    <p className="text-xs text-gray-500">{request.employee?.department}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{request.request_number}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {request.certification_type}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={request.purpose}>
                  {request.purpose}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {request.submitted_at
                    ? new Date(request.submitted_at).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge status={request.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView(request, 'certification')} title="Ver detalle">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {showActions && (
                      <>
                        {request.can_sign && request.has_document && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSign(request)}
                            loading={signingId === request.id}
                            title="Firmar"
                          >
                            <PenTool className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="danger" size="sm" onClick={() => onReject(request, 'certification')} title="Rechazar">
                          <XCircle className="w-4 h-4" />
                        </Button>
                        <Button variant="success" size="sm" onClick={() => onApprove(request, 'certification')} title="Aprobar">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// Componente para mostrar el detalle de una solicitud de vacaciones con documento
function VacationDetailWithDocument({ request, onClose, onApprove, onReject }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [docxBlob, setDocxBlob] = useState(null)
  const docxRef = useRef(null)
  const [docxMetrics, setDocxMetrics] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [signError, setSignError] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (request.pdf_ready && request.document_uuid) {
      loadDocument()
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [request.id, request.document_uuid, request.pdf_ready])

  // Render DOCX with docx-preview
  useEffect(() => {
    if (!docxBlob || !docxRef.current) return
    docxRef.current.innerHTML = ''
    setDocxMetrics(null)
    renderAsync(docxBlob, docxRef.current, null, {
      inWrapper: true, ignoreWidth: false, ignoreHeight: false, ignoreFonts: false,
      breakPages: true, ignoreLastRenderedPageBreak: false, experimental: true,
      trimXmlDeclaration: true, useBase64URL: true,
    }).then(() => {
      const section = docxRef.current?.querySelector('section.docx')
      if (section) {
        const container = docxRef.current
        const sectionRect = section.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setDocxMetrics({
          offsetLeft: sectionRect.left - containerRect.left + container.scrollLeft,
          offsetTop: sectionRect.top - containerRect.top + container.scrollTop,
          scale: sectionRect.width / 612,
        })
      }
    }).catch(e => console.error('[VacApprovals] Error rendering DOCX:', e))
  }, [docxBlob])

  const loadDocument = async () => {
    setPdfLoading(true)
    try {
      const response = await approvalService.downloadDocument(request.id)
      const blob = response.data
      // Detect DOCX by checking file signature (PK zip header) instead of relying on Content-Type
      const header = await blob.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(header)
      const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4B // PK signature = ZIP/DOCX
      if (isDocx) {
        setDocxBlob(blob)
        setPdfUrl(null)
      } else {
        setPdfUrl(URL.createObjectURL(blob))
        setDocxBlob(null)
      }
    } catch (err) {
      console.error('[Approvals] Error loading document:', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const signMutation = useMutation({
    mutationFn: (id) => approvalService.signDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      setSignError('')
      if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null) }
      setDocxBlob(null)
      loadDocument()
    },
    onError: (err) => {
      setSignError(err.response?.data?.error || 'Error al firmar el documento')
    }
  })

  const handleSign = () => {
    setSignError('')
    signMutation.mutate(request.id)
  }

  const openPdfInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }

  const documentInfo = request.document

  // Determine which signature slots belong to the current approver
  const supervisorSig = documentInfo?.signatures?.find(s => s.signatory_type_code === 'supervisor')
  const hrSig = documentInfo?.signatures?.find(s => s.signatory_type_code === 'hr')
  const employeeSig = documentInfo?.signatures?.find(s => s.signatory_type_code === 'employee')

  // Check if current user can sign (has pending signature)
  const canSign = (supervisorSig && !supervisorSig.signed) || (hrSig && !hrSig.signed)

  return (
    <div className="space-y-6">
      {/* Employee Info */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{request.employee?.name}</p>
          <p className="text-sm text-gray-500">
            {request.employee?.department} • {request.employee?.job_title}
          </p>
        </div>
      </div>

      {/* Request Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Numero de Solicitud</p>
          <p className="font-medium">{request.request_number}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Estado</p>
          <Badge status={request.status} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Tipo</p>
          <p className="font-medium">{request.vacation_type}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Dias Solicitados</p>
          <p className="font-medium text-primary-600">{request.days_requested}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Fecha Inicio</p>
          <p className="font-medium">{new Date(request.start_date).toLocaleDateString('es-ES')}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Fecha Fin</p>
          <p className="font-medium">{new Date(request.end_date).toLocaleDateString('es-ES')}</p>
        </div>
      </div>

      {request.reason && (
        <div>
          <p className="text-sm text-gray-500 mb-1">Motivo</p>
          <p className="p-3 bg-gray-50 rounded-lg text-gray-700">{request.reason}</p>
        </div>
      )}

      {/* Document Preview Section */}
      {request.has_document && (
        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Documento de Solicitud
          </h3>

          {/* Document Preview */}
          {pdfLoading ? (
            <div className="border rounded-lg p-8 text-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">Cargando documento...</p>
            </div>
          ) : pdfUrl ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
                <Button variant="ghost" size="sm" onClick={openPdfInNewTab}>
                  <ExternalLink className="w-4 h-4" />
                  Abrir en nueva pestana
                </Button>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full h-[350px] border-0"
                title="Vista previa del documento"
              />
            </div>
          ) : docxBlob ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
              </div>
              <div className="relative max-h-[500px] overflow-auto bg-white">
                <div ref={docxRef} style={{ position: 'relative' }} />
                {docxMetrics && documentInfo?.signatures?.filter(s => s.signed && s.signature_image && s.position_box).map((sig, idx) => {
                  const box = sig.position_box
                  const m = docxMetrics
                  return (
                    <div key={idx} style={{
                      position: 'absolute',
                      left: m.offsetLeft + box.x * m.scale,
                      top: m.offsetTop + box.y * m.scale,
                      width: box.width * m.scale,
                      height: box.height * m.scale,
                      zIndex: 10, pointerEvents: 'none', background: '#fff',
                    }}>
                      <img src={sig.signature_image.startsWith('data:') ? sig.signature_image : `data:image/png;base64,${sig.signature_image}`}
                        alt={`Firma de ${sig.signed_by}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : request.pdf_ready === false ? (
            <div className="border rounded-lg p-6 text-center bg-amber-50 border-amber-200">
              <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-amber-700 font-medium">Documento pendiente de generacion</p>
              <p className="text-amber-600 text-sm mt-1">El PDF se generara proximamente</p>
            </div>
          ) : (
            <div className="border rounded-lg p-6 text-center bg-gray-50">
              <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">No se pudo cargar el documento</p>
            </div>
          )}

          {/* Signatures Status */}
          {documentInfo?.signatures && documentInfo.signatures.length > 0 && (
            <div className="mt-4 p-4 bg-white border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <PenTool className="w-4 h-4" />
                Firmas del Documento
              </h4>
              <div className="space-y-3">
                {documentInfo.signatures.map((sig, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        sig.signed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {sig.signed ? <CheckCircle className="w-5 h-5" /> : sig.position || idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sig.label}</p>
                        <p className="text-xs text-gray-500">
                          {sig.signatory_type_code === 'employee' && 'Empleado Solicitante'}
                          {sig.signatory_type_code === 'supervisor' && 'Supervisor Directo'}
                          {sig.signatory_type_code === 'hr' && 'Recursos Humanos'}
                        </p>
                        {sig.signed && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Firmado por {sig.signed_by_name} - {new Date(sig.signed_at).toLocaleString('es-ES')}
                          </p>
                        )}
                      </div>
                    </div>
                    {!sig.signed && (
                      <span className="text-xs text-amber-600 px-2 py-1 bg-amber-100 rounded">
                        Pendiente
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Sign Button for Approvers */}
              {canSign && request.status === 'pending' && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={handleSign}
                    loading={signMutation.isPending}
                    className="w-full"
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar Documento
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Tu firma se aplicara en el espacio correspondiente a tu rol
                  </p>
                </div>
              )}
            </div>
          )}

          {signError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{signError}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {request.status === 'pending' && (
        <div className="pt-4 border-t">
          {/* Check if document needs signatures and they're not all complete */}
          {request.has_document && documentInfo?.signatures?.some(s => !s.signed) && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">
                Para aprobar esta solicitud, primero deben completarse todas las firmas del documento.
              </span>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button variant="danger" onClick={() => onReject(request)}>
              <XCircle className="w-4 h-4" />
              Rechazar
            </Button>
            <Button
              variant="success"
              onClick={() => onApprove(request)}
              disabled={request.has_document && documentInfo?.signatures?.some(s => !s.signed)}
            >
              <CheckCircle className="w-4 h-4" />
              Aprobar
            </Button>
          </div>
        </div>
      )}

      {request.status !== 'pending' && (
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  )
}

// Componente para mostrar el detalle de una solicitud de certificación con documento
function CertificationDetailWithDocument({ request, onClose, onApprove, onReject, onGenerateDocument, isGenerating, generateError }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [docxBlob, setDocxBlob] = useState(null)
  const docxRef = useRef(null)
  const [docxMetrics, setDocxMetrics] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [signError, setSignError] = useState('')
  const [autoGenTriggered, setAutoGenTriggered] = useState(false)
  const queryClient = useQueryClient()

  // Auto-generar documento si no existe
  useEffect(() => {
    if (!request.has_document && !autoGenTriggered && onGenerateDocument && !isGenerating) {
      setAutoGenTriggered(true)
      onGenerateDocument(request.id)
    }
  }, [request.id, request.has_document])

  useEffect(() => {
    if (request.pdf_ready && request.document_uuid) {
      loadDocument()
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [request.id, request.document_uuid, request.pdf_ready])

  // Render DOCX with docx-preview
  useEffect(() => {
    if (!docxBlob || !docxRef.current) return
    docxRef.current.innerHTML = ''
    setDocxMetrics(null)
    renderAsync(docxBlob, docxRef.current, null, {
      inWrapper: true, ignoreWidth: false, ignoreHeight: false, ignoreFonts: false,
      breakPages: true, ignoreLastRenderedPageBreak: false, experimental: true,
      trimXmlDeclaration: true, useBase64URL: true,
    }).then(() => {
      const section = docxRef.current?.querySelector('section.docx')
      if (section) {
        const container = docxRef.current
        const sectionRect = section.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setDocxMetrics({
          offsetLeft: sectionRect.left - containerRect.left + container.scrollLeft,
          offsetTop: sectionRect.top - containerRect.top + container.scrollTop,
          scale: sectionRect.width / 612,
        })
      }
    }).catch(e => console.error('Error rendering DOCX:', e))
  }, [docxBlob])

  const loadDocument = async () => {
    setPdfLoading(true)
    try {
      const response = await approvalService.downloadDocument(request.id)
      const blob = response.data
      const header = await blob.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(header)
      const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4B
      if (isDocx) {
        setDocxBlob(blob)
        setPdfUrl(null)
      } else {
        setPdfUrl(URL.createObjectURL(blob))
        setDocxBlob(null)
      }
    } catch (err) {
      console.error('Error loading document:', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const signMutation = useMutation({
    mutationFn: (id) => approvalService.signDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      setSignError('')
      if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null) }
      setDocxBlob(null)
      loadDocument()
    },
    onError: (err) => {
      setSignError(err.response?.data?.error || 'Error al firmar el documento')
    }
  })

  const handleSign = () => {
    setSignError('')
    signMutation.mutate(request.id)
  }

  const openPdfInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }

  const documentInfo = request.document
  const canSign = documentInfo?.signatures?.some(s => !s.signed)

  return (
    <div className="space-y-6">
      {/* Employee Info */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{request.employee?.name}</p>
          <p className="text-sm text-gray-500">
            {request.employee?.department} • {request.employee?.job_title}
          </p>
        </div>
      </div>

      {/* Request Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Numero de Solicitud</p>
          <p className="font-medium">{request.request_number}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Estado</p>
          <Badge status={request.status} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Tipo de Certificacion</p>
          <p className="font-medium">{request.certification_type}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Proposito</p>
          <p className="font-medium">{request.purpose}</p>
        </div>
      </div>

      {/* Document Preview Section */}
      {request.has_document ? (
        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Documento de Certificacion
          </h3>

          {/* Document Preview */}
          {pdfLoading ? (
            <div className="border rounded-lg p-8 text-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">Cargando documento...</p>
            </div>
          ) : pdfUrl ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
                <Button variant="ghost" size="sm" onClick={openPdfInNewTab}>
                  <ExternalLink className="w-4 h-4" />
                  Abrir en nueva pestana
                </Button>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full h-[350px] border-0"
                title="Vista previa del documento"
              />
            </div>
          ) : docxBlob ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
              </div>
              <div className="relative max-h-[500px] overflow-auto bg-white">
                <div ref={docxRef} style={{ position: 'relative' }} />
                {docxMetrics && documentInfo?.signatures?.filter(s => s.signed && s.signature_image && s.position_box).map((sig, idx) => {
                  const box = sig.position_box
                  const m = docxMetrics
                  return (
                    <div key={idx} style={{
                      position: 'absolute',
                      left: m.offsetLeft + box.x * m.scale,
                      top: m.offsetTop + box.y * m.scale,
                      width: box.width * m.scale,
                      height: box.height * m.scale,
                      zIndex: 10, pointerEvents: 'none', background: '#fff',
                    }}>
                      <img src={sig.signature_image.startsWith('data:') ? sig.signature_image : `data:image/png;base64,${sig.signature_image}`}
                        alt={`Firma de ${sig.signed_by}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : request.pdf_ready === false ? (
            <div className="border rounded-lg p-6 text-center bg-amber-50 border-amber-200">
              <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-amber-700 font-medium">Documento pendiente de generacion</p>
              <p className="text-amber-600 text-sm mt-1">El PDF se generara proximamente</p>
            </div>
          ) : (
            <div className="border rounded-lg p-6 text-center bg-gray-50">
              <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">No se pudo cargar el documento</p>
            </div>
          )}

          {/* Signatures Status */}
          {documentInfo?.signatures && documentInfo.signatures.length > 0 && (
            <div className="mt-4 p-4 bg-white border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <PenTool className="w-4 h-4" />
                Firmas del Documento
              </h4>
              <div className="space-y-3">
                {documentInfo.signatures.map((sig, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        sig.signed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {sig.signed ? <CheckCircle className="w-5 h-5" /> : sig.position || idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sig.label}</p>
                        <p className="text-xs text-gray-500">
                          {sig.signatory_type_code === 'hr' && 'Recursos Humanos'}
                          {sig.signatory_type_code === 'supervisor' && 'Supervisor'}
                          {sig.signatory_type_code === 'legal' && 'Legal'}
                        </p>
                        {sig.signed && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Firmado por {sig.signed_by_name} - {new Date(sig.signed_at).toLocaleString('es-ES')}
                          </p>
                        )}
                      </div>
                    </div>
                    {!sig.signed && (
                      <span className="text-xs text-amber-600 px-2 py-1 bg-amber-100 rounded">
                        Pendiente
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Sign Button */}
              {canSign && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={handleSign}
                    loading={signMutation.isPending}
                    className="w-full"
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar Documento
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Tu firma se aplicara en el espacio correspondiente a tu rol
                  </p>
                </div>
              )}
            </div>
          )}

          {signError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{signError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Documento de Certificacion
          </h3>
          {isGenerating ? (
            <div className="border rounded-lg p-8 text-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
              <p className="text-gray-700 font-medium">Generando documento...</p>
              <p className="text-gray-500 text-sm mt-1">Esto puede tomar unos segundos</p>
            </div>
          ) : generateError ? (
            <div className="border rounded-lg p-6 text-center bg-red-50 border-red-200">
              <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
              <p className="text-red-700 font-medium">Error al generar documento</p>
              <p className="text-red-600 text-sm mt-1 mb-4">{generateError}</p>
              {onGenerateDocument && (
                <Button
                  onClick={() => onGenerateDocument(request.id)}
                >
                  <FileText className="w-4 h-4" />
                  Reintentar
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-6 text-center bg-blue-50 border-blue-200">
              <FileText className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <p className="text-blue-700 font-medium">Documento no generado</p>
              <p className="text-blue-600 text-sm mt-1 mb-4">
                Genera el documento de certificacion para revisarlo antes de aprobar
              </p>
              {onGenerateDocument && (
                <Button
                  onClick={() => onGenerateDocument(request.id)}
                >
                  <FileText className="w-4 h-4" />
                  Generar Documento
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        {request.status === 'pending' && (
          <>
            <Button variant="danger" onClick={() => onReject(request)}>
              <XCircle className="w-4 h-4" />
              Rechazar
            </Button>
            <Button variant="success" onClick={() => onApprove(request)}>
              <CheckCircle className="w-4 h-4" />
              Aprobar
            </Button>
          </>
        )}
      </div>
    </div>
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

  // Fetch detailed info when viewing a request
  const { data: detailData } = useQuery({
    queryKey: ['approval-detail', selectedRequest?.id],
    queryFn: () => approvalService.get(selectedRequest.id),
    enabled: !!selectedRequest?.id && showDetailModal,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id }) => approvalService.approve(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      queryClient.invalidateQueries(['approvals-count'])
      setShowDetailModal(false)
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al aprobar la solicitud')
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
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al rechazar la solicitud')
    },
  })

  const [signingId, setSigningId] = useState(null)

  const signMutation = useMutation({
    mutationFn: (id) => approvalService.signDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals'])
      setSigningId(null)
    },
    onError: (err) => {
      setSigningId(null)
      alert(err.response?.data?.error || 'Error al firmar el documento')
    }
  })

  const generateDocMutation = useMutation({
    mutationFn: (id) => certificationService.generateDocument(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['approvals'])
      queryClient.invalidateQueries(['approval-detail'])
      if (response.data?.data?.certification) {
        setSelectedRequest(prev => ({
          ...prev,
          document_uuid: response.data.data.certification.document_uuid,
          has_document: true,
          pdf_ready: true,
          status: response.data.data.certification.status
        }))
      }
    },
    onError: () => {
      // Error shown in CertificationDetailWithDocument via generateError prop
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
    if (window.confirm('Estas seguro de aprobar esta solicitud?')) {
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

  const handleSign = (request) => {
    setSigningId(request.id)
    signMutation.mutate(request.id)
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

  // Merge detail data with selected request
  const detailedRequest = detailData?.data?.data || selectedRequest

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestion de Aprobaciones</h1>
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
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vacation Requests */}
      {!isLoading && currentApprovals.vacation_requests?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Solicitudes de Vacaciones
          </h2>
          <VacationApprovalsTable
            requests={currentApprovals.vacation_requests}
            onApprove={handleApprove}
            onReject={handleReject}
            onView={handleView}
            onSign={handleSign}
            signingId={signingId}
            showActions={activeTab === 'pending'}
          />
        </div>
      )}

      {/* Certification Requests */}
      {!isLoading && currentApprovals.certification_requests?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Solicitudes de Certificacion
          </h2>
          <CertificationApprovalsTable
            requests={currentApprovals.certification_requests}
            onApprove={handleApprove}
            onReject={handleReject}
            onView={handleView}
            onSign={handleSign}
            signingId={signingId}
            showActions={activeTab === 'pending'}
          />
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
                  Todo al dia!
                </h3>
                <p className="text-gray-500">
                  No tienes solicitudes pendientes de aprobacion
                </p>
              </>
            ) : (
              <>
                <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Sin historial
                </h3>
                <p className="text-gray-500">
                  Aun no hay solicitudes procesadas
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
        size="xl"
      >
        {selectedRequest && selectedType === 'vacation' ? (
          <VacationDetailWithDocument
            request={detailedRequest}
            onClose={() => setShowDetailModal(false)}
            onApprove={(req) => { setShowDetailModal(false); handleApprove(req, 'vacation') }}
            onReject={(req) => { setShowDetailModal(false); handleReject(req, 'vacation') }}
          />
        ) : selectedRequest && selectedType === 'certification' ? (
          <CertificationDetailWithDocument
            request={detailedRequest}
            onClose={() => setShowDetailModal(false)}
            onApprove={(req) => { setShowDetailModal(false); handleApprove(req, 'certification') }}
            onReject={(req) => { setShowDetailModal(false); handleReject(req, 'certification') }}
            onGenerateDocument={(id) => generateDocMutation.mutate(id)}
            isGenerating={generateDocMutation.isPending}
            generateError={generateDocMutation.isError ? (generateDocMutation.error?.response?.data?.error || 'Error al generar documento') : null}
          />
        ) : null}
      </Modal>
    </div>
  )
}
