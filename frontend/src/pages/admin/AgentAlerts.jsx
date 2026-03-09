import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentAlertService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Info,
  Search,
  CheckCircle,
  CheckCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Activity,
  Server,
  Database,
  Wifi,
  WifiOff,
  Shield,
  Eye,
  Clock,
  Cpu,
} from 'lucide-react'

const alertTypeConfig = {
  critical: { color: 'bg-red-100 text-red-800 ring-red-600/10', icon: AlertOctagon, label: 'Critico' },
  warning: { color: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10', icon: AlertTriangle, label: 'Advertencia' },
  info: { color: 'bg-blue-100 text-blue-800 ring-blue-600/10', icon: Info, label: 'Info' },
}

const agentLabels = {
  service_health_agent: { label: 'Salud de Servicios', icon: Server },
  error_monitor_agent: { label: 'Monitor de Errores', icon: Activity },
  doc_validator_agent: { label: 'Validador de Docs', icon: Shield },
  signature_guardian_agent: { label: 'Guardian de Firmas', icon: Shield },
  request_tracker_agent: { label: 'Tracker de Solicitudes', icon: Clock },
  storage_sentinel_agent: { label: 'Sentinel de Storage', icon: Database },
  certification_auditor_agent: { label: 'Auditor de Certificaciones', icon: Shield },
}

const serviceIcons = {
  mongodb: Database,
  redis: Database,
  sidekiq: Cpu,
  rails_api: Server,
  vite_frontend: Activity,
  gotenberg: Server,
}

function formatTimeAgo(dateString) {
  if (!dateString) return '-'
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'ahora'
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`
  return `hace ${Math.floor(seconds / 86400)}d`
}

export default function AgentAlerts() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('health')
  const [filters, setFilters] = useState({ resolved: 'false', agent_id: '', alert_type: '', search: '', page: 1 })
  const [selectedAlert, setSelectedAlert] = useState(null)

  // Health check query
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['agent-health'],
    queryFn: () => agentAlertService.health().then(r => r.data.data),
    refetchInterval: 30000,
    enabled: tab === 'health',
  })

  // Summary query
  const { data: summaryData } = useQuery({
    queryKey: ['agent-alerts-summary'],
    queryFn: () => agentAlertService.summary().then(r => r.data.data),
    refetchInterval: 30000,
  })

  // Alerts list query
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['agent-alerts', filters],
    queryFn: () => agentAlertService.list(filters).then(r => r.data),
    enabled: tab === 'alerts',
  })

  // Alert detail query
  const { data: alertDetail } = useQuery({
    queryKey: ['agent-alert', selectedAlert],
    queryFn: () => agentAlertService.get(selectedAlert).then(r => r.data.data),
    enabled: !!selectedAlert,
  })

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: (id) => agentAlertService.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['agent-alerts-summary'] })
      setSelectedAlert(null)
    },
  })

  const resolveAllMutation = useMutation({
    mutationFn: (params) => agentAlertService.resolveAll(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['agent-alerts-summary'] })
    },
  })

  const alerts = alertsData?.data || []
  const meta = alertsData?.meta || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes Guardian</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitoreo de servicios y alertas del sistema
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {summaryData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.critical || 0}</p>
                  <p className="text-xs text-gray-500">Criticos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.warnings || 0}</p>
                  <p className="text-xs text-gray-500">Advertencias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.total_unresolved || 0}</p>
                  <p className="text-xs text-gray-500">Sin resolver</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Cpu className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryData.by_agent ? Object.keys(summaryData.by_agent).length : 0}
                  </p>
                  <p className="text-xs text-gray-500">Agentes activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setTab('health')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'health'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Server className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Salud de Servicios
          </button>
          <button
            onClick={() => setTab('alerts')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'alerts'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Alertas
            {summaryData?.total_unresolved > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {summaryData.total_unresolved}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Health Tab */}
      {tab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Estado de Servicios</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHealth()}
              disabled={healthLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${healthLoading ? 'animate-spin' : ''}`} />
              Verificar ahora
            </Button>
          </div>

          {healthLoading && !healthData ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-gray-400" />
              <p>Verificando servicios...</p>
            </div>
          ) : healthData ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {healthData.checks?.map((check, i) => {
                const ServiceIcon = serviceIcons[check.name] || serviceIcons[check.details?.service] || Server
                const serviceName = check.details?.service || check.name
                const isSkipped = check.details?.skipped

                return (
                  <Card key={i} className={`border-l-4 ${
                    isSkipped ? 'border-l-gray-300' :
                    check.passed ? 'border-l-green-500' : 'border-l-red-500'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <ServiceIcon className={`h-5 w-5 ${
                            isSkipped ? 'text-gray-400' :
                            check.passed ? 'text-green-600' : 'text-red-600'
                          }`} />
                          <span className="font-medium text-gray-900 capitalize">
                            {serviceName.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {isSkipped ? (
                          <span className="text-xs text-gray-400">Omitido</span>
                        ) : check.passed ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <Wifi className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                            <WifiOff className="h-3 w-3" /> Caido
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                        {check.details?.latency_ms != null && (
                          <p>Latencia: {check.details.latency_ms}ms</p>
                        )}
                        {check.details?.status_code != null && (
                          <p>HTTP: {check.details.status_code}</p>
                        )}
                        {check.details?.processes != null && (
                          <p>Procesos: {check.details.processes}</p>
                        )}
                        {check.details?.enqueued != null && (
                          <p>Encolados: {check.details.enqueued}</p>
                        )}
                        {check.details?.error && (
                          <p className="text-red-600 font-mono text-xs break-all">{check.details.error}</p>
                        )}
                        {check.details?.reason && (
                          <p className="text-gray-400 italic">{check.details.reason}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Server className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>No se pudo obtener el estado de los servicios.</p>
                <p className="text-xs mt-1">El backend debe estar ejecutandose para realizar health checks.</p>
                <p className="text-xs mt-2 font-mono bg-gray-50 p-2 rounded">
                  Usa <strong>bin/healthcheck</strong> para verificar sin depender del backend.
                </p>
              </CardContent>
            </Card>
          )}

          {healthData && (
            <div className="text-xs text-gray-400 text-right">
              Verificado: {healthData.checked_at ? new Date(healthData.checked_at).toLocaleString() : '-'}
              {healthData.duration_ms != null && ` (${healthData.duration_ms}ms)`}
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar alertas..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <Select
              value={filters.resolved}
              onChange={(e) => setFilters(f => ({ ...f, resolved: e.target.value, page: 1 }))}
              options={[
                { value: 'false', label: 'Sin resolver' },
                { value: 'true', label: 'Resueltas' },
                { value: '', label: 'Todas' },
              ]}
              className="w-36"
            />
            <Select
              value={filters.alert_type}
              onChange={(e) => setFilters(f => ({ ...f, alert_type: e.target.value, page: 1 }))}
              options={[
                { value: '', label: 'Todos los tipos' },
                { value: 'critical', label: 'Critico' },
                { value: 'warning', label: 'Advertencia' },
                { value: 'info', label: 'Info' },
              ]}
              className="w-40"
            />
            <Select
              value={filters.agent_id}
              onChange={(e) => setFilters(f => ({ ...f, agent_id: e.target.value, page: 1 }))}
              options={[
                { value: '', label: 'Todos los agentes' },
                ...Object.entries(agentLabels).map(([id, { label }]) => ({ value: id, label })),
              ]}
              className="w-48"
            />
            {filters.resolved === 'false' && alerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveAllMutation.mutate({
                  agent_id: filters.agent_id || undefined,
                  alert_type: filters.alert_type || undefined,
                })}
                disabled={resolveAllMutation.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-1.5" />
                Resolver todas
              </Button>
            )}
          </div>

          {/* Alerts list */}
          {alertsLoading ? (
            <div className="text-center py-12 text-gray-500">Cargando alertas...</div>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <CheckCircle className="h-8 w-8 mx-auto mb-3 text-green-400" />
                <p>No hay alertas {filters.resolved === 'false' ? 'sin resolver' : ''}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const typeConfig = alertTypeConfig[alert.alert_type] || alertTypeConfig.info
                const TypeIcon = typeConfig.icon
                const agentInfo = agentLabels[alert.agent_id] || { label: alert.agent_id, icon: Shield }
                const AgentIcon = agentInfo.icon

                return (
                  <Card key={alert.id} className={`transition-colors hover:bg-gray-50 ${alert.resolved ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg ${
                          alert.alert_type === 'critical' ? 'bg-red-100' :
                          alert.alert_type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                        }`}>
                          <TypeIcon className={`h-4 w-4 ${
                            alert.alert_type === 'critical' ? 'text-red-600' :
                            alert.alert_type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${typeConfig.color}`}>
                              {typeConfig.label}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              <AgentIcon className="h-3 w-3" />
                              {agentInfo.label}
                            </span>
                            {alert.occurrence_count > 1 && (
                              <span className="text-xs text-gray-400">
                                x{alert.occurrence_count}
                              </span>
                            )}
                            {alert.resolved && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" /> Resuelta
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-900">{alert.message}</p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {formatTimeAgo(alert.created_at)}
                            {alert.service && ` · ${alert.service}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {!alert.resolved && (
                            <button
                              onClick={() => resolveMutation.mutate(alert.id)}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                              title="Resolver"
                              disabled={resolveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {meta.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {meta.total} alerta{meta.total !== 1 ? 's' : ''} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                  disabled={filters.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  {meta.page} / {meta.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                  disabled={filters.page >= meta.total_pages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert Detail Modal */}
      <Modal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Detalle de Alerta"
        size="lg"
      >
        {alertDetail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Tipo</p>
                <p className="text-sm font-medium capitalize">{alertDetail.alert_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Agente</p>
                <p className="text-sm font-medium">{agentLabels[alertDetail.agent_id]?.label || alertDetail.agent_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Creada</p>
                <p className="text-sm">{alertDetail.created_at ? new Date(alertDetail.created_at).toLocaleString() : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ocurrencias</p>
                <p className="text-sm">{alertDetail.metadata?.occurrence_count || 1}</p>
              </div>
              {alertDetail.resolved && (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Resuelta</p>
                    <p className="text-sm">{alertDetail.resolved_at ? new Date(alertDetail.resolved_at).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Auto-resuelta</p>
                    <p className="text-sm">{alertDetail.metadata?.auto_resolved ? 'Si' : 'No'}</p>
                  </div>
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Mensaje</p>
              <p className="text-sm mt-1">{alertDetail.message}</p>
            </div>
            {alertDetail.metadata?.details && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Detalles</p>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-64 font-mono">
                  {JSON.stringify(alertDetail.metadata.details, null, 2)}
                </pre>
              </div>
            )}
            {!alertDetail.resolved && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => resolveMutation.mutate(alertDetail.id)}
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Resolver
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        )}
      </Modal>
    </div>
  )
}
