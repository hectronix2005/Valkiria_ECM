import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { errorLogService } from '../../services/api'
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
  Clock,
  Globe,
  User,
  Monitor,
  Hash,
  Shield,
  FileX,
  XCircle,
  Activity,
  Zap,
} from 'lucide-react'

const severityConfig = {
  fatal: { color: 'bg-red-100 text-red-800', icon: AlertOctagon, label: 'Fatal' },
  error: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Error' },
  warning: { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle, label: 'Warning' },
  info: { color: 'bg-blue-100 text-blue-800', icon: Info, label: 'Info' },
}

const eventTypeConfig = {
  exception: { color: 'bg-red-50 text-red-700 ring-red-600/10', label: 'Excepcion', icon: Zap },
  process_failure: { color: 'bg-orange-50 text-orange-700 ring-orange-600/10', label: 'Proceso fallido', icon: XCircle },
  validation_error: { color: 'bg-yellow-50 text-yellow-700 ring-yellow-600/10', label: 'Validacion', icon: AlertTriangle },
  auth_failure: { color: 'bg-purple-50 text-purple-700 ring-purple-600/10', label: 'Autorizacion', icon: Shield },
  not_found: { color: 'bg-gray-50 text-gray-700 ring-gray-600/10', label: 'No encontrado', icon: FileX },
  api_error: { color: 'bg-blue-50 text-blue-700 ring-blue-600/10', label: 'API Error', icon: Activity },
  frontend_error: { color: 'bg-pink-50 text-pink-700 ring-pink-600/10', label: 'Frontend', icon: Monitor },
}

const sourceOptions = [
  { value: '', label: 'Todas las fuentes' },
  { value: 'controller', label: 'Controller' },
  { value: 'service', label: 'Service' },
  { value: 'job', label: 'Job' },
  { value: 'middleware', label: 'Middleware' },
  { value: 'frontend', label: 'Frontend' },
]

const sourceConfig = {
  controller: { color: 'bg-blue-100 text-blue-700', label: 'Controller' },
  service: { color: 'bg-green-100 text-green-700', label: 'Service' },
  job: { color: 'bg-amber-100 text-amber-700', label: 'Job' },
  middleware: { color: 'bg-gray-100 text-gray-700', label: 'Middleware' },
  frontend: { color: 'bg-pink-100 text-pink-700', label: 'Frontend' },
}

const severityOptions = [
  { value: '', label: 'Todas las severidades' },
  { value: 'fatal', label: 'Fatal' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
]

const eventTypeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'exception', label: 'Excepciones' },
  { value: 'process_failure', label: 'Procesos fallidos' },
  { value: 'validation_error', label: 'Errores de validacion' },
  { value: 'auth_failure', label: 'Fallos de autorizacion' },
  { value: 'not_found', label: 'No encontrado' },
  { value: 'api_error', label: 'Errores API' },
  { value: 'frontend_error', label: 'Frontend' },
]

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'false', label: 'Pendientes' },
  { value: 'true', label: 'Resueltos' },
]

