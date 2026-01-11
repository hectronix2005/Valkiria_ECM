import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, User, ChevronDown, ChevronRight, Briefcase, Users, Search, ZoomIn, ZoomOut } from 'lucide-react'
import { employeeService } from '../../services/api'

// Employee node component
function EmployeeNode({ employee, employees, expanded, onToggle, level = 0 }) {
  const colaboradores = employees.filter(e => e.supervisor_id === employee.id)
  const hasColaboradores = colaboradores.length > 0
  const isExpanded = expanded[employee.id] !== false // Default expanded

  const getRoleBadge = (roles) => {
    if (!roles || roles.length === 0) return null
    const role = roles[0]
    const roleConfig = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Admin' },
      hr: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'RRHH' },
      hr_manager: { bg: 'bg-green-100', text: 'text-green-700', label: 'Gerente RRHH' },
      legal: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Legal' },
      manager: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Gerente' },
      employee: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Empleado' },
      viewer: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Visitante' },
    }
    const config = roleConfig[role] || roleConfig.employee
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'inactive': return 'bg-gray-400'
      case 'on_leave': return 'bg-yellow-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="flex flex-col items-center">
      {/* Employee Card */}
      <div
        className={`
          relative bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition-all
          ${level === 0 ? 'border-primary-400 bg-primary-50/30' : 'border-gray-200 hover:border-primary-300'}
          ${hasColaboradores ? 'cursor-pointer' : ''}
        `}
        onClick={() => hasColaboradores && onToggle(employee.id)}
        style={{ minWidth: '200px', maxWidth: '240px' }}
      >
        {/* Status indicator */}
        <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${getStatusColor(employee.employment_status)}`}
             title={employee.employment_status === 'active' ? 'Activo' : employee.employment_status} />

        <div className="p-4">
          {/* Avatar */}
          <div className="flex justify-center mb-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold
              ${level === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </div>
          </div>

          {/* Name */}
          <h3 className="text-sm font-semibold text-gray-900 text-center truncate">
            {employee.full_name || `${employee.first_name} ${employee.last_name}`}
          </h3>

          {/* Job Title */}
          <p className="text-xs text-gray-500 text-center truncate mt-1">
            {employee.job_title || 'Sin cargo'}
          </p>

          {/* Department & Role */}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {employee.department && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                {employee.department_label || employee.department}
              </span>
            )}
            {getRoleBadge(employee.roles)}
          </div>

          {/* Colaboradores count */}
          {hasColaboradores && (
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-gray-500">
              <Users className="w-3.5 h-3.5" />
              <span>{colaboradores.length} colaborador{colaboradores.length !== 1 ? 'es' : ''}</span>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>
      </div>

      {/* Colaboradores */}
      {hasColaboradores && isExpanded && (
        <>
          {/* Vertical connector */}
          <div className="w-0.5 h-6 bg-gray-300" />

          {/* Horizontal connector for multiple children */}
          {colaboradores.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div
                className="h-0.5 bg-gray-300"
                style={{
                  width: `${Math.min(colaboradores.length * 220, 880)}px`,
                  maxWidth: '100%'
                }}
              />
            </div>
          )}

          {/* Children container */}
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            {colaboradores.map(sub => (
              <div key={sub.id} className="flex flex-col items-center">
                {colaboradores.length > 1 && <div className="w-0.5 h-4 bg-gray-300" />}
                <EmployeeNode
                  employee={sub}
                  employees={employees}
                  expanded={expanded}
                  onToggle={onToggle}
                  level={level + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Stats card component
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function Orgchart() {
  const [expanded, setExpanded] = useState({})
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(100)

  // Fetch all employees
  const { data, isLoading, error } = useQuery({
    queryKey: ['employees-orgchart'],
    queryFn: () => employeeService.list({ per_page: 500 }),
  })

  const employees = data?.data?.data || []

  // Find root employees (those without supervisor or supervisor not in list)
  const employeeIds = new Set(employees.map(e => e.id))
  const rootEmployees = employees.filter(e => !e.supervisor_id || !employeeIds.has(e.supervisor_id))

  // Filter by search
  const filteredEmployees = search
    ? employees.filter(e =>
        e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.job_title?.toLowerCase().includes(search.toLowerCase()) ||
        e.department?.toLowerCase().includes(search.toLowerCase())
      )
    : employees

  const handleToggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: prev[id] === false ? true : false }))
  }

  const expandAll = () => {
    const all = {}
    employees.forEach(e => { all[e.id] = true })
    setExpanded(all)
  }

  const collapseAll = () => {
    const all = {}
    employees.forEach(e => { all[e.id] = false })
    setExpanded(all)
  }

  // Calculate stats
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.employment_status === 'active').length,
    departments: [...new Set(employees.map(e => e.department).filter(Boolean))].length,
    conEquipo: employees.filter(e => employees.some(col => col.supervisor_id === e.id)).length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        Error al cargar el organigrama: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Building2 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organigrama</h1>
            <p className="text-gray-500">Estructura organizacional de la empresa</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Empleados" value={stats.total} color="bg-blue-100 text-blue-600" />
        <StatCard icon={User} label="Activos" value={stats.active} color="bg-green-100 text-green-600" />
        <StatCard icon={Building2} label="Departamentos" value={stats.departments} color="bg-purple-100 text-purple-600" />
        <StatCard icon={Briefcase} label="Con Colaboradores" value={stats.conEquipo} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2">
            <button
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Reducir"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Ampliar"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Expand/Collapse */}
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Expandir Todo
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Colapsar Todo
            </button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {search && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">
            Resultados de búsqueda ({filteredEmployees.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium">
                  {emp.first_name?.[0]}{emp.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{emp.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{emp.job_title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-auto">
        <div
          className="min-w-max flex justify-center"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          {rootEmployees.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              {rootEmployees.length > 1 && (
                <p className="text-sm text-gray-500 mb-4">
                  {rootEmployees.length} líderes principales
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-8">
                {rootEmployees.map(emp => (
                  <EmployeeNode
                    key={emp.id}
                    employee={emp}
                    employees={employees}
                    expanded={expanded}
                    onToggle={handleToggle}
                    level={0}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay empleados registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
