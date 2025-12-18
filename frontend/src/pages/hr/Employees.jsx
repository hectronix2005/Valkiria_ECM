import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import {
  Users,
  Search,
  Filter,
  Eye,
  Edit,
  Mail,
  Phone,
  Building,
  Briefcase,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Save
} from 'lucide-react'

const statusFilters = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'on_leave', label: 'En licencia' },
  { value: 'terminated', label: 'Terminado' },
]

const departmentFilters = [
  { value: '', label: 'Todos los departamentos' },
  { value: 'engineering', label: 'Ingeniería' },
  { value: 'hr', label: 'Recursos Humanos' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'sales', label: 'Ventas' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Operaciones' },
  { value: 'legal', label: 'Legal' },
]

const employmentStatusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'on_leave', label: 'En licencia' },
  { value: 'terminated', label: 'Terminado' },
  { value: 'suspended', label: 'Suspendido' },
]

const employmentTypeOptions = [
  { value: 'full_time', label: 'Tiempo Completo' },
  { value: 'part_time', label: 'Medio Tiempo' },
  { value: 'contractor', label: 'Contratista' },
  { value: 'intern', label: 'Pasante' },
]

const departmentOptions = [
  { value: '', label: 'Sin departamento' },
  { value: 'engineering', label: 'Ingeniería' },
  { value: 'hr', label: 'Recursos Humanos' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'sales', label: 'Ventas' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Operaciones' },
  { value: 'legal', label: 'Legal' },
  { value: 'it', label: 'Tecnología' },
  { value: 'admin', label: 'Administración' },
]

const statusLabels = {
  active: 'Activo',
  inactive: 'Inactivo',
  on_leave: 'En licencia',
  terminated: 'Terminado',
  suspended: 'Suspendido',
}

const statusColors = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  on_leave: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
}

const employmentTypeLabels = {
  full_time: 'Tiempo Completo',
  part_time: 'Medio Tiempo',
  contractor: 'Contratista',
  intern: 'Pasante',
}

