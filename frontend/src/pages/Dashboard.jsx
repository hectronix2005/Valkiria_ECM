import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

function QuickAction({ title, description, icon: Icon, href, color, onClick }) {
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
      className={`flex items-center gap-4 p-4 rounded-xl text-white transition-colors ${colors[color]}`}
    >
      {content}
    </Link>
  )
}

function RecentRequestCard({ request, type }) {
  const isVacation = type === 'vacation'
  const Icon = isVacation ? Calendar : Award

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="p-2 bg-white rounded-lg">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {isVacation ? `${request.days_requested} días` : request.certification_type}
        </p>
        <p className="text-xs text-gray-500">
          {request.request_number}
        </p>
      </div>
      <Badge status={request.status} />
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
  const { user, isHR, isSupervisor, isAdmin, hasPermission } = useAuth()
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

  const handlePreview = async (document) => {
    setPreviewDocument(document)
    setPreviewLoading(true)
    try {
      const response = await generatedDocumentService.download(document.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewDocument(null)
    setPreviewUrl(null)
  }

  const handleSign = (document) => {
    navigate(`/documents/${document.id}/sign`)
  }

  const handleDownload = async () => {
    if (!previewDocument) return
    try {
      const response = await generatedDocumentService.download(previewDocument.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {user?.first_name}
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
              color="blue"
            />
            <QuickAction
              title="Solicitar Certificación"
              description="Certificado laboral"
              icon={Award}
              href="/hr/my-requests/certifications"
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
                  <RecentRequestCard key={vacation.id} request={vacation} type="vacation" />
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
                    <RecentRequestCard key={cert.id} request={cert} type="certification" />
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
    </div>
  )
}
