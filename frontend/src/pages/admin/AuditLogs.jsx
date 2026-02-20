import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  History,
  Plus,
  Edit3,
  Trash2,
  Eye,
  User,
  Monitor,
  Hash,
  Globe,
  Activity,
  Shield,
  FileText,
  Users,
  BarChart3,
} from 'lucide-react'

const actionConfig = {
  create: { color: 'bg-green-100 text-green-800', label: 'Crear', icon: Plus },
  update: { color: 'bg-blue-100 text-blue-800', label: 'Actualizar', icon: Edit3 },
  delete: { color: 'bg-red-100 text-red-800', label: 'Eliminar', icon: Trash2 },
  read: { color: 'bg-gray-100 text-gray-700', label: 'Leer', icon: Eye },
  login: { color: 'bg-purple-100 text-purple-800', label: 'Login', icon: User },
  logout: { color: 'bg-purple-100 text-purple-700', label: 'Logout', icon: User },
  permission_change: { color: 'bg-amber-100 text-amber-800', label: 'Permisos', icon: Shield },
  export: { color: 'bg-teal-100 text-teal-800', label: 'Exportar', icon: FileText },
  import: { color: 'bg-teal-100 text-teal-700', label: 'Importar', icon: FileText },
}

const eventTypeConfig = {
  identity: { color: 'bg-purple-50 text-purple-700 ring-purple-600/10', label: 'Identidad' },
  content: { color: 'bg-blue-50 text-blue-700 ring-blue-600/10', label: 'Contenido' },
  workflow: { color: 'bg-amber-50 text-amber-700 ring-amber-600/10', label: 'Flujo' },
  system: { color: 'bg-gray-50 text-gray-700 ring-gray-600/10', label: 'Sistema' },
  security: { color: 'bg-red-50 text-red-700 ring-red-600/10', label: 'Seguridad' },
  record: { color: 'bg-green-50 text-green-700 ring-green-600/10', label: 'Retención' },
  hr: { color: 'bg-pink-50 text-pink-700 ring-pink-600/10', label: 'RR.HH.' },
}

const targetTypeLabels = {
  'Identity::User': 'Usuario',
  'Identity::Role': 'Rol',
  'Identity::Permission': 'Permiso',
  'Identity::Company': 'Compañía',
  'Identity::UserSignature': 'Firma',
  'Hr::Employee': 'Empleado',
  'Templates::Template': 'Plantilla',
  'Templates::GeneratedDocument': 'Documento Gen.',
  'Templates::SignatoryType': 'Tipo Firmante',
  'Templates::VariableMapping': 'Variable',
  'Legal::Contract': 'Contrato',
  'Legal::ContractApproval': 'Aprobación',
  'Legal::ThirdParty': 'Tercero',
  'Legal::ThirdPartyType': 'Tipo Tercero',
  'Content::Document': 'Documento',
  'Content::Folder': 'Carpeta',
  'Retention::RetentionPolicy': 'Política Retención',
  'Workflow::WorkflowDefinition': 'Flujo de Trabajo',
  'Organization': 'Organización',
}

const eventTypeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'identity', label: 'Identidad' },
  { value: 'content', label: 'Contenido' },
  { value: 'workflow', label: 'Flujo de trabajo' },
  { value: 'system', label: 'Sistema' },
  { value: 'security', label: 'Seguridad' },
  { value: 'record', label: 'Retención' },
  { value: 'hr', label: 'RR.HH.' },
]

const actionOptions = [
  { value: '', label: 'Todas las acciones' },
  { value: 'create', label: 'Crear' },
  { value: 'update', label: 'Actualizar' },
  { value: 'delete', label: 'Eliminar' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'permission_change', label: 'Cambio permisos' },
]