function EmployeeEditForm({ employee, employees, onSubmit, onCancel, loading, error }) {
  const [formData, setFormData] = useState({
    employee_number: '',
    job_title: '',
    department: '',
    employment_status: 'active',
    employment_type: 'full_time',
    hire_date: '',
    termination_date: '',
    cost_center: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    supervisor_id: '',
  })

  useEffect(() => {
    if (employee) {
      setFormData({
        employee_number: employee.employee_number || '',
        job_title: employee.job_title || '',
        department: employee.department || '',
        employment_status: employee.employment_status || 'active',
        employment_type: employee.employment_type || 'full_time',
        hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : '',
        termination_date: employee.termination_date ? employee.termination_date.split('T')[0] : '',
        cost_center: employee.cost_center || '',
        date_of_birth: employee.date_of_birth ? employee.date_of_birth.split('T')[0] : '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        supervisor_id: employee.supervisor_id || '',
      })
    }
  }, [employee])

  const handleSubmit = (e) => {
    e.preventDefault()
    // Clean empty strings to null for optional fields
    const cleanedData = { ...formData }
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === '') {
        cleanedData[key] = null
      }
    })
    onSubmit(cleanedData)
  }

  // Filter out current employee from supervisor list
  const supervisorOptions = [
    { value: '', label: 'Sin supervisor' },
    ...employees
      .filter(e => e.id !== employee?.id)
      .map(e => ({ value: e.id, label: `${e.full_name} - ${e.job_title || 'Sin cargo'}` }))
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Información Laboral */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Información Laboral</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Número de Empleado"
            value={formData.employee_number}
            onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
            placeholder="EMP-001"
          />
          <Input
            label="Cargo"
            value={formData.job_title}
            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
            placeholder="Ej: Desarrollador Senior"
          />
          <Select
            label="Departamento"
            options={departmentOptions}
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
          <Input
            label="Centro de Costo"
            value={formData.cost_center}
            onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
            placeholder="Ej: CC-100"
          />
          <Select
            label="Estado Laboral"
            options={employmentStatusOptions}
            value={formData.employment_status}
            onChange={(e) => setFormData({ ...formData, employment_status: e.target.value })}
          />
          <Select
            label="Tipo de Contrato"
            options={employmentTypeOptions}
            value={formData.employment_type}
            onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
          />
          <Select
            label="Supervisor"
            options={supervisorOptions}
            value={formData.supervisor_id}
            onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
          />
        </div>
      </div>

      {/* Fechas */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Fechas</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Fecha de Contratación"
            type="date"
            value={formData.hire_date}
            onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
          />
          <Input
            label="Fecha de Nacimiento"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
          />
          {formData.employment_status === 'terminated' && (
            <Input
              label="Fecha de Terminación"
              type="date"
              value={formData.termination_date}
              onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
            />
          )}
        </div>
      </div>

      {/* Contacto de Emergencia */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Contacto de Emergencia</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre del Contacto"
            value={formData.emergency_contact_name}
            onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
            placeholder="Nombre completo"
          />
          <Input
            label="Teléfono del Contacto"
            value={formData.emergency_contact_phone}
            onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
            placeholder="+57 300 123 4567"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          <Save className="w-4 h-4" />
          Guardar Cambios
        </Button>
      </div>
    </form>
  )
}

function EmployeeCard({ employee, onView }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-semibold text-lg">
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-gray-900 truncate">{employee.full_name}</h3>
                <p className="text-sm text-gray-500">{employee.employee_number}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[employee.employment_status] || statusColors.active}`}>
                {statusLabels[employee.employment_status] || employee.employment_status}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <span className="truncate">{employee.job_title || 'Sin cargo'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="truncate">{employee.department || 'Sin departamento'}</span>
              </div>
              {employee.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{employee.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={() => onView(employee)}>
            <Eye className="w-4 h-4" />
            Ver Detalle
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmployeeTable({ employees, onView }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 font-medium">
                        {employee.first_name?.[0]}{employee.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{employee.full_name}</p>
                      <p className="text-sm text-gray-500">{employee.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">{employee.job_title || '-'}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{employee.department || '-'}</td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[employee.employment_status] || statusColors.active}`}>
                    {statusLabels[employee.employment_status] || employee.employment_status}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onView(employee)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function Employees() {
  const { isHR, user } = useAuth()
  const isAdmin = user?.roles?.includes('admin')
  const canEdit = isHR || isAdmin

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [page, setPage] = useState(1)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [updateError, setUpdateError] = useState('')

  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', { q: searchQuery, status: statusFilter, department: departmentFilter, page }],
    queryFn: () => employeeService.list({
      q: searchQuery || undefined,
      status: statusFilter || undefined,
      department: departmentFilter || undefined,
      page,
      per_page: 20
    }),
  })

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['employee', selectedEmployee?.id],
    queryFn: () => employeeService.get(selectedEmployee.id),
    enabled: !!selectedEmployee?.id && (showDetailModal || showEditModal),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => employeeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees'])
      queryClient.invalidateQueries(['employee', selectedEmployee?.id])
      setShowEditModal(false)
      setUpdateError('')
    },
    onError: (error) => {
      setUpdateError(error.response?.data?.error || 'Error al actualizar el empleado')
    }
  })

  const employees = data?.data?.data || []
  const meta = data?.data?.meta || {}
  const employeeDetail = detailData?.data?.data || selectedEmployee

  const handleView = (employee) => {
    setSelectedEmployee(employee)
    setShowDetailModal(true)
  }

  const handleEdit = () => {
    setShowDetailModal(false)
    setShowEditModal(true)
    setUpdateError('')
  }

  const handleCloseEdit = () => {
    setShowEditModal(false)
    setSelectedEmployee(null)
    setUpdateError('')
  }

  const handleUpdate = (formData) => {
    updateMutation.mutate({ id: selectedEmployee.id, data: formData })
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
  }

  const totalPages = Math.ceil((meta.total || 0) / (meta.per_page || 20))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
          <p className="text-gray-500">Directorio de empleados de la organización</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Tabla
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Tarjetas
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o número..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Select
                options={statusFilters}
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="w-44"
              />
              <Select
                options={departmentFilters}
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1) }}
                className="w-52"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results count */}
      {meta.total !== undefined && (
        <p className="text-sm text-gray-500">
          Mostrando {employees.length} de {meta.total} empleados
        </p>
      )}

      {/* Employee List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto text-red-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar empleados</h3>
            <p className="text-gray-500">No se pudo obtener la lista de empleados. Intenta de nuevo.</p>
          </CardContent>
        </Card>
      ) : employees.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} onView={handleView} />
              ))}
            </div>
          ) : (
            <EmployeeTable employees={employees} onView={handleView} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron empleados</h3>
            <p className="text-gray-500">
              {searchQuery || statusFilter || departmentFilter
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No hay empleados registrados en el sistema'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedEmployee(null) }}
        title="Detalle del Empleado"
        size="lg"
      >
        {isLoadingDetail ? (
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full" />
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
            </div>
          </div>
        ) : employeeDetail && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-semibold text-2xl">
                    {employeeDetail.first_name?.[0]}{employeeDetail.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{employeeDetail.full_name}</h3>
                  <p className="text-gray-500">{employeeDetail.employee_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[employeeDetail.employment_status] || statusColors.active}`}>
                      {statusLabels[employeeDetail.employment_status] || employeeDetail.employment_status}
                    </span>
                    {employeeDetail.employment_type && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {employmentTypeLabels[employeeDetail.employment_type] || employeeDetail.employment_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={handleEdit}>
                  <Edit className="w-4 h-4" />
                  Editar
                </Button>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Correo electrónico</p>
                  <p className="text-sm font-medium text-gray-900">{employeeDetail.email || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Briefcase className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Cargo</p>
                  <p className="text-sm font-medium text-gray-900">{employeeDetail.job_title || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Building className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Departamento</p>
                  <p className="text-sm font-medium text-gray-900">{employeeDetail.department || '-'}</p>
                </div>
              </div>

              {employeeDetail.cost_center && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Building className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Centro de Costo</p>
                    <p className="text-sm font-medium text-gray-900">{employeeDetail.cost_center}</p>
                  </div>
                </div>
              )}

              {employeeDetail.hire_date && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Fecha de contratación</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(employeeDetail.hire_date).toLocaleDateString('es-ES', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {employeeDetail.date_of_birth && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Fecha de nacimiento</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(employeeDetail.date_of_birth).toLocaleDateString('es-ES', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {employeeDetail.supervisor && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Supervisor</p>
                    <p className="text-sm font-medium text-gray-900">{employeeDetail.supervisor.name}</p>
                    <p className="text-xs text-gray-500">{employeeDetail.supervisor.job_title}</p>
                  </div>
                </div>
              )}

              {employeeDetail.vacation_balance_days !== null && employeeDetail.vacation_balance_days !== undefined && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-blue-600">Días de vacaciones disponibles</p>
                    <p className="text-sm font-medium text-blue-900">{employeeDetail.vacation_balance_days} días</p>
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Contact */}
            {(employeeDetail.emergency_contact_name || employeeDetail.emergency_contact_phone) && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Contacto de Emergencia</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employeeDetail.emergency_contact_name && (
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                      <User className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-xs text-orange-600">Nombre</p>
                        <p className="text-sm font-medium text-orange-900">{employeeDetail.emergency_contact_name}</p>
                      </div>
                    </div>
                  )}
                  {employeeDetail.emergency_contact_phone && (
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                      <Phone className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-xs text-orange-600">Teléfono</p>
                        <p className="text-sm font-medium text-orange-900">{employeeDetail.emergency_contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Badges */}
            {(employeeDetail.is_supervisor || employeeDetail.is_hr_staff || employeeDetail.is_hr_manager) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                {employeeDetail.is_supervisor && <Badge variant="info">Supervisor</Badge>}
                {employeeDetail.is_hr_staff && <Badge variant="info">Staff HR</Badge>}
                {employeeDetail.is_hr_manager && <Badge variant="success">Gerente HR</Badge>}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={handleCloseEdit}
        title={`Editar Empleado: ${selectedEmployee?.full_name || ''}`}
        size="lg"
      >
        {isLoadingDetail ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-200 rounded" />)}
          </div>
        ) : employeeDetail && (
          <EmployeeEditForm
            employee={employeeDetail}
            employees={employees}
            onSubmit={handleUpdate}
            onCancel={handleCloseEdit}
            loading={updateMutation.isPending}
            error={updateError}
          />
        )}
      </Modal>
    </div>
  )
}
