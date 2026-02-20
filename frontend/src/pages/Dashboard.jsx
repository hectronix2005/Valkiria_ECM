import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { renderAsync } from 'docx-preview'
import { useAuth, PERMISSION_LEVELS } from '../contexts/AuthContext'
import { vacationService, certificationService, approvalService, generatedDocumentService, contractService } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Award,
  CheckSquare,
  Clock,
  FileText,
  ArrowRight,
  Plus,
  FileSignature,
  Eye,
  Download,
  Edit,
  Briefcase,
  Users,
  FolderOpen
} from 'lucide-react'

function StatCard({ title, value, icon: Icon, color, subtitle, href, onClick }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  const content = (
    <Card className={href || onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}>
      <CardContent className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {(href || onClick) && <ArrowRight className="w-4 h-4 text-gray-400" />}
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link to={href}>{content}</Link>
  }
  if (onClick) {
    return <div onClick={onClick}>{content}</div>
  }
  return content
}

function QuickAction({ title, description, icon: Icon, href, color, onClick, state }) {
  const colors = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
  }

  const content = (
    <>
      <Icon className="w-8 h-8" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm opacity-80">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5" />
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-4 p-4 rounded-xl text-white transition-colors ${colors[color]} w-full text-left`}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      to={href}
      state={state}
      className={`flex items-center gap-4 p-4 rounded-xl text-white transition-colors ${colors[color]}`}
    >
      {content}
    </Link>
  )
}

function VacationProgressBar({ request }) {
  const status = request.status

  // Show for approved, in_progress, or enjoyed
  const showBar = ['approved', 'in_progress', 'enjoyed'].includes(status)
  if (!showBar) return null
  if (!request.start_date || !request.end_date) return null

  const start = new Date(request.start_date + 'T00:00:00')
  const end = new Date(request.end_date + 'T18:00:00') // Fin de jornada laboral 6PM
  const now = new Date()

  // Total duration in ms (from start midnight to end 6PM)
  const totalMs = end.getTime() - start.getTime()
  if (totalMs <= 0) return null

  let percent
  let label
  if (status === 'enjoyed' || now >= end) {
    percent = 100
    label = 'Disfrutada'
  } else if (now < start) {
    percent = 0
    label = 'Próximamente'
  } else {
    const elapsedMs = now.getTime() - start.getTime()
    percent = Math.min(Math.round((elapsedMs / totalMs) * 100), 100)
    // Calculate business days elapsed
    const todayDate = new Date(now)
    todayDate.setHours(0, 0, 0, 0)
    const startDate = new Date(request.start_date + 'T00:00:00')
    const daysElapsed = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    label = `Día ${daysElapsed} de ${request.days_requested}`
  }

  const barColor = percent === 100 ? 'bg-green-500' : 'bg-blue-500'

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] font-medium text-gray-500">{percent}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function RecentRequestCard({ request, type, onViewDocument }) {
  const isVacation = type === 'vacation'
  const Icon = isVacation ? Calendar : Award

  const formatShortDate = (dateStr) => {
    if (!dateStr) return ''
    // Append T12:00:00 to date-only strings to avoid UTC midnight timezone shift
    const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  }

  // Vacations: has_document + pdf_ready; Certifications: document_uuid + document_info.pdf_ready
  const hasDoc = isVacation
    ? (request.has_document && request.pdf_ready)
    : !!(request.document_uuid && request.document_info?.pdf_ready)

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="p-2 bg-white rounded-lg">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {isVacation ? `${request.days_requested} días` : request.certification_type}
          </p>
          <span className="text-xs text-gray-400">{request.request_number}</span>
        </div>
        {isVacation && request.start_date && (
          <p className="text-xs text-gray-600">
            {formatShortDate(request.start_date)} → {formatShortDate(request.end_date)}
          </p>
        )}
        <p className="text-xs text-gray-400">
          Solicitado: {formatShortDate(request.created_at)}
        </p>
        {isVacation && <VacationProgressBar request={request} />}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {hasDoc && onViewDocument && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDocument(request) }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Ver documento"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <Badge status={request.status} />
      </div>
    </div>
  )
}

function PendingSignatureCard({ document, onPreview, onSign }) {
  const pendingCount = document.signatures?.filter(s => s.status === 'pending')?.length || 0
  const completedCount = document.signatures?.filter(s => s.status === 'signed')?.length || 0
  const totalCount = document.signatures?.length || 0

  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
      <div className="p-2 bg-white rounded-lg">
        <FileSignature className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
        <p className="text-xs text-gray-500">
          {completedCount}/{totalCount} firmas completadas
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onPreview(document)}>
          <Eye className="w-4 h-4" />
        </Button>
        {document.can_sign && (
          <Button variant="primary" size="sm" onClick={() => onSign(document)}>
            <Edit className="w-4 h-4" />
            Firmar
          </Button>
        )}
      </div>
    </div>
  )
}

function ContractCard({ contract }) {
  return (
    <Link
      to={`/legal/contracts`}
      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="p-2 bg-white rounded-lg">
        <Briefcase className="w-4 h-4 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{contract.title}</p>
        <p className="text-xs text-gray-500">
          {contract.third_party?.name || 'Sin tercero'}
        </p>
      </div>
      <Badge status={contract.status} />
    </Link>
  )
}

export default function Dashboard() {
  const { user, isHR, isSupervisor, hasAdminAccess: isAdmin, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [previewDocument, setPreviewDocument] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Check if user has legal permissions
  const hasLegalAccess = hasPermission('legal') || hasPermission('contracts') ||
    (user?.permissions?.some(p => p.level >= PERMISSION_LEVELS.LEGAL)) || isAdmin

  const { data: vacationsData } = useQuery({
    queryKey: ['vacations', 'recent'],
    queryFn: () => vacationService.list({ per_page: 5 }),
  })

  const { data: certificationsData } = useQuery({
    queryKey: ['certifications', 'recent'],
    queryFn: () => certificationService.list({ per_page: 5 }),
  })

  const { data: approvalsData } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalService.list(),
    enabled: isHR || isSupervisor,
  })

  const { data: pendingSignaturesData } = useQuery({
    queryKey: ['pending-signatures'],
    queryFn: () => generatedDocumentService.pendingSignatures(),
  })

  const { data: contractsData } = useQuery({
    queryKey: ['contracts', 'recent'],
    queryFn: () => contractService.list({ per_page: 5 }),
    enabled: hasLegalAccess,
  })

  const vacations = vacationsData?.data?.data || []
  const certifications = certificationsData?.data?.data || []
  const approvals = approvalsData?.data?.data || { vacation_requests: [], certification_requests: [] }
  const pendingSignatures = pendingSignaturesData?.data?.data || []
  const contracts = contractsData?.data?.data || []
  const pendingApprovalCount = (approvals.vacation_requests?.length || 0) + (approvals.certification_requests?.length || 0)

  const [previewDocxBlob, setPreviewDocxBlob] = useState(null)
  const previewDocxRef = useRef(null)

  const handlePreview = async (document) => {
    setPreviewDocument(document)
    setPreviewLoading(true)
    setPreviewUrl(null)
    setPreviewDocxBlob(null)
    try {
      const response = await generatedDocumentService.download(document.id)
      const blob = response.data
      // Detect DOCX by PK zip header
      const header = await blob.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(header)
      const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4B
      if (isDocx) {
        setPreviewDocxBlob(blob)
      } else {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' })
        setPreviewUrl(URL.createObjectURL(pdfBlob))
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Render DOCX preview for pending signatures
  useEffect(() => {
    if (!previewDocxBlob || !previewDocxRef.current) return
    previewDocxRef.current.innerHTML = ''
    renderAsync(previewDocxBlob, previewDocxRef.current, null, {
      inWrapper: true, ignoreWidth: false, ignoreHeight: false, ignoreFonts: false,
      breakPages: true, ignoreLastRenderedPageBreak: false, experimental: true,
      trimXmlDeclaration: true, useBase64URL: true,
    }).catch(err => console.error('Error rendering DOCX:', err))
  }, [previewDocxBlob])

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewDocument(null)
    setPreviewUrl(null)
    setPreviewDocxBlob(null)
  }

  const handleSign = (document) => {
    navigate(`/documents/${document.id}/sign`)
  }

  const handleDownload = async () => {
    if (!previewDocument) return
    try {
      const response = await generatedDocumentService.download(previewDocument.id)
      const blob = response.data
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = previewDocument.file_name || `${previewDocument.name}.pdf`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading:', error)
    }
  }

  const [vacationPreviewUrl, setVacationPreviewUrl] = useState(null)
  const [vacationDocxBlob, setVacationDocxBlob] = useState(null)
  const [vacationDocxMetrics, setVacationDocxMetrics] = useState(null)
  const [vacationDocumentInfo, setVacationDocumentInfo] = useState(null)
  const [vacationPreviewLoading, setVacationPreviewLoading] = useState(null)
  const vacationDocxRef = useRef(null)

  const handleViewVacationDoc = async (vacation) => {
    setVacationPreviewLoading(vacation.id)
    setVacationPreviewUrl(null)
    setVacationDocxBlob(null)
    setVacationDocxMetrics(null)
    setVacationDocumentInfo(null)
    try {
      // Fetch document info with signatures in parallel with download
      const [docResponse, detailResponse] = await Promise.all([
        vacationService.downloadDocument(vacation.id),
        vacationService.get(vacation.id),
      ])
      setVacationDocumentInfo(detailResponse.data?.document)
      const blob = docResponse.data
      // Detect DOCX by PK zip header
      const header = await blob.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(header)
      const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4B
      if (isDocx) {
        setVacationDocxBlob(blob)
      } else {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' })
        setVacationPreviewUrl(URL.createObjectURL(pdfBlob))
      }
    } catch (error) {
      console.error('Error loading vacation document:', error)
      alert('Error al cargar el documento')
    } finally {
      setVacationPreviewLoading(null)
    }
  }

  // Render DOCX with docx-preview and calculate metrics for signature overlay
  useEffect(() => {
    if (!vacationDocxBlob || !vacationDocxRef.current) return
    vacationDocxRef.current.innerHTML = ''
    setVacationDocxMetrics(null)
    renderAsync(vacationDocxBlob, vacationDocxRef.current, null, {
      inWrapper: true, ignoreWidth: false, ignoreHeight: false, ignoreFonts: false,
      breakPages: true, ignoreLastRenderedPageBreak: false, experimental: true,
      trimXmlDeclaration: true, useBase64URL: true,
    }).then(() => {
      const section = vacationDocxRef.current?.querySelector('section.docx')
      if (section) {
        const container = vacationDocxRef.current
        const sectionRect = section.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setVacationDocxMetrics({
          offsetLeft: sectionRect.left - containerRect.left + container.scrollLeft,
          offsetTop: sectionRect.top - containerRect.top + container.scrollTop,
          scale: sectionRect.width / 612,
        })
      }
    }).catch(err => console.error('Error rendering DOCX:', err))
  }, [vacationDocxBlob])

  const handleCloseVacationPreview = () => {
    if (vacationPreviewUrl) URL.revokeObjectURL(vacationPreviewUrl)
    setVacationPreviewUrl(null)
    setVacationDocxBlob(null)
    setVacationDocxMetrics(null)
    setVacationDocumentInfo(null)
  }

  // --- Certification document preview ---
  const [certPreviewUrl, setCertPreviewUrl] = useState(null)
  const [certDocxBlob, setCertDocxBlob] = useState(null)
  const [certDocxMetrics, setCertDocxMetrics] = useState(null)
  const [certDocumentInfo, setCertDocumentInfo] = useState(null)
  const [certPreviewLoading, setCertPreviewLoading] = useState(null)
  const certDocxRef = useRef(null)

  const handleViewCertificationDoc = async (certification) => {
    setCertPreviewLoading(certification.id)
    setCertPreviewUrl(null)
    setCertDocxBlob(null)
    setCertDocxMetrics(null)
    setCertDocumentInfo(null)
    try {
      // Fetch document blob and detail in parallel
      const [docResponse, detailResponse] = await Promise.all([
        certificationService.downloadDocument(certification.id),
        certificationService.get(certification.id),
      ])
      // Extract document_info from detail response
      const detailData = detailResponse.data?.data
      setCertDocumentInfo(detailData?.document_info || null)

      const blob = docResponse.data
      // Detect DOCX by PK zip header
      const header = await blob.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(header)
      const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4B
      if (isDocx) {
        setCertDocxBlob(blob)
      } else {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' })
        setCertPreviewUrl(URL.createObjectURL(pdfBlob))
      }
    } catch (error) {
      console.error('Error loading certification document:', error)
      const errMsg = error.response?.data?.error || 'Error al cargar el documento'
      alert(errMsg)
    } finally {
      setCertPreviewLoading(null)
    }
  }

  // Render certification DOCX with docx-preview
  useEffect(() => {
    if (!certDocxBlob || !certDocxRef.current) return
    certDocxRef.current.innerHTML = ''
    setCertDocxMetrics(null)
    renderAsync(certDocxBlob, certDocxRef.current, null, {
      inWrapper: true, ignoreWidth: false, ignoreHeight: false, ignoreFonts: false,
      breakPages: true, ignoreLastRenderedPageBreak: false, experimental: true,
      trimXmlDeclaration: true, useBase64URL: true,
    }).then(() => {
      const section = certDocxRef.current?.querySelector('section.docx')
      if (section) {
        const container = certDocxRef.current
        const sectionRect = section.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setCertDocxMetrics({
          offsetLeft: sectionRect.left - containerRect.left + container.scrollLeft,
          offsetTop: sectionRect.top - containerRect.top + container.scrollTop,
          scale: sectionRect.width / 612,
        })
      }
    }).catch(err => console.error('Error rendering certification DOCX:', err))
  }, [certDocxBlob])

  const handleCloseCertPreview = () => {
    if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl)
    setCertPreviewUrl(null)
    setCertDocxBlob(null)
    setCertDocxMetrics(null)
    setCertDocumentInfo(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenid@, {user?.first_name}
        </h1>
        <p className="text-gray-500">
          Aquí tienes un resumen de tu actividad
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Días de vacaciones"
          value={Math.floor(user?.vacation?.days_available ?? 0)}
          icon={Calendar}
          color="blue"
          subtitle={user?.vacation?.days_pending > user?.vacation?.days_available
            ? `${Math.floor(user?.vacation?.days_pending)} pendientes`
            : "Disponibles"
          }
          href="/hr/my-requests/vacations"
        />
        <StatCard
          title="Solicitudes pendientes"
          value={vacations.filter(v => v.status === 'pending').length}
          icon={Clock}
          color="yellow"
          href="/hr/my-requests/vacations"
        />
        {(isHR || isSupervisor) && (
          <StatCard
            title="Por aprobar"
            value={pendingApprovalCount}
            icon={CheckSquare}
            color="green"
            href="/hr/approvals"
          />
        )}
        <StatCard
          title="Certificaciones"
          value={certifications.filter(c => c.status === 'completed').length}
          icon={Award}
          color="purple"
          subtitle="Completadas"
          href="/hr/my-requests/certifications"
        />
        {pendingSignatures.length > 0 && (
          <StatCard
            title="Firmas pendientes"
            value={pendingSignatures.length}
            icon={FileSignature}
            color="orange"
            subtitle="Documentos por firmar"
            href="/documents"
          />
        )}
        {hasLegalAccess && (
          <StatCard
            title="Contratos"
            value={contracts.length}
            icon={Briefcase}
            color="indigo"
            subtitle="Activos"
            href="/legal/contracts"
          />
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <QuickAction
              title="Nueva Solicitud de Vacaciones"
              description="Solicita días libres"
              icon={Calendar}
              href="/hr/my-requests/vacations"
              state={{ openNew: true }}
              color="blue"
            />
            <QuickAction
              title="Solicitar Certificación"
              description="Certificado laboral"
              icon={Award}
              href="/hr/my-requests/certifications"
              state={{ openNew: true }}
              color="green"
            />
            <QuickAction
              title="Mis Documentos"
              description="Ver y firmar documentos"
              icon={FileText}
              href="/documents"
              color="purple"
            />
            {hasLegalAccess && (
              <QuickAction
                title="Gestión de Contratos"
                description="Contratos y terceros"
                icon={Briefcase}
                href="/legal/contracts"
                color="indigo"
              />
            )}
            {(isHR || isSupervisor) && (
              <QuickAction
                title="Aprobar Solicitudes"
                description={`${pendingApprovalCount} pendientes`}
                icon={CheckSquare}
                href="/hr/approvals"
                color="orange"
              />
            )}
            {isHR && (
              <QuickAction
                title="Gestión de Empleados"
                description="Administrar personal"
                icon={Users}
                href="/hr/employees"
                color="blue"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Signatures Section */}
      {pendingSignatures.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-amber-500" />
              Documentos Pendientes de tu Firma
            </CardTitle>
            <Link to="/documents">
              <Button variant="ghost" size="sm">
                Ver todos
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingSignatures.slice(0, 5).map((doc) => (
                <PendingSignatureCard
                  key={doc.id}
                  document={doc}
                  onPreview={handlePreview}
                  onSign={handleSign}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two/Three columns layout */}
      <div className={`grid grid-cols-1 ${hasLegalAccess ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
        {/* Recent Vacations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mis Solicitudes de Vacaciones</CardTitle>
            <Link to="/hr/my-requests/vacations">
              <Button variant="ghost" size="sm">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {vacations.length > 0 ? (
              <div className="space-y-2">
                {vacations.slice(0, 5).map((vacation) => (
                  <RecentRequestCard key={vacation.id} request={vacation} type="vacation" onViewDocument={handleViewVacationDoc} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No tienes solicitudes de vacaciones</p>
                <Link to="/hr/my-requests/vacations">
                  <Button variant="primary" size="sm" className="mt-4">
                    <Plus className="w-4 h-4" />
                    Nueva Solicitud
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals (for supervisors/HR) OR Recent Certifications */}
        {(isHR || isSupervisor) ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pendientes de Aprobación</CardTitle>
              <Link to="/hr/approvals">
                <Button variant="ghost" size="sm">
                  Ver todas
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {pendingApprovalCount > 0 ? (
                <div className="space-y-2">
                  {approvals.vacation_requests?.slice(0, 3).map((req) => (
                    <Link
                      key={req.id}
                      to="/hr/approvals"
                      className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors"
                    >
                      <Calendar className="w-5 h-5 text-yellow-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{req.employee?.name}</p>
                        <p className="text-xs text-gray-500">{req.days_requested} días</p>
                      </div>
                      <Badge status="pending" />
                    </Link>
                  ))}
                  {approvals.certification_requests?.slice(0, 2).map((req) => (
                    <Link
                      key={req.id}
                      to="/hr/approvals"
                      className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors"
                    >
                      <Award className="w-5 h-5 text-yellow-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{req.employee?.name}</p>
                        <p className="text-xs text-gray-500">Certificación {req.certification_type}</p>
                      </div>
                      <Badge status="pending" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No hay solicitudes pendientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Recent Certifications for regular employees */
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mis Certificaciones</CardTitle>
              <Link to="/hr/my-requests/certifications">
                <Button variant="ghost" size="sm">
                  Ver todas
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {certifications.length > 0 ? (
                <div className="space-y-2">
                  {certifications.slice(0, 5).map((cert) => (
                    <RecentRequestCard key={cert.id} request={cert} type="certification" onViewDocument={handleViewCertificationDoc} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Award className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No tienes certificaciones solicitadas</p>
                  <Link to="/hr/my-requests/certifications">
                    <Button variant="primary" size="sm" className="mt-4">
                      <Plus className="w-4 h-4" />
                      Nueva Certificación
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Contracts (for legal users) */}
        {hasLegalAccess && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contratos Recientes</CardTitle>
              <Link to="/legal/contracts">
                <Button variant="ghost" size="sm">
                  Ver todos
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {contracts.length > 0 ? (
                <div className="space-y-2">
                  {contracts.slice(0, 5).map((contract) => (
                    <ContractCard key={contract.id} contract={contract} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No hay contratos recientes</p>
                  <Link to="/legal/contracts">
                    <Button variant="primary" size="sm" className="mt-4">
                      <Plus className="w-4 h-4" />
                      Nuevo Contrato
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!previewDocument}
        onClose={handleClosePreview}
        title={previewDocument?.name || 'Vista Previa'}
        size="xl"
      >
        <div className="space-y-4">
          {previewLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-[70vh] border rounded-lg"
              title="Document Preview"
            />
          ) : previewDocxBlob ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
              </div>
              <div className="relative max-h-[70vh] overflow-auto bg-white">
                <div ref={previewDocxRef} style={{ position: 'relative' }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-gray-500">
              No se pudo cargar el documento
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              {previewDocument?.signatures && (
                <span>
                  {previewDocument.signatures.filter(s => s.status === 'signed').length}/
                  {previewDocument.signatures.length} firmas completadas
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
              {previewDocument?.can_sign && (
                <Button variant="primary" onClick={() => {
                  handleClosePreview()
                  handleSign(previewDocument)
                }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Firmar Documento
                </Button>
              )}
              <Button variant="ghost" onClick={handleClosePreview}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Vacation Document Preview Modal */}
      <Modal
        isOpen={!!(vacationPreviewUrl || vacationDocxBlob)}
        onClose={handleCloseVacationPreview}
        title="Documento de Vacaciones"
        size="full"
      >
        <div className="space-y-4">
          {vacationPreviewUrl ? (
            <iframe
              src={vacationPreviewUrl}
              className="w-full h-[70vh] border rounded-lg bg-gray-100"
              title="Vista previa del documento"
            />
          ) : vacationDocxBlob ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
              </div>
              <div className="relative max-h-[70vh] overflow-auto bg-white">
                <div ref={vacationDocxRef} style={{ position: 'relative' }} />
                {vacationDocxMetrics && vacationDocumentInfo?.signatures?.filter(s => s.signed && s.signature_image && s.position_box).map((sig, idx) => {
                  const box = sig.position_box
                  const m = vacationDocxMetrics
                  return (
                    <div key={idx} style={{
                      position: 'absolute',
                      left: m.offsetLeft + box.x * m.scale,
                      top: m.offsetTop + box.y * m.scale,
                      width: box.width * m.scale,
                      height: box.height * m.scale,
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}>
                      <img
                        src={sig.signature_image.startsWith('data:') ? sig.signature_image : `data:image/png;base64,${sig.signature_image}`}
                        alt={`Firma de ${sig.signed_by}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="ghost" onClick={handleCloseVacationPreview}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Certification Document Preview Modal */}
      <Modal
        isOpen={!!(certPreviewUrl || certDocxBlob)}
        onClose={handleCloseCertPreview}
        title="Documento de Certificación"
        size="full"
      >
        <div className="space-y-4">
          {certPreviewUrl ? (
            <iframe
              src={certPreviewUrl}
              className="w-full h-[70vh] border rounded-lg bg-gray-100"
              title="Vista previa del documento"
            />
          ) : certDocxBlob ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Vista Previa del Documento</span>
              </div>
              <div className="relative max-h-[70vh] overflow-auto bg-white">
                <div ref={certDocxRef} style={{ position: 'relative' }} />
              </div>
            </div>
          ) : null}
          {/* Signature status */}
          {certDocumentInfo && (
            <div className="flex items-center gap-4 pt-3 text-sm text-gray-500">
              {certDocumentInfo.completed_signatures?.length > 0 && (
                <span className="text-green-600">
                  Firmado: {certDocumentInfo.completed_signatures.join(', ')}
                </span>
              )}
              {certDocumentInfo.pending_signatures?.length > 0 && (
                <span className="text-amber-600">
                  Pendiente: {certDocumentInfo.pending_signatures.join(', ')}
                </span>
              )}
            </div>
          )}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="ghost" onClick={handleCloseCertPreview}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
