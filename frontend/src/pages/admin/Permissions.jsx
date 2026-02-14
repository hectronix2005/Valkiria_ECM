import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { permissionService } from '../../services/api'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import {
  Shield, Save, RotateCcw, ChevronDown, ChevronRight, Check, AlertCircle, Loader2
} from 'lucide-react'

const LEVEL_COLORS = {
  5: 'bg-purple-100 text-purple-800 border-purple-200',
  4: 'bg-blue-100 text-blue-800 border-blue-200',
  3: 'bg-green-100 text-green-800 border-green-200',
  2: 'bg-gray-100 text-gray-800 border-gray-200',
  1: 'bg-slate-100 text-slate-600 border-slate-200',
}

const RESOURCE_LABELS = {
  documents: 'Documentos',
  users: 'Usuarios',
  settings: 'Configuración',
  hr_requests: 'Solicitudes HR',
  legal_documents: 'Documentos Legales',
  audit_logs: 'Logs de Auditoría',
  roles: 'Roles',
  organizations: 'Organizaciones',
  folders: 'Carpetas',
  workflows: 'Flujos de Trabajo',
}

const ACTION_LABELS = {
  read: 'Leer',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  manage: 'Gestionar',
  export: 'Exportar',
}

export default function Permissions() {
  const queryClient = useQueryClient()
  const [pendingChanges, setPendingChanges] = useState({}) // { roleId: Set(permissionIds) }
  const [expandedResources, setExpandedResources] = useState([])
  const [saveSuccess, setSaveSuccess] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => permissionService.list(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }) => permissionService.updateRole(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
    },
  })

  const roles = data?.data?.data?.roles || []
  const permissions = data?.data?.data?.permissions || []

  // Filter out admin role - it always has all permissions implicitly
  const editableRoles = useMemo(() =>
    roles.filter(r => r.name !== 'admin').sort((a, b) => b.level - a.level),
    [roles]
  )

  // Group permissions by resource
  const permissionsByResource = useMemo(() => {
    const groups = {}
    permissions.forEach(p => {
      if (!groups[p.resource]) groups[p.resource] = []
      groups[p.resource].push(p)
    })
    // Sort actions within each resource
    const actionOrder = ['read', 'create', 'update', 'delete', 'export', 'manage']
    Object.values(groups).forEach(perms => {
      perms.sort((a, b) => actionOrder.indexOf(a.action) - actionOrder.indexOf(b.action))
    })
    return groups
  }, [permissions])

  const resourceNames = useMemo(() => Object.keys(permissionsByResource).sort(), [permissionsByResource])

  // Get current permission set for a role (pending changes or original)
  const getRolePermissions = (roleId) => {
    if (pendingChanges[roleId]) return pendingChanges[roleId]
    const role = roles.find(r => r.id === roleId)
    return new Set(role?.permission_ids || [])
  }

  const hasPermission = (roleId, permissionId) => {
    return getRolePermissions(roleId).has(permissionId)
  }

  const togglePermission = (roleId, permissionId) => {
    const current = getRolePermissions(roleId)
    const newSet = new Set(current)
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId)
    } else {
      newSet.add(permissionId)
    }
    setPendingChanges(prev => ({ ...prev, [roleId]: newSet }))
  }

  // Toggle all permissions for a resource+role
  const toggleResourceForRole = (roleId, resource) => {
    const resourcePerms = permissionsByResource[resource] || []
    const current = getRolePermissions(roleId)
    const newSet = new Set(current)
    const allActive = resourcePerms.every(p => current.has(p.id))

    resourcePerms.forEach(p => {
      if (allActive) {
        newSet.delete(p.id)
      } else {
        newSet.add(p.id)
      }
    })
    setPendingChanges(prev => ({ ...prev, [roleId]: newSet }))
  }

  const toggleResource = (resource) => {
    setExpandedResources(prev =>
      prev.includes(resource)
        ? prev.filter(r => r !== resource)
        : [...prev, resource]
    )
  }

  const changedRoleIds = useMemo(() => {
    return Object.keys(pendingChanges).filter(roleId => {
      const role = roles.find(r => r.id === roleId)
      if (!role) return false
      const original = new Set(role.permission_ids)
      const pending = pendingChanges[roleId]
      if (original.size !== pending.size) return true
      for (const id of original) {
        if (!pending.has(id)) return true
      }
      return false
    })
  }, [pendingChanges, roles])

  const hasChanges = changedRoleIds.length > 0

  const handleSave = async () => {
    setSaveSuccess(null)
    try {
      for (const roleId of changedRoleIds) {
        await updateMutation.mutateAsync({
          roleId,
          permissionIds: Array.from(pendingChanges[roleId]),
        })
      }
      setPendingChanges({})
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (err) {
      setSaveSuccess(false)
    }
  }

  const handleReset = () => {
    setPendingChanges({})
    setSaveSuccess(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Cargando permisos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">Error al cargar permisos</p>
          <p className="text-sm text-gray-500 mt-1">{error.response?.data?.error || error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Shield className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permisos del Sistema</h1>
            <p className="text-sm text-gray-500">Administra los permisos asignados a cada rol</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600 font-medium">
              {changedRoleIds.length} rol{changedRoleIds.length !== 1 ? 'es' : ''} modificado{changedRoleIds.length !== 1 ? 's' : ''}
            </span>
          )}
          {saveSuccess === true && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <Check className="w-4 h-4" />
              Guardado
            </span>
          )}
          {saveSuccess === false && (
            <span className="flex items-center gap-1 text-sm text-danger-600 font-medium">
              <AlertCircle className="w-4 h-4" />
              Error al guardar
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Restaurar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Shield className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          El rol <strong>Administrador</strong> tiene todos los permisos de forma implícita y no se muestra en esta tabla.
          Los cambios solo aplican a los roles editables.
        </p>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 min-w-[240px] sticky left-0 bg-gray-50 z-10">
                  Permiso
                </th>
                {editableRoles.map(role => (
                  <th key={role.id} className="text-center px-3 py-3 min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-gray-700">{role.display_name}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${LEVEL_COLORS[role.level] || LEVEL_COLORS[1]}`}>
                        Nivel {role.level}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resourceNames.map(resource => {
                const resourcePerms = permissionsByResource[resource]
                const isExpanded = expandedResources.includes(resource)

                return (
                  <ResourceSection
                    key={resource}
                    resource={resource}
                    permissions={resourcePerms}
                    roles={editableRoles}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleResource(resource)}
                    hasPermission={hasPermission}
                    togglePermission={togglePermission}
                    toggleResourceForRole={toggleResourceForRole}
                    pendingChanges={pendingChanges}
                    originalRoles={roles}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-primary-500 bg-primary-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
          <span>Permiso activo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white" />
          <span>Permiso inactivo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50" />
          <span>Cambio pendiente</span>
        </div>
      </div>
    </div>
  )
}

function ResourceSection({
  resource,
  permissions,
  roles,
  isExpanded,
  onToggleExpand,
  hasPermission,
  togglePermission,
  toggleResourceForRole,
  pendingChanges,
  originalRoles,
}) {
  const isChanged = (roleId, permId) => {
    if (!pendingChanges[roleId]) return false
    const role = originalRoles.find(r => r.id === roleId)
    if (!role) return false
    const original = new Set(role.permission_ids)
    const pending = pendingChanges[roleId]
    return original.has(permId) !== pending.has(permId)
  }

  return (
    <>
      {/* Resource header row */}
      <tr
        className="border-b border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-2.5 sticky left-0 bg-gray-50/50 z-10">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-sm font-semibold text-gray-700">
              {RESOURCE_LABELS[resource] || resource}
            </span>
            <Badge variant="secondary" size="sm">{permissions.length}</Badge>
          </div>
        </td>
        {roles.map(role => {
          const resourcePerms = permissions
          const activeCount = resourcePerms.filter(p => hasPermission(role.id, p.id)).length
          const allActive = activeCount === resourcePerms.length

          return (
            <td key={role.id} className="text-center px-3 py-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleResourceForRole(role.id, resource)
                }}
                className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
                  allActive
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : activeCount > 0
                    ? 'bg-primary-200 text-primary-700 hover:bg-primary-300'
                    : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                }`}
                title={`${activeCount}/${resourcePerms.length} permisos activos`}
              >
                {allActive ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-bold">{activeCount}</span>
                )}
              </button>
            </td>
          )
        })}
      </tr>

      {/* Permission rows */}
      {isExpanded && permissions.map(perm => (
        <tr key={perm.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
          <td className="px-4 py-2 pl-10 sticky left-0 bg-white z-10">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                {ACTION_LABELS[perm.action] || perm.action}
              </span>
              <span className="text-[11px] text-gray-400">{perm.name}</span>
            </div>
          </td>
          {roles.map(role => {
            const active = hasPermission(role.id, perm.id)
            const changed = isChanged(role.id, perm.id)

            return (
              <td key={role.id} className="text-center px-3 py-2">
                <button
                  onClick={() => togglePermission(role.id, perm.id)}
                  className={`inline-flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
                    active
                      ? changed
                        ? 'border-amber-400 bg-amber-100 text-amber-700'
                        : 'border-primary-500 bg-primary-500 text-white'
                      : changed
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  {active && <Check className="w-3 h-3" />}
                </button>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
