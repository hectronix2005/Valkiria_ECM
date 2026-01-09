import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentService } from '../../services/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import {
  Building2, Plus, Search, Edit2, Trash2, Users,
  AlertCircle, CheckCircle
} from 'lucide-react'

export default function Departments() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [newDepartmentName, setNewDepartmentName] = useState('')
  const [createError, setCreateError] = useState('')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.list(),
  })

  const createMutation = useMutation({
    mutationFn: (name) => departmentService.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments'])
      setShowCreateModal(false)
      setNewDepartmentName('')
      setCreateError('')
    },
    onError: (error) => {
      setCreateError(error.response?.data?.error || 'Error al crear departamento')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }) => departmentService.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments'])
      setEditingDepartment(null)
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al actualizar departamento')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => departmentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments'])
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al eliminar departamento')
    }
  })

  const departments = data?.data?.data || []
  const meta = data?.data?.meta || {}

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(search.toLowerCase()) ||
    dept.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = (e) => {
    e.preventDefault()
    if (newDepartmentName.trim()) {
      createMutation.mutate(newDepartmentName.trim())
    }
  }

  const handleUpdate = (e) => {
    e.preventDefault()
    if (editingDepartment && editingDepartment.newName?.trim()) {
      updateMutation.mutate({
        id: editingDepartment.id,
        name: editingDepartment.newName.trim()
      })
    }
  }

  const handleDelete = (dept) => {
    if (dept.employee_count > 0) {
      alert(`No se puede eliminar "${dept.name}" porque tiene ${dept.employee_count} empleados asignados.`)
      return
    }
    if (confirm(`¿Estás seguro de eliminar el departamento "${dept.name}"?`)) {
      deleteMutation.mutate(dept.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Building2 className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Departamentos</h1>
            <p className="text-gray-500">Gestión de departamentos y áreas</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Departamento
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{meta.total || 0}</p>
              <p className="text-sm text-gray-500">Departamentos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{meta.total_employees || 0}</p>
              <p className="text-sm text-gray-500">Empleados Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {departments.filter(d => d.is_configured).length}
              </p>
              <p className="text-sm text-gray-500">Configurados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar departamentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Departments Grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {search ? 'No se encontraron departamentos' : 'No hay departamentos'}
            </h3>
            <p className="text-gray-500 mb-4">
              {search
                ? 'Intenta con otra búsqueda'
                : 'Crea el primer departamento para comenzar'}
            </p>
            {!search && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Departamento
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empleados
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
              {filteredDepartments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Building2 className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="font-medium text-gray-900">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {dept.code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{dept.employee_count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {dept.is_configured ? (
                      <Badge variant="success">Configurado</Badge>
                    ) : (
                      <Badge variant="warning">Sin configurar</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingDepartment({ ...dept, newName: dept.name })}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className={`p-1.5 rounded ${
                          dept.employee_count > 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={dept.employee_count > 0 ? 'No se puede eliminar (tiene empleados)' : 'Eliminar'}
                        disabled={dept.employee_count > 0}
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setNewDepartmentName('')
          setCreateError('')
        }}
        title="Nuevo Departamento"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nombre del Departamento"
            value={newDepartmentName}
            onChange={(e) => {
              setNewDepartmentName(e.target.value)
              setCreateError('')
            }}
            placeholder="Ej: Recursos Humanos"
            autoFocus
            required
          />

          {createError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                setNewDepartmentName('')
                setCreateError('')
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingDepartment}
        onClose={() => setEditingDepartment(null)}
        title="Editar Departamento"
      >
        {editingDepartment && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Nombre del Departamento"
              value={editingDepartment.newName}
              onChange={(e) => setEditingDepartment({ ...editingDepartment, newName: e.target.value })}
              placeholder="Nombre del departamento"
              autoFocus
              required
            />

            {editingDepartment.employee_count > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  Este departamento tiene <strong>{editingDepartment.employee_count}</strong> empleados.
                  Al cambiar el nombre, se actualizará en todos los registros.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingDepartment(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