function ActionBadge({ action }) {
  const config = actionConfig[action] || { color: 'bg-gray-100 text-gray-700', label: action, icon: Activity }
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

function EventTypeBadge({ eventType }) {
  const config = eventTypeConfig[eventType] || { color: 'bg-gray-50 text-gray-700 ring-gray-600/10', label: eventType }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${config.color}`}>
      {config.label}
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

function formatTargetType(targetType) {
  return targetTypeLabels[targetType] || targetType?.split('::').pop() || '-'
}

function formatChangeSummary(log) {
  if (log.action === 'create') return 'Registro creado'
  if (log.action === 'delete') return 'Registro eliminado'
  if (log.action === 'update') {
    const fields = Object.keys(log.change_data || {})
    if (fields.length === 0) return 'Actualizado'
    if (fields.length <= 3) return fields.join(', ')
    return `${fields.slice(0, 3).join(', ')} (+${fields.length - 3})`
  }
  return log.action
}

export default function AuditLogs() {
  const [selectedLog, setSelectedLog] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    event_type: '',
    action: '',
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

  const { data: statsData } = useQuery({
    queryKey: ['audit-log-stats'],
    queryFn: () => auditLogService.stats(),
    refetchInterval: 60000,
  })

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogService.list(filters),
  })

  const { data: detailData } = useQuery({
    queryKey: ['audit-log-detail', selectedLog],
    queryFn: () => auditLogService.get(selectedLog),
    enabled: !!selectedLog,
  })

  const stats = statsData?.data?.data || {}
  const logs = logsData?.data?.data || []
  const meta = logsData?.data?.meta || {}
  const detail = detailData?.data?.data || null

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

  // Build change rows for detail modal
  const getChangeRows = () => {
    if (!detail) return []
    const rows = []
    const changeData = detail.change_data || {}
    const prevValues = detail.previous_values || {}
    const newValues = detail.new_values || {}

    for (const field of Object.keys(changeData)) {
      const prev = prevValues[field]
      const next = newValues[field]
      rows.push({ field, prev, next })
    }
    return rows
  }

  const formatValue = (val) => {
    if (val === null || val === undefined) return <span className="text-gray-300 italic">null</span>
    if (typeof val === 'object') return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    const str = String(val)
    if (str.length > 120) return str.substring(0, 120) + '...'
    return str
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
          <p className="text-gray-500">Registro de cambios y actividad del sistema</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('refetch-audit'))
          }}
          title="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total registros" value={stats.total?.toLocaleString() || 0} icon={History} />
        <StatCard label="Hoy" value={stats.today || 0} icon={Clock} color="text-blue-600" />
        <StatCard label="Última semana" value={stats.last_7d || 0} icon={BarChart3} color="text-purple-600" />
        <StatCard label="Último mes" value={stats.last_30d || 0} icon={Activity} color="text-green-600" />
      </div>

      {/* Event Type + Action Breakdown */}
      {stats.by_event_type && Object.keys(stats.by_event_type).length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          {Object.entries(eventTypeConfig).map(([key, config]) => {
            const count = stats.by_event_type?.[key] || 0
            return (
              <button
                key={key}
                onClick={() => updateFilter('event_type', filters.event_type === key ? '' : key)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  filters.event_type === key
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por usuario, recurso, acción..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <Select
              options={eventTypeOptions}
              value={filters.event_type}
              onChange={(e) => updateFilter('event_type', e.target.value)}
            />
            <Select
              options={actionOptions}
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => updateFilter('date_from', e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => updateFilter('date_to', e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No se encontraron registros de auditoría</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recurso</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cambios</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
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
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[180px] truncate">
                        <div>
                          <span className="font-medium">{log.actor_name || '-'}</span>
                          {log.actor_email && (
                            <p className="text-xs text-gray-400 truncate">{log.actor_email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3">
                        <EventTypeBadge eventType={log.event_type} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">
                        {formatTargetType(log.target_type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                        {formatChangeSummary(log)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-400 whitespace-nowrap">
                        {log.ip_address || '-'}
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
                {meta.total} resultados - Página {meta.page} de {meta.total_pages}
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
        title="Detalle de Auditoría"
        size="xl"
      >
        {detail && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <ActionBadge action={detail.action} />
                <EventTypeBadge eventType={detail.event_type} />
              </div>
              <span className="text-sm text-gray-500">{formatDate(detail.created_at)}</span>
            </div>

            {/* Actor + Target info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Actor:</span>
                <span className="text-gray-900">{detail.actor_name || '-'} ({detail.actor_email || '-'})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Recurso:</span>
                <span className="text-gray-900">{formatTargetType(detail.target_type)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">IP:</span>
                <span className="font-mono text-gray-900">{detail.ip_address || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Target ID:</span>
                <span className="font-mono text-gray-900 truncate">{detail.target_id || '-'}</span>
              </div>
              {detail.request_id && (
                <div className="flex items-center gap-2 text-sm">
                  <Monitor className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Request ID:</span>
                  <span className="font-mono text-gray-900 truncate">{detail.request_id}</span>
                </div>
              )}
              {detail.target_uuid && (
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">UUID:</span>
                  <span className="font-mono text-gray-900 truncate">{detail.target_uuid}</span>
                </div>
              )}
            </div>

            {/* Changes Table */}
            {getChangeRows().length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Cambios ({getChangeRows().length} campos)
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Campo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[37.5%]">Antes</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[37.5%]">Después</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getChangeRows().map((row) => (
                        <tr key={row.field}>
                          <td className="px-4 py-2 text-sm font-mono font-medium text-gray-700">{row.field}</td>
                          <td className="px-4 py-2 text-sm text-red-700 bg-red-50/50 break-all">
                            {formatValue(row.prev)}
                          </td>
                          <td className="px-4 py-2 text-sm text-green-700 bg-green-50/50 break-all">
                            {formatValue(row.next)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tags */}
            {detail.tags && detail.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {detail.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
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

            {/* User Agent */}
            {detail.user_agent && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">User Agent</h4>
                <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 break-all">{detail.user_agent}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
