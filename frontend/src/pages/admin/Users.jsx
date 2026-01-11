import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService, departmentService } from '../../services/api'
import { PERMISSION_LEVELS, LEVEL_NAMES } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import {
  Users, Plus, Search, Edit2, Trash2, Shield,
  AlertCircle, CheckCircle, UserX, UserCheck,
  Mail, Building2, ChevronDown, ChevronRight, Filter,
  Settings, Home, FileText, Folder, Scale, BarChart3,
  Network, Check, X, Lock, Unlock
} from 'lucide-react'

const LEVEL_COLORS = {
  5: 'bg-purple-100 text-purple-800 border-purple-200',
  4: 'bg-blue-100 text-blue-800 border-blue-200',
  3: 'bg-green-100 text-green-800 border-green-200',
  2: 'bg-gray-100 text-gray-800 border-gray-200',
  1: 'bg-slate-100 text-slate-600 border-slate-200',
}

const LEVEL_BADGES = {
  5: 'danger',
  4: 'info',
  3: 'success',
  2: 'default',
  1: 'secondary',
}

// Estructura completa de módulos, submódulos y funciones del sistema
const SYSTEM_MODULES = [
  {
    id: 'general',
    name: 'General',
    icon: Home,
    description: 'Módulos generales del sistema',
    submodules: [
      {
        id: 'dashboard',
        name: 'Inicio / Dashboard',
        functions: [
          { id: 'view', name: 'Ver dashboard', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'view_stats', name: 'Ver estadísticas', defaultLevels: [2, 3, 4, 5] },
        ]
      },
      {
        id: 'documents',
        name: 'Documentos',
        functions: [
          { id: 'view', name: 'Ver documentos', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'create', name: 'Crear documentos', defaultLevels: [2, 3, 4, 5] },
          { id: 'edit', name: 'Editar documentos', defaultLevels: [3, 4, 5] },
          { id: 'delete', name: 'Eliminar documentos', defaultLevels: [4, 5] },
          { id: 'download', name: 'Descargar documentos', defaultLevels: [1, 2, 3, 4, 5] },
        ]
      },
      {
        id: 'folders',
        name: 'Carpetas',
        functions: [
          { id: 'view', name: 'Ver carpetas', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'create', name: 'Crear carpetas', defaultLevels: [2, 3, 4, 5] },
          { id: 'edit', name: 'Editar carpetas', defaultLevels: [3, 4, 5] },
          { id: 'delete', name: 'Eliminar carpetas', defaultLevels: [4, 5] },
        ]
      },
      {
        id: 'profile',
        name: 'Mi Perfil',
        functions: [
          { id: 'view', name: 'Ver perfil', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'edit', name: 'Editar perfil', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'change_password', name: 'Cambiar contraseña', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'manage_signatures', name: 'Gestionar firmas', defaultLevels: [2, 3, 4, 5] },
        ]
      },
    ]
  },
  {
    id: 'hr',
    name: 'Recursos Humanos',
    icon: Users,
    description: 'Gestión de recursos humanos',
    submodules: [
      {
        id: 'my_requests',
        name: 'Mis Solicitudes',
        functions: [
          { id: 'view', name: 'Ver mis solicitudes', defaultLevels: [1, 2, 3, 4, 5] },
          { id: 'create_vacation', name: 'Solicitar vacaciones', defaultLevels: [2, 3, 4, 5] },
          { id: 'create_certification', name: 'Solicitar certificaciones', defaultLevels: [2, 3, 4, 5] },
          { id: 'cancel', name: 'Cancelar solicitudes', defaultLevels: [2, 3, 4, 5] },
        ]
      },
      {
        id: 'organigrama',
        name: 'Organigrama',
        functions: [
          { id: 'view', name: 'Ver organigrama', defaultLevels: [1, 2, 3, 4, 5] },
        ]
      },
      {
        id: 'approvals',
        name: 'Aprobaciones',
        functions: [
          { id: 'view', name: 'Ver aprobaciones pendientes', defaultLevels: [3, 4, 5] },
          { id: 'approve', name: 'Aprobar solicitudes', defaultLevels: [3, 4, 5] },
          { id: 'reject', name: 'Rechazar solicitudes', defaultLevels: [3, 4, 5] },
        ]
      },
      {
        id: 'employees',
        name: 'Empleados',
        functions: [
          { id: 'view', name: 'Ver empleados', defaultLevels: [3, 4, 5] },
          { id: 'create', name: 'Crear empleados', defaultLevels: [3, 5] },
          { id: 'edit', name: 'Editar empleados', defaultLevels: [3, 5] },
          { id: 'view_balance', name: 'Ver saldo vacaciones', defaultLevels: [3, 4, 5] },
          { id: 'generate_docs', name: 'Generar documentos', defaultLevels: [3, 5] },
          { id: 'create_account', name: 'Crear cuenta de usuario', defaultLevels: [3, 5] },
        ]
      },
      {
        id: 'hr_documents',
        name: 'Documentación HR',
        functions: [
          { id: 'view', name: 'Ver documentación', defaultLevels: [3, 5] },
          { id: 'manage_variables', name: 'Gestionar variables', defaultLevels: [3, 5] },
        ]
      },
      {
        id: 'hr_dashboard',
        name: 'Dashboard HR',
        functions: [
          { id: 'view', name: 'Ver dashboard HR', defaultLevels: [3, 5] },
          { id: 'export', name: 'Exportar reportes', defaultLevels: [3, 5] },
        ]
      },
    ]
  },
  {
    id: 'legal',
    name: 'Gestión Legal',
    icon: Scale,
    description: 'Contratos y terceros',
    submodules: [
      {
        id: 'contracts',
        name: 'Contratos',
        functions: [
          { id: 'view', name: 'Ver contratos', defaultLevels: [4, 5] },
          { id: 'create', name: 'Crear contratos', defaultLevels: [4, 5] },
          { id: 'edit', name: 'Editar contratos', defaultLevels: [4, 5] },
          { id: 'delete', name: 'Eliminar contratos', defaultLevels: [5] },
          { id: 'submit', name: 'Enviar a aprobación', defaultLevels: [4, 5] },
          { id: 'generate_doc', name: 'Generar documento', defaultLevels: [4, 5] },
          { id: 'sign', name: 'Firmar contratos', defaultLevels: [4, 5] },
        ]
      },
      {
        id: 'legal_approvals',
        name: 'Aprobaciones Legales',
        functions: [
          { id: 'view', name: 'Ver aprobaciones', defaultLevels: [4, 5] },
          { id: 'approve', name: 'Aprobar contratos', defaultLevels: [4, 5] },
          { id: 'reject', name: 'Rechazar contratos', defaultLevels: [4, 5] },
        ]
      },
      {
        id: 'third_parties',
        name: 'Terceros',
        functions: [
          { id: 'view', name: 'Ver terceros', defaultLevels: [4, 5] },
          { id: 'create', name: 'Crear terceros', defaultLevels: [4, 5] },
          { id: 'edit', name: 'Editar terceros', defaultLevels: [4, 5] },
          { id: 'delete', name: 'Eliminar terceros', defaultLevels: [5] },
          { id: 'manage_types', name: 'Gestionar tipos', defaultLevels: [5] },
        ]
      },
    ]
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: Settings,
    description: 'Configuración del sistema',
    submodules: [
      {
        id: 'settings',
        name: 'Configuración',
        functions: [
          { id: 'view', name: 'Ver configuración', defaultLevels: [5] },
          { id: 'edit', name: 'Editar configuración', defaultLevels: [5] },
        ]
      },
      {
        id: 'users',
        name: 'Usuarios',
        functions: [
          { id: 'view', name: 'Ver usuarios', defaultLevels: [5] },
          { id: 'create', name: 'Crear usuarios', defaultLevels: [5] },
          { id: 'edit', name: 'Editar usuarios', defaultLevels: [5] },
          { id: 'delete', name: 'Eliminar usuarios', defaultLevels: [5] },
          { id: 'toggle_active', name: 'Activar/Desactivar', defaultLevels: [5] },
          { id: 'assign_roles', name: 'Asignar roles', defaultLevels: [5] },
          { id: 'manage_permissions', name: 'Gestionar permisos', defaultLevels: [5] },
        ]
      },
      {
        id: 'departments',
        name: 'Áreas / Departamentos',
        functions: [
          { id: 'view', name: 'Ver áreas', defaultLevels: [5] },
          { id: 'create', name: 'Crear áreas', defaultLevels: [5] },
          { id: 'edit', name: 'Editar áreas', defaultLevels: [5] },
          { id: 'delete', name: 'Eliminar áreas', defaultLevels: [5] },
        ]
      },
      {
        id: 'templates',
        name: 'Templates',
        functions: [
          { id: 'view', name: 'Ver templates', defaultLevels: [5] },
          { id: 'create', name: 'Crear templates', defaultLevels: [5] },
          { id: 'edit', name: 'Editar templates', defaultLevels: [5] },
          { id: 'delete', name: 'Eliminar templates', defaultLevels: [5] },
          { id: 'upload', name: 'Subir archivos', defaultLevels: [5] },
          { id: 'manage_signatories', name: 'Gestionar firmantes', defaultLevels: [5] },
          { id: 'manage_variables', name: 'Gestionar variables', defaultLevels: [5] },
        ]
      },
    ]
  },
]

