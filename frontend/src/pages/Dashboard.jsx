import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { vacationService, certificationService, approvalService, dashboardService, generatedDocumentService, signatureService } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Award,
  CheckSquare,
  Clock,
  TrendingUp,
  Users,
  FileText,
  ArrowRight,
  Plus,
  PenTool,
  FileCheck,
  AlertTriangle,
  X,
  Eye,
  Download,
  User,
  Building
} from 'lucide-react'

function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function QuickAction({ title, description, icon: Icon, href, color }) {
  const colors = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
  }

  return (
    <Link
      to={href}
      className={`flex items-center gap-4 p-4 rounded-xl text-white transition-colors ${colors[color]}`}
    >
      <Icon className="w-8 h-8" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm opacity-80">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5" />
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

export default function Dashboard() {
  const { user, isHR, isSupervisor } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showNoSignatureModal, setShowNoSignatureModal] = useState(false)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

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

  const { data: hrStatsData } = useQuery({
    queryKey: ['hr', 'dashboard'],
    queryFn: () => dashboardService.getStats(),
    enabled: isHR,
  })

  // Documents pending user's signature
  const { data: pendingDocsData } = useQuery({
    queryKey: ['documents', 'pending_signatures'],
    queryFn: () => generatedDocumentService.pendingSignatures(),
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

  const handleSign = (doc) => {
    // First check if user has a digital signature configured
    if (!doc.user_has_digital_signature && !hasActiveSignature()) {
      setShowNoSignatureModal(true)
      return
    }
    // If blocked by sequential signing, show alert with waiting info
    if (!doc.can_sign && doc.has_pending_signature) {
      const userSig = doc.signatures?.find(s => s.status === 'pending' && s.waiting_for?.length > 0)
      if (userSig?.waiting_for?.length > 0) {
        alert(`Debes esperar las firmas de: ${userSig.waiting_for.join(', ')}`)
        return
      }
    }
    signMutation.mutate(doc.id)
  }

  const signMutation = useMutation({
    mutationFn: (id) => generatedDocumentService.sign(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', 'pending_signatures'])
      alert('Documento firmado exitosamente')
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al firmar el documento')
    }
  })

  // Preview document handlers
  const handlePreview = async (doc) => {
    setPreviewDoc(doc)
    setPreviewLoading(true)
    try {
      const response = await generatedDocumentService.download(doc.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Error loading preview:', error)
      alert('Error al cargar la vista previa del documento')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setPreviewDoc(null)
  }

  const handleDownload = async (doc) => {
    try {
      const response = await generatedDocumentService.download(doc.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name || 'documento.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading:', error)
      alert('Error al descargar el documento')
    }
  }

  const vacations = vacationsData?.data?.data || []
  const certifications = certificationsData?.data?.data || []
  const approvals = approvalsData?.data?.data || { vacation_requests: [], certification_requests: [] }
  const pendingCount = (approvals.vacation_requests?.length || 0) + (approvals.certification_requests?.length || 0)
  const pendingDocs = pendingDocsData?.data?.data || []

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
            ? `${Math.floor(user?.vacation?.days_pending)} pendientes (máx. acumulable: ${user?.vacation?.max_accumulation_days})`
            : "Disponibles"
          }
        />
        <StatCard
          title="Solicitudes pendientes"
          value={vacations.filter(v => v.status === 'pending').length}
          icon={Clock}
          color="yellow"
        />
        {(isHR || isSupervisor) && (
          <StatCard
            title="Por aprobar"
            value={pendingCount}
            icon={CheckSquare}
            color="green"
          />
        )}
        <StatCard
          title="Certificaciones"
          value={certifications.filter(c => c.status === 'completed').length}
          icon={Award}
          color="purple"
          subtitle="Completadas este año"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickAction
              title="Nueva Solicitud de Vacaciones"
              description="Solicita días libres"
              icon={Calendar}
              href="/hr/vacations/new"
              color="blue"
            />
            <QuickAction
              title="Solicitar Certificación"
              description="Certificado laboral"
              icon={Award}
              href="/hr/certifications/new"
              color="green"
            />
            <QuickAction
              title="Explorar Documentos"
              description="Busca y gestiona archivos"
              icon={FileText}
              href="/documents"
              color="purple"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pending Signatures - shown to all users when they have documents to sign */}
      {pendingDocs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <PenTool className="w-5 h-5" />
              Documentos Pendientes de tu Firma
            </CardTitle>
            <Badge variant="warning">{pendingDocs.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDocs.map((doc) => (
                <div key={doc.id} className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                  {/* Document Header */}
                  <div className="flex items-start gap-4 p-4">
                    <div className="p-3 bg-amber-100 rounded-lg flex-shrink-0">
                      <FileCheck className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{doc.name}</p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span>{doc.template_name || 'Documento'}</span>
                        </div>
                        {doc.employee_name && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{doc.employee_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{new Date(doc.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <PenTool className="w-4 h-4 text-gray-400" />
                          <span>
                            {doc.completed_signatures_count || 0}/{doc.total_required_signatures || 0} firmas
                          </span>
                        </div>
                      </div>

                      {/* Signatures Progress */}
                      {doc.signatures && doc.signatures.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Estado de firmas:</p>
                          <div className="flex flex-wrap gap-2">
                            {doc.signatures.map((sig, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                  sig.status === 'signed'
                                    ? 'bg-green-100 text-green-700'
                                    : sig.user_id === user?.id?.toString()
                                    ? 'bg-amber-100 text-amber-700 font-medium'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {sig.status === 'signed' ? (
                                  <CheckSquare className="w-3 h-3" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                {sig.label || sig.signatory_label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Waiting message */}
                      {doc.signatures?.find(s => s.user_id === user?.id?.toString() && s.status === 'pending' && s.waiting_for?.length > 0) && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Esperando: {doc.signatures.find(s => s.user_id === user?.id?.toString())?.waiting_for?.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 px-4 py-3 bg-gray-50 border-t border-amber-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePreview(doc)}
                      title="Ver documento"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      title="Descargar documento"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSign(doc)}
                      loading={signMutation.isPending}
                      disabled={doc.signatures?.find(s => s.user_id === user?.id?.toString() && s.waiting_for?.length > 0)}
                    >
                      <PenTool className="w-4 h-4" />
                      Firmar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Vacations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mis Solicitudes de Vacaciones</CardTitle>
            <Link to="/hr/vacations">
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
                <Link to="/hr/vacations/new">
                  <Button variant="primary" size="sm" className="mt-4">
                    <Plus className="w-4 h-4" />
                    Nueva Solicitud
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals (for supervisors/HR) */}
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
              {pendingCount > 0 ? (
                <div className="space-y-2">
                  {approvals.vacation_requests?.slice(0, 3).map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <Calendar className="w-5 h-5 text-yellow-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{req.employee?.name}</p>
                        <p className="text-xs text-gray-500">{req.days_requested} días</p>
                      </div>
                      <Badge status="pending" />
                    </div>
                  ))}
                  {approvals.certification_requests?.slice(0, 2).map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <Award className="w-5 h-5 text-yellow-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{req.employee?.name}</p>
                        <p className="text-xs text-gray-500">Certificación {req.certification_type}</p>
                      </div>
                      <Badge status="pending" />
                    </div>
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
              <Link to="/hr/certifications">
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
                  <Link to="/hr/certifications/new">
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
      </div>

      {/* No Signature Modal */}
      {showNoSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Firma Digital Requerida</h3>
              <button onClick={() => setShowNoSignatureModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
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
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">{previewDoc.name}</h3>
                <p className="text-sm text-gray-500">
                  {previewDoc.template_name}
                  {previewDoc.employee_name && ` • ${previewDoc.employee_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownload(previewDoc)}
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleClosePreview()
                    handleSign(previewDoc)
                  }}
                  disabled={previewDoc.signatures?.find(s => s.user_id === user?.id?.toString() && s.waiting_for?.length > 0)}
                >
                  <PenTool className="w-4 h-4" />
                  Firmar
                </Button>
                <button
                  onClick={handleClosePreview}
                  className="p-2 hover:bg-gray-100 rounded-lg ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Info Bar */}
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-4 text-sm flex-shrink-0">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                {new Date(previewDoc.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <PenTool className="w-4 h-4" />
                {previewDoc.completed_signatures_count || 0}/{previewDoc.total_required_signatures || 0} firmas completadas
              </div>
              {previewDoc.signatures && (
                <div className="flex items-center gap-2 ml-auto">
                  {previewDoc.signatures.map((sig, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                        sig.status === 'signed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sig.status === 'signed' ? <CheckSquare className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {sig.label || sig.signatory_label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Cargando documento...</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Vista previa del documento"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No se pudo cargar el documento</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