function SeverityBadge({ severity }) {
  const config = severityConfig[severity] || severityConfig.error
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

function EventTypeBadge({ eventType }) {
  const config = eventTypeConfig[eventType] || eventTypeConfig.api_error
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${config.color}`}>
      {config.label}
    </span>
  )
}

function SourceBadge({ source }) {
  const config = sourceConfig[source] || { color: 'bg-gray-100 text-gray-600', label: source || 'unknown' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

function HttpStatusBadge({ status }) {
  if (!status) return null
  let color = 'bg-gray-100 text-gray-600'
  if (status >= 500) color = 'bg-red-100 text-red-700'
  else if (status >= 400) color = 'bg-yellow-100 text-yellow-700'
  else if (status >= 300) color = 'bg-blue-100 text-blue-700'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium ${color}`}>
      {status}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, color = 'text-gray-600' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${color} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function ErrorLogs() {
  const queryClient = useQueryClient()
  const [selectedLog, setSelectedLog] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    severity: '',
    source: '',
    event_type: '',
    resolved: 'false',
    date_from: '',
    date_to: '',
    page: 1,
    per_page: 25,
  })

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput, page: 1 }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Auto-refresh every 30 seconds
  const { data: statsData } = useQuery({
    queryKey: ['error-log-stats'],
    queryFn: () => errorLogService.stats(),
    refetchInterval: 30000,
  })

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['error-logs', filters],
    queryFn: () => errorLogService.list(filters),
    refetchInterval: 30000,
  })

  const { data: detailData } = useQuery({
    queryKey: ['error-log-detail', selectedLog],
    queryFn: () => errorLogService.get(selectedLog),
    enabled: !!selectedLog,
  })

  const resolveMutation = useMutation({
    mutationFn: (id) => errorLogService.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] })
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] })
      queryClient.invalidateQueries({ queryKey: ['error-log-detail'] })
    },
  })

  const resolveAllMutation = useMutation({
    mutationFn: () => errorLogService.resolveAll({
      severity: filters.severity || undefined,
      source: filters.source || undefined,
      event_type: filters.event_type || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] })
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] })
    },
  })

  const stats = statsData?.data?.data || {}
  const logs = logsData?.data?.data || []
  const meta = logsData?.data?.meta || {}
  const detail = detailData?.data?.data || null
  const byEventType = stats.by_event_type || {}

  const updateFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value, page: 1 }))
  }

  const formatDate = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('es', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Logs</h1>
          <p className="text-gray-500">Monitor de errores y procesos del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['error-logs'] })
              queryClient.invalidateQueries({ queryKey: ['error-log-stats'] })
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          {stats.unresolved > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm(`Resolver todos los errores pendientes${filters.severity ? ` (${filters.severity})` : ''}?`)) {
                  resolveAllMutation.mutate()
                }
              }}
              disabled={resolveAllMutation.isPending}
            >
              <CheckCheck className="w-4 h-4" />
              Resolver todos
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total registros" value={stats.total || 0} icon={AlertCircle} />
        <StatCard label="Sin resolver" value={stats.unresolved || 0} icon={AlertTriangle} color="text-orange-600" />
        <StatCard label="Ultimas 24h" value={stats.last_24h || 0} icon={Clock} color="text-blue-600" />
        <StatCard label="Ultimos 7d" value={stats.last_7d || 0} icon={Clock} color="text-purple-600" />
      </div>

      {/* Event Type Breakdown */}
      {Object.values(byEventType).some(v => v > 0) && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(eventTypeConfig).map(([key, config]) => {
            const count = byEventType[key] || 0
            const Icon = config.icon
            return (
              <button
                key={key}
                onClick={() => updateFilter('event_type', filters.event_type === key ? '' : key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  filters.event_type === key
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{count}</span>
                <span className="hidden md:inline text-xs">{config.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por clase, mensaje, path, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <Select
              options={severityOptions}
              value={filters.severity}
              onChange={(e) => updateFilter('severity', e.target.value)}
            />
            <Select
              options={eventTypeOptions}
              value={filters.event_type}
              onChange={(e) => updateFilter('event_type', e.target.value)}
            />
            <Select
              options={sourceOptions}
              value={filters.source}
              onChange={(e) => updateFilter('source', e.target.value)}
            />
            <Select
              options={statusOptions}
              value={filters.resolved}
              onChange={(e) => updateFilter('resolved', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
            <div>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => updateFilter('date_from', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Desde"
              />
            </div>
            <div>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => updateFilter('date_to', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Hasta"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No se encontraron registros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severidad</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HTTP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensaje</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={log.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <EventTypeBadge eventType={log.event_type} />
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={log.source} />
                      </td>
                      <td className="px-4 py-3">
                        <HttpStatusBadge status={log.http_status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[280px] truncate">
                        {log.message}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500 max-w-[200px] truncate">
                        {log.request_method && <span className="text-gray-400 mr-1">{log.request_method}</span>}
                        {log.request_path || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">
                        {log.user_email || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {log.resolved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Resuelto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {meta.total} resultados - Pagina {meta.page} de {meta.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page >= meta.total_pages}
                  onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={detail ? `${detail.error_class || 'Detalle'}` : 'Cargando...'}
        size="xl"
      >
        {detail && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={detail.severity} />
                <EventTypeBadge eventType={detail.event_type} />
                <SourceBadge source={detail.source} />
                <HttpStatusBadge status={detail.http_status} />
                {detail.resolved ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3" />
                    Resuelto por {detail.resolved_by}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => resolveMutation.mutate(detail.id)}
                    disabled={resolveMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar resuelto
                  </Button>
                )}
              </div>
              <span className="text-sm text-gray-500">{formatDate(detail.created_at)}</span>
            </div>

            {/* Error message */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Mensaje</h4>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3 font-mono whitespace-pre-wrap break-words">
                {detail.message}
              </p>
            </div>

            {/* Response body */}
            {detail.response_body && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Respuesta del servidor</h4>
                <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(detail.response_body), null, 2) } catch { return detail.response_body }
                  })()}
                </pre>
              </div>
            )}

            {/* Request info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Path:</span>
                <span className="font-mono text-gray-900">{detail.request_method} {detail.request_path || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Usuario:</span>
                <span className="text-gray-900">{detail.user_email || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">IP:</span>
                <span className="font-mono text-gray-900">{detail.ip_address || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Request ID:</span>
                <span className="font-mono text-gray-900 truncate">{detail.request_id || '-'}</span>
              </div>
            </div>

            {/* Controller info */}
            {detail.controller_name && (
              <div className="text-sm">
                <span className="text-gray-500">Controller:</span>{' '}
                <span className="font-mono text-gray-900">{detail.controller_name}#{detail.action_name}</span>
              </div>
            )}

            {/* Request params */}
            {detail.request_params && Object.keys(detail.request_params).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Parametros del request</h4>
                <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40">
                  {JSON.stringify(detail.request_params, null, 2)}
                </pre>
              </div>
            )}

            {/* User Agent */}
            {detail.user_agent && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">User Agent</h4>
                <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 break-all">{detail.user_agent}</p>
              </div>
            )}

            {/* Metadata */}
            {detail.metadata && Object.keys(detail.metadata).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Metadata</h4>
                <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40">
                  {JSON.stringify(detail.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Backtrace */}
            {detail.backtrace && detail.backtrace.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">
                  Backtrace ({detail.backtrace.length} frames)
                </h4>
                <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-80">
                  {detail.backtrace.map((line, i) => (
                    <div key={i} className="text-xs font-mono leading-5">
                      <span className="text-gray-500 select-none mr-3">{i + 1}</span>
                      <span className={line.includes('/app/') ? 'text-green-400' : 'text-gray-400'}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
