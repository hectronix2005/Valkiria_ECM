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
  Mail, Building2, ChevronDown, Filter
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

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showRolesModal, setShowRolesModal] = useState(null)
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
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <p className="text-sm text-gray-500">Nivel {level}</p>
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
    </div>
  )
}
