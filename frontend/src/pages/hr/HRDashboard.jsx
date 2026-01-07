import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  AlertCircle,
  Building,
  TrendingUp,
  Palmtree,
  Award
} from 'lucide-react'

function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  }

  const iconColors = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
  }

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600">{trend}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            <Icon className={`w-6 h-6 ${iconColors[color]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DepartmentChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay datos de departamentos
      </div>
    )
  }

  const total = Object.values(data).reduce((a, b) => a + b, 0)
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-yellow-500',
    'bg-red-500',
  ]

  const departmentLabels = {
    engineering: 'Ingenieria',
    hr: 'Recursos Humanos',
    finance: 'Finanzas',
    sales: 'Ventas',
    marketing: 'Marketing',
    operations: 'Operaciones',
    legal: 'Legal',
  }

  return (
    <div className="space-y-3">
      {Object.entries(data).map(([dept, count], index) => {
        const percentage = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={dept} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{departmentLabels[dept] || dept}</span>
              <span className="font-medium">{count} ({percentage.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[index % colors.length]} rounded-full transition-all`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function HRDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: async () => {
      const response = await dashboardService.getStats()
      return response.data.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-red-600">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="text-lg font-medium">Error al cargar el dashboard</p>
        <p className="text-sm text-gray-500 mt-1">{error.message}</p>
      </div>
    )
  }

  const { employees, vacation_requests, certification_requests } = data || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard HR</h1>
        <p className="text-gray-500 mt-1">Resumen de recursos humanos</p>
      </div>

      {/* Employee Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Empleados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Empleados"
            value={employees?.total || 0}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Activos"
            value={employees?.active || 0}
            subtitle={employees?.total ? `${((employees.active / employees.total) * 100).toFixed(0)}% del total` : null}
            icon={UserCheck}
            color="green"
          />
          <StatCard
            title="En Licencia"
            value={employees?.on_leave || 0}
            icon={UserX}
            color="yellow"
          />
          <StatCard
            title="Departamentos"
            value={Object.keys(employees?.by_department || {}).length}
            icon={Building}
            color="purple"
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vacation Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-green-600" />
              Solicitudes de Vacaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-yellow-700">Pendientes</span>
                </div>
                <p className="text-2xl font-bold text-yellow-800 mt-2">
                  {vacation_requests?.pending || 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700">Aprobadas (Año)</span>
                </div>
                <p className="text-2xl font-bold text-green-800 mt-2">
                  {vacation_requests?.approved_this_year || 0}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-red-700">Rechazadas (Año)</span>
                </div>
                <p className="text-2xl font-bold text-red-800 mt-2">
                  {vacation_requests?.rejected_this_year || 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-700">De vacaciones hoy</span>
                </div>
                <p className="text-2xl font-bold text-blue-800 mt-2">
                  {vacation_requests?.employees_on_vacation_today || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certification Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Certificaciones Laborales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-yellow-700">Pendientes</span>
                </div>
                <p className="text-2xl font-bold text-yellow-800 mt-2">
                  {certification_requests?.pending || 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-700">Procesando</span>
                </div>
                <p className="text-2xl font-bold text-blue-800 mt-2">
                  {certification_requests?.processing || 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700">Completadas (Año)</span>
                </div>
                <p className="text-2xl font-bold text-green-800 mt-2">
                  {certification_requests?.completed_this_year || 0}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-purple-700">Tiempo promedio</span>
                </div>
                <p className="text-2xl font-bold text-purple-800 mt-2">
                  {certification_requests?.average_processing_days
                    ? `${certification_requests.average_processing_days.toFixed(1)} dias`
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-600" />
            Distribucion por Departamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentChart data={employees?.by_department} />
        </CardContent>
      </Card>
    </div>
  )
}