// Componente para checkbox de permiso
function PermissionCheckbox({ checked, onChange, disabled, level }) {
  const levelColors = {
    5: 'checked:bg-purple-500 checked:border-purple-500',
    4: 'checked:bg-blue-500 checked:border-blue-500',
    3: 'checked:bg-green-500 checked:border-green-500',
    2: 'checked:bg-gray-500 checked:border-gray-500',
    1: 'checked:bg-slate-400 checked:border-slate-400',
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={`w-5 h-5 rounded border-2 border-gray-300 cursor-pointer transition-colors
        ${levelColors[level] || ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
      `}
    />
  )
}

// Componente de gestión de permisos
function PermissionsManager({ permissions, onChange }) {
  const [expandedModules, setExpandedModules] = useState(['general', 'hr', 'legal', 'system'])
  const [expandedSubmodules, setExpandedSubmodules] = useState([])

  const toggleModule = (moduleId) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    )
  }

  const toggleSubmodule = (submoduleId) => {
    setExpandedSubmodules(prev =>
      prev.includes(submoduleId)
        ? prev.filter(id => id !== submoduleId)
        : [...prev, submoduleId]
    )
  }

  const isPermissionEnabled = (moduleId, submoduleId, functionId, level) => {
    const key = `${moduleId}.${submoduleId}.${functionId}`
    return permissions[key]?.includes(level) ?? false
  }

  const togglePermission = (moduleId, submoduleId, functionId, level) => {
    const key = `${moduleId}.${submoduleId}.${functionId}`
    const currentLevels = permissions[key] || []

    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter(l => l !== level)
      : [...currentLevels, level].sort((a, b) => a - b)

    onChange({
      ...permissions,
      [key]: newLevels
    })
  }

  const toggleAllForLevel = (level) => {
    const newPermissions = { ...permissions }

    SYSTEM_MODULES.forEach(module => {
      module.submodules.forEach(submodule => {
        submodule.functions.forEach(func => {
          const key = `${module.id}.${submodule.id}.${func.id}`
          const currentLevels = newPermissions[key] || []

          if (currentLevels.includes(level)) {
            newPermissions[key] = currentLevels.filter(l => l !== level)
          } else {
            newPermissions[key] = [...currentLevels, level].sort((a, b) => a - b)
          }
        })
      })
    })

    onChange(newPermissions)
  }

  const toggleAllForModule = (moduleId, level) => {
    const module = SYSTEM_MODULES.find(m => m.id === moduleId)
    if (!module) return

    const newPermissions = { ...permissions }

    module.submodules.forEach(submodule => {
      submodule.functions.forEach(func => {
        const key = `${moduleId}.${submodule.id}.${func.id}`
        const currentLevels = newPermissions[key] || []

        if (currentLevels.includes(level)) {
          newPermissions[key] = currentLevels.filter(l => l !== level)
        } else {
          newPermissions[key] = [...currentLevels, level].sort((a, b) => a - b)
        }
      })
    })

    onChange(newPermissions)
  }

  const resetToDefaults = () => {
    const defaultPermissions = {}

    SYSTEM_MODULES.forEach(module => {
      module.submodules.forEach(submodule => {
        submodule.functions.forEach(func => {
          const key = `${module.id}.${submodule.id}.${func.id}`
          defaultPermissions[key] = [...func.defaultLevels]
        })
      })
    })

    onChange(defaultPermissions)
  }

  return (
    <div className="space-y-4">
      {/* Header con niveles */}
      <div className="sticky top-0 bg-white z-10 pb-2 border-b">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Configuración de Permisos por Nivel</h4>
          <Button variant="secondary" size="sm" onClick={resetToDefaults}>
            Restaurar Predeterminados
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_repeat(5,60px)] gap-2 items-center text-center">
          <div className="text-left text-xs font-medium text-gray-500 uppercase">
            Módulo / Función
          </div>
          {[5, 4, 3, 2, 1].map(level => (
            <div key={level} className="flex flex-col items-center">
              <button
                onClick={() => toggleAllForLevel(level)}
                className={`px-2 py-1 text-xs font-bold rounded-full border transition-colors hover:opacity-80 ${LEVEL_COLORS[level]}`}
                title={`Toggle todos nivel ${level}`}
              >
                N{level}
              </button>
              <span className="text-[10px] text-gray-500 mt-0.5">
                {LEVEL_NAMES[level]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {SYSTEM_MODULES.map(module => {
          const ModuleIcon = module.icon
          const isModuleExpanded = expandedModules.includes(module.id)

          return (
            <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Module Header */}
              <div
                className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleModule(module.id)}
              >
                {isModuleExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <ModuleIcon className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{module.description}</span>
                </div>
                {/* Quick toggle buttons for module */}
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {[5, 4, 3, 2, 1].map(level => (
                    <button
                      key={level}
                      onClick={() => toggleAllForModule(module.id, level)}
                      className={`w-6 h-6 rounded text-[10px] font-bold border transition-colors hover:opacity-80 ${LEVEL_COLORS[level]}`}
                      title={`Toggle ${module.name} para nivel ${level}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submodules */}
              {isModuleExpanded && (
                <div className="border-t border-gray-200">
                  {module.submodules.map(submodule => {
                    const isSubExpanded = expandedSubmodules.includes(`${module.id}.${submodule.id}`)

                    return (
                      <div key={submodule.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Submodule Header */}
                        <div
                          className="flex items-center gap-3 p-2 pl-10 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleSubmodule(`${module.id}.${submodule.id}`)}
                        >
                          {isSubExpanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          )}
                          <span className="flex-1 font-medium text-gray-700 text-sm">
                            {submodule.name}
                          </span>
                        </div>

                        {/* Functions */}
                        {isSubExpanded && (
                          <div className="bg-white">
                            {submodule.functions.map(func => (
                              <div
                                key={func.id}
                                className="grid grid-cols-[1fr_repeat(5,60px)] gap-2 items-center p-2 pl-16 hover:bg-gray-50 text-center"
                              >
                                <div className="text-left text-sm text-gray-600">
                                  {func.name}
                                </div>
                                {[5, 4, 3, 2, 1].map(level => (
                                  <div key={level} className="flex justify-center">
                                    <PermissionCheckbox
                                      checked={isPermissionEnabled(module.id, submodule.id, func.id, level)}
                                      onChange={() => togglePermission(module.id, submodule.id, func.id, level)}
                                      level={level}
                                    />
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showRolesModal, setShowRolesModal] = useState(null)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [systemPermissions, setSystemPermissions] = useState(() => {
    // Initialize with default permissions
    const defaults = {}
    SYSTEM_MODULES.forEach(module => {
      module.submodules.forEach(submodule => {
        submodule.functions.forEach(func => {
          const key = `${module.id}.${submodule.id}.${func.id}`
          defaults[key] = [...func.defaultLevels]
        })
      })
    })
    return defaults
  })
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    department: '',
    title: '',
    role_names: ['employee']
  })
  const [formError, setFormError] = useState('')

  const queryClient = useQueryClient()

  // Fetch users
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, filterLevel, filterStatus],
    queryFn: () => userService.list({
      search: search || undefined,
      level: filterLevel || undefined,
      status: filterStatus || undefined,
      per_page: 100
    }),
  })

  // Fetch available roles
  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => userService.getRoles(),
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['admin-users-stats'],
    queryFn: () => userService.getStats(),
  })

  // Fetch departments
  const { data: departmentsData } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => departmentService.list({ status: 'active', per_page: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => userService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      queryClient.invalidateQueries(['admin-users-stats'])
      setShowCreateModal(false)
      resetForm()
    },
    onError: (error) => {
      setFormError(error.response?.data?.error || 'Error al crear usuario')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => userService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      setEditingUser(null)
      resetForm()
    },
    onError: (error) => {
      setFormError(error.response?.data?.error || 'Error al actualizar usuario')
    }
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (id) => userService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      queryClient.invalidateQueries(['admin-users-stats'])
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al cambiar estado')
    }
  })

  const assignRolesMutation = useMutation({
    mutationFn: ({ id, roleNames }) => userService.assignRoles(id, roleNames),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      setShowRolesModal(null)
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al asignar roles')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => userService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      queryClient.invalidateQueries(['admin-users-stats'])
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al eliminar usuario')
    }
  })

  const users = data?.data?.data || []
  const roles = rolesData?.data?.data || []
  const stats = statsData?.data?.data || {}
  const departments = departmentsData?.data?.data || []

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      department: '',
      title: '',
      role_names: ['employee']
    })
    setFormError('')
  }

  const handleCreate = (e) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleUpdate = (e) => {
    e.preventDefault()
    updateMutation.mutate({ id: editingUser.id, data: formData })
  }

  const handleEdit = (user) => {
    setFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      department: user.department || '',
      title: user.title || '',
      role_names: user.roles || ['employee']
    })
    setEditingUser(user)
  }

  const handleDelete = (user) => {
    if (confirm(`¿Estás seguro de eliminar al usuario "${user.full_name}"? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(user.id)
    }
  }

  const handleToggleActive = (user) => {
    const action = user.active ? 'desactivar' : 'activar'
    if (confirm(`¿Estás seguro de ${action} al usuario "${user.full_name}"?`)) {
      toggleActiveMutation.mutate(user.id)
    }
  }

  const handleRoleChange = (roleName) => {
    setFormData(prev => {
      const currentRoles = prev.role_names || []
      if (currentRoles.includes(roleName)) {
        return { ...prev, role_names: currentRoles.filter(r => r !== roleName) }
      } else {
        return { ...prev, role_names: [...currentRoles, roleName] }
      }
    })
  }

  const handleAssignRoles = (user, roleNames) => {
    assignRolesMutation.mutate({ id: user.id, roleNames })
  }

  const handleSavePermissions = () => {
    // Here you would save to backend
    console.log('Saving permissions:', systemPermissions)
    setShowPermissionsModal(false)
    alert('Permisos guardados correctamente')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-gray-500">Gestión de usuarios y niveles de permisos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowPermissionsModal(true)}>
            <Lock className="h-4 w-4 mr-2" />
            Gestionar Permisos
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        {[5, 4, 3, 2, 1].map(level => (
          <div key={level} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${LEVEL_COLORS[level]}`}>
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.by_level?.[level] || 0}</p>
                <p className="text-xs text-gray-500">{LEVEL_NAMES[level]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Todos los niveles</option>
            {[5, 4, 3, 2, 1].map(level => (
              <option key={level} value={level}>Nivel {level} - {LEVEL_NAMES[level]}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Permission Levels Legend */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-4">
        <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Niveles de Permisos
        </h3>
        <div className="flex flex-wrap gap-3">
          {[5, 4, 3, 2, 1].map(level => (
            <div key={level} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${LEVEL_COLORS[level]}`}>
              <span className="font-bold">Nivel {level}</span> - {LEVEL_NAMES[level]}
            </div>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {search ? 'No se encontraron usuarios' : 'No hay usuarios'}
            </h3>
            <p className="text-gray-500 mb-4">
              {search ? 'Intenta con otra búsqueda' : 'Crea el primer usuario para comenzar'}
            </p>
            {!search && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Usuario
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nivel
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        user.permission_level === 5 ? 'bg-purple-500' :
                        user.permission_level === 4 ? 'bg-blue-500' :
                        user.permission_level === 3 ? 'bg-green-500' :
                        user.permission_level === 2 ? 'bg-gray-500' : 'bg-slate-400'
                      }`}>
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.department ? (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {user.department}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${LEVEL_COLORS[user.permission_level] || LEVEL_COLORS[1]}`}>
                      {user.permission_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-center gap-1">
                      {user.roles?.map(role => (
                        <Badge key={role} variant={role === 'admin' ? 'danger' : 'default'} size="sm">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.active ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setShowRolesModal(user)}
                        className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded"
                        title="Asignar roles"
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`p-1.5 rounded ${
                          user.active
                            ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-green-500 hover:text-green-700 hover:bg-green-50'
                        }`}
                        title={user.active ? 'Desactivar' : 'Activar'}
                      >
                        {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || !!editingUser}
        onClose={() => {
          setShowCreateModal(false)
          setEditingUser(null)
          resetForm()
        }}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="lg"
      >
        <form onSubmit={editingUser ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              placeholder="Juan"
              required
            />
            <Input
              label="Apellido"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              placeholder="Pérez"
              required
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="juan.perez@empresa.com"
            required
            disabled={!!editingUser}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departamento
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Seleccionar departamento</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Cargo"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Analista"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles (determinan el nivel de permisos)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(role => (
                <label
                  key={role.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.role_names?.includes(role.name)
                      ? 'bg-purple-50 border-purple-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.role_names?.includes(role.name)}
                    onChange={() => handleRoleChange(role.name)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${LEVEL_COLORS[role.level]}`}>
                        {role.level}
                      </span>
                      <span className="font-medium text-gray-900">{role.display_name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                setEditingUser(null)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingUser ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Guardar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Roles Modal */}
      <Modal
        isOpen={!!showRolesModal}
        onClose={() => setShowRolesModal(null)}
        title={`Asignar Roles - ${showRolesModal?.full_name}`}
      >
        {showRolesModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Selecciona los roles para este usuario. El nivel de permisos será determinado por el rol de mayor nivel.
            </p>

            <div className="space-y-2">
              {roles.map(role => {
                const isSelected = showRolesModal.roles?.includes(role.name)
                return (
                  <label
                    key={role.name}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const newRoles = isSelected
                          ? showRolesModal.roles.filter(r => r !== role.name)
                          : [...(showRolesModal.roles || []), role.name]
                        setShowRolesModal({ ...showRolesModal, roles: newRoles })
                      }}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${LEVEL_COLORS[role.level]}`}>
                          Nivel {role.level}
                        </span>
                        <span className="font-medium text-gray-900">{role.display_name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowRolesModal(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleAssignRoles(showRolesModal, showRolesModal.roles)}
                loading={assignRolesMutation.isPending}
              >
                <Shield className="h-4 w-4 mr-2" />
                Guardar Roles
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Permissions Management Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        title="Gestión de Permisos del Sistema"
        size="xl"
      >
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Configuración de Permisos por Nivel
            </h4>
            <p className="text-sm text-purple-700 mt-1">
              Define qué funcionalidades puede acceder cada nivel de usuario.
              Los cambios afectarán a todos los usuarios según su nivel de permisos.
            </p>
          </div>

          <PermissionsManager
            permissions={systemPermissions}
            onChange={setSystemPermissions}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowPermissionsModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Guardar Permisos
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
