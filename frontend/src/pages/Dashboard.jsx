import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { vacationService, certificationService, approvalService, dashboardService } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Award,
  CheckSquare,
  Clock,
  FileText,
  ArrowRight,
  Plus
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

  const vacations = vacationsData?.data?.data || []
  const certifications = certificationsData?.data?.data || []
  const approvals = approvalsData?.data?.data || { vacation_requests: [], certification_requests: [] }
  const pendingCount = (approvals.vacation_requests?.length || 0) + (approvals.certification_requests?.length || 0)

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
    </div>
  )
}
