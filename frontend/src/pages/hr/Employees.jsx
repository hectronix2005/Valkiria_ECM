import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService, templateService } from '../../services/api'
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
  Save,
  DollarSign,
  FileText,
  MapPin,
  CreditCard,
  Plus,
  UserPlus,
  Key,
  CheckCircle,
  FileDown,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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

const contractTypeOptions = [
  { value: 'indefinite', label: 'Termino Indefinido' },
  { value: 'fixed_term', label: 'Termino Fijo' },
  { value: 'work_or_labor', label: 'Obra o Labor' },
  { value: 'apprentice', label: 'Aprendizaje' },
]

const identificationTypeOptions = [
  { value: 'CC', label: 'Cedula de Ciudadania' },
  { value: 'CE', label: 'Cedula de Extranjeria' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'NIT', label: 'NIT' },
]

// Función para convertir números a palabras en español
const numberToWords = (amount) => {
  if (!amount || amount === 0) return 'cero pesos'

  const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve']
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  const n = Math.floor(parseFloat(amount))
  if (n === 0) return 'cero pesos'

  const helper = (num) => {
    if (num === 0) return ''
    if (num < 10) return units[num]
    if (num < 20) return teens[num - 10]
    if (num < 30) return num === 20 ? 'veinte' : 'veinti' + units[num - 20]
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 > 0 ? ' y ' + units[num % 10] : '')
    if (num === 100) return 'cien'
    if (num < 1000) return hundreds[Math.floor(num / 100)] + (num % 100 > 0 ? ' ' + helper(num % 100) : '')
    return num.toString()
  }

  const parts = []
  let remaining = n

  if (remaining >= 1000000) {
    const millions = Math.floor(remaining / 1000000)
    parts.push(millions === 1 ? 'un millon' : helper(millions) + ' millones')
    remaining %= 1000000
  }

  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000)
    parts.push(thousands === 1 ? 'mil' : helper(thousands) + ' mil')
    remaining %= 1000
  }

  if (remaining > 0) {
    parts.push(helper(remaining))
  }

  return parts.join(' ').trim() + ' pesos'
}

const contractTypeLabels = {
  indefinite: 'Termino Indefinido',
  fixed_term: 'Termino Fijo',
  work_or_labor: 'Obra o Labor',
  apprentice: 'Aprendizaje',
}

const durationUnitOptions = [
  { value: 'days', label: 'Dias' },
  { value: 'weeks', label: 'Semanas' },
  { value: 'months', label: 'Meses' },
  { value: 'years', label: 'Anos' },
]

const durationUnitLabels = {
  days: 'dias',
  weeks: 'semanas',
  months: 'meses',
  years: 'anos',
}

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

function EmployeeEditForm({ employee, employees, contractTemplates = [], onSubmit, onCancel, loading, error }) {
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
    // Contract fields
    contract_type: 'indefinite',
    contract_template_id: '',
    contract_start_date: '',
    contract_end_date: '',
    contract_duration_value: '',
    contract_duration_unit: 'months',
    trial_period_days: '60',
    // Compensation fields
    salary: '',
    food_allowance: '',
    transport_allowance: '',
    // Personal identification
    identification_type: 'CC',
    identification_number: '',
    place_of_birth: '',
    nationality: 'Colombiana',
    address: '',
    phone: '',
    personal_email: '',
  })

  const [activeTab, setActiveTab] = useState('laboral')

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
        // Contract fields
        contract_type: employee.contract_type || 'indefinite',
        contract_template_id: employee.contract_template_id || '',
        contract_start_date: employee.contract_start_date ? employee.contract_start_date.split('T')[0] : '',
        contract_end_date: employee.contract_end_date ? employee.contract_end_date.split('T')[0] : '',
        contract_duration_value: employee.contract_duration_value || '',
        contract_duration_unit: employee.contract_duration_unit || 'months',
        trial_period_days: employee.trial_period_days || '60',
        // Compensation fields
        salary: employee.salary || '',
        food_allowance: employee.food_allowance || '',
        transport_allowance: employee.transport_allowance || '',
        // Personal identification
        identification_type: employee.identification_type || 'CC',
        identification_number: employee.identification_number || '',
        place_of_birth: employee.place_of_birth || '',
        nationality: employee.nationality || 'Colombiana',
        address: employee.address || '',
        phone: employee.phone || '',
        personal_email: employee.personal_email || '',
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

  const tabs = [
    { id: 'laboral', label: 'Laboral', icon: Briefcase },
    { id: 'contrato', label: 'Contrato', icon: FileText },
    { id: 'compensacion', label: 'Compensacion', icon: DollarSign },
    { id: 'personal', label: 'Personal', icon: User },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Información Laboral */}
      {activeTab === 'laboral' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Numero de Empleado"
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
              label="Tipo de Empleo"
              options={employmentTypeOptions}
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
            />
            <div>
              <Select
                label="Supervisor *"
                options={supervisorOptions}
                value={formData.supervisor_id}
                onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
              />
              {!formData.supervisor_id && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Requerido para aprobaciones y firmas de documentos
                </p>
              )}
            </div>
            <Input
              label="Fecha de Contratacion"
              type="date"
              value={formData.hire_date}
              onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Tab: Contrato */}
      {activeTab === 'contrato' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Tipo de Contrato"
              options={contractTemplates.length > 0 ? contractTemplates : contractTypeOptions}
              value={contractTemplates.length > 0 ? formData.contract_template_id : formData.contract_type}
              onChange={(e) => {
                if (contractTemplates.length > 0) {
                  setFormData({ ...formData, contract_template_id: e.target.value })
                } else {
                  setFormData({ ...formData, contract_type: e.target.value })
                }
              }}
            />
            <Input
              label="Dias de Periodo de Prueba"
              type="number"
              value={formData.trial_period_days}
              onChange={(e) => setFormData({ ...formData, trial_period_days: e.target.value })}
              placeholder="60"
            />
            <Input
              label="Fecha de Inicio del Contrato"
              type="date"
              value={formData.contract_start_date}
              onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
            />
            {(formData.contract_type === 'fixed_term' || formData.contract_type === 'work_or_labor') && (
              <>
                <Input
                  label="Fecha de Fin del Contrato"
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duracion del Contrato</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={formData.contract_duration_value}
                      onChange={(e) => setFormData({ ...formData, contract_duration_value: e.target.value })}
                      placeholder="12"
                      className="flex-1"
                    />
                    <Select
                      options={durationUnitOptions}
                      value={formData.contract_duration_unit}
                      onChange={(e) => setFormData({ ...formData, contract_duration_unit: e.target.value })}
                      className="w-32"
                    />
                  </div>
                </div>
              </>
            )}
            {formData.employment_status === 'terminated' && (
              <Input
                label="Fecha de Terminacion"
                type="date"
                value={formData.termination_date}
                onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
              />
            )}
          </div>
        </div>
      )}

      {/* Tab: Compensación */}
      {activeTab === 'compensacion' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                label="Salario Mensual"
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                placeholder="2500000"
              />
              {formData.salary && (
                <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(formData.salary)}</p>
              )}
            </div>
            <div>
              <Input
                label="Auxilio de Alimentacion"
                type="number"
                value={formData.food_allowance}
                onChange={(e) => setFormData({ ...formData, food_allowance: e.target.value })}
                placeholder="0"
              />
              {formData.food_allowance > 0 && (
                <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(formData.food_allowance)}</p>
              )}
            </div>
            <div>
              <Input
                label="Auxilio de Transporte"
                type="number"
                value={formData.transport_allowance}
                onChange={(e) => setFormData({ ...formData, transport_allowance: e.target.value })}
                placeholder="140606"
              />
              {formData.transport_allowance > 0 && (
                <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(formData.transport_allowance)}</p>
              )}
            </div>
          </div>
          {(formData.salary || formData.food_allowance || formData.transport_allowance) && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                <span className="font-medium">Compensacion Total: </span>
                ${(
                  (parseFloat(formData.salary) || 0) +
                  (parseFloat(formData.food_allowance) || 0) +
                  (parseFloat(formData.transport_allowance) || 0)
                ).toLocaleString('es-CO')}
              </p>
              <p className="text-xs text-green-600 mt-1 italic">
                {numberToWords(
                  (parseFloat(formData.salary) || 0) +
                  (parseFloat(formData.food_allowance) || 0) +
                  (parseFloat(formData.transport_allowance) || 0)
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Personal */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {/* Identificación */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Identificacion</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Tipo de Documento"
                options={identificationTypeOptions}
                value={formData.identification_type}
                onChange={(e) => setFormData({ ...formData, identification_type: e.target.value })}
              />
              <Input
                label="Numero de Documento"
                value={formData.identification_number}
                onChange={(e) => setFormData({ ...formData, identification_number: e.target.value })}
                placeholder="1234567890"
              />
            </div>
          </div>

          {/* Datos personales */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Datos Personales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Fecha de Nacimiento"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
              <Input
                label="Lugar de Nacimiento"
                value={formData.place_of_birth}
                onChange={(e) => setFormData({ ...formData, place_of_birth: e.target.value })}
                placeholder="Bogota, Colombia"
              />
              <Input
                label="Nacionalidad"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                placeholder="Colombiana"
              />
              <Input
                label="Telefono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+57 300 123 4567"
              />
              <Input
                label="Correo Personal"
                type="email"
                value={formData.personal_email}
                onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                placeholder="correo@personal.com"
              />
              <div className="md:col-span-2">
                <Input
                  label="Direccion"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle 123 # 45-67, Bogota"
                />
              </div>
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
                label="Telefono del Contacto"
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                placeholder="+57 300 123 4567"
              />
            </div>
          </div>
        </div>
      )}

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

function EmployeeCreateForm({ employees = [], contractTemplates = [], onSubmit, onCancel, loading, error }) {
  const [formData, setFormData] = useState({
    // Datos básicos (requeridos)
    first_name: '',
    last_name: '',
    personal_email: '',
    identification_type: 'CC',
    identification_number: '',
    // Laboral
    employee_number: '',
    job_title: '',
    department: '',
    employment_status: 'active',
    employment_type: 'full_time',
    hire_date: new Date().toISOString().split('T')[0],
    supervisor_id: '',
    cost_center: '',
    // Contrato
    contract_type: 'indefinite',
    contract_template_id: '',
    contract_start_date: new Date().toISOString().split('T')[0],
    contract_end_date: '',
    contract_duration_value: '',
    contract_duration_unit: 'months',
    trial_period_days: '60',
    // Compensación
    salary: '',
    food_allowance: '',
    transport_allowance: '',
    // Personal
    date_of_birth: '',
    place_of_birth: '',
    nationality: 'Colombiana',
    address: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })

  const [activeTab, setActiveTab] = useState('basico')
  const [validationErrors, setValidationErrors] = useState({})

  const validateForm = () => {
    const errors = {}
    if (!formData.first_name.trim()) errors.first_name = 'Nombre es requerido'
    if (!formData.last_name.trim()) errors.last_name = 'Apellido es requerido'
    if (!formData.personal_email.trim()) errors.personal_email = 'Correo es requerido'
    if (!formData.identification_number.trim()) errors.identification_number = 'Número de documento es requerido'
    if (!formData.job_title.trim()) errors.job_title = 'Cargo es requerido'
    if (!formData.department) errors.department = 'Departamento es requerido'
    if (!formData.supervisor_id) errors.supervisor_id = 'Supervisor es requerido'
    if (!formData.hire_date) errors.hire_date = 'Fecha de contratación es requerida'
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) {
      // Ir al tab que tiene errores
      if (validationErrors.first_name || validationErrors.last_name || validationErrors.personal_email || validationErrors.identification_number) {
        setActiveTab('basico')
      } else if (validationErrors.job_title || validationErrors.department || validationErrors.supervisor_id || validationErrors.hire_date) {
        setActiveTab('laboral')
      }
      return
    }
    // Clean empty strings to null
    const cleanedData = { ...formData }
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === '') cleanedData[key] = null
    })
    onSubmit(cleanedData)
  }

  const supervisorOptions = [
    { value: '', label: 'Seleccionar supervisor *' },
    ...employees.map(e => ({ value: e.id, label: `${e.full_name} - ${e.job_title || 'Sin cargo'}` }))
  ]

  const tabs = [
    { id: 'basico', label: 'Datos Básicos', icon: User, required: true },
    { id: 'laboral', label: 'Laboral', icon: Briefcase, required: true },
    { id: 'contrato', label: 'Contrato', icon: FileText },
    { id: 'compensacion', label: 'Compensación', icon: DollarSign },
    { id: 'personal', label: 'Personal', icon: MapPin },
  ]

  const hasTabError = (tabId) => {
    if (tabId === 'basico') return validationErrors.first_name || validationErrors.last_name || validationErrors.personal_email || validationErrors.identification_number
    if (tabId === 'laboral') return validationErrors.job_title || validationErrors.department || validationErrors.supervisor_id || validationErrors.hire_date
    return false
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-3 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : hasTabError(tab.id)
                  ? 'border-red-300 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.required && <span className="text-red-500">*</span>}
              {hasTabError(tab.id) && <AlertCircle className="w-3 h-3 text-red-500" />}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Datos Básicos */}
      {activeTab === 'basico' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Información requerida:</strong> Estos datos son necesarios para crear la cuenta del empleado.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Nombre *"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Nombre"
                error={validationErrors.first_name}
              />
              {validationErrors.first_name && <p className="text-xs text-red-600 mt-1">{validationErrors.first_name}</p>}
            </div>
            <div>
              <Input
                label="Apellido *"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Apellido"
                error={validationErrors.last_name}
              />
              {validationErrors.last_name && <p className="text-xs text-red-600 mt-1">{validationErrors.last_name}</p>}
            </div>
            <div>
              <Input
                label="Correo Personal *"
                type="email"
                value={formData.personal_email}
                onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                placeholder="correo@personal.com"
                error={validationErrors.personal_email}
              />
              {validationErrors.personal_email && <p className="text-xs text-red-600 mt-1">{validationErrors.personal_email}</p>}
              <p className="text-xs text-gray-500 mt-1">Se usará para crear la cuenta de usuario</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select
                label="Tipo Doc *"
                options={identificationTypeOptions}
                value={formData.identification_type}
                onChange={(e) => setFormData({ ...formData, identification_type: e.target.value })}
              />
              <div className="col-span-2">
                <Input
                  label="Número de Documento *"
                  value={formData.identification_number}
                  onChange={(e) => setFormData({ ...formData, identification_number: e.target.value })}
                  placeholder="1234567890"
                  error={validationErrors.identification_number}
                />
                {validationErrors.identification_number && <p className="text-xs text-red-600 mt-1">{validationErrors.identification_number}</p>}
                <p className="text-xs text-gray-500 mt-1">Será la contraseña inicial</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Laboral */}
      {activeTab === 'laboral' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Número de Empleado"
              value={formData.employee_number}
              onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
              placeholder="EMP-001 (auto si vacío)"
            />
            <div>
              <Input
                label="Cargo *"
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="Ej: Desarrollador Senior"
                error={validationErrors.job_title}
              />
              {validationErrors.job_title && <p className="text-xs text-red-600 mt-1">{validationErrors.job_title}</p>}
            </div>
            <div>
              <Select
                label="Departamento *"
                options={[{ value: '', label: 'Seleccionar departamento *' }, ...departmentOptions.slice(1)]}
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
              {validationErrors.department && <p className="text-xs text-red-600 mt-1">{validationErrors.department}</p>}
            </div>
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
              label="Tipo de Empleo"
              options={employmentTypeOptions}
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
            />
            <div>
              <Select
                label="Supervisor *"
                options={supervisorOptions}
                value={formData.supervisor_id}
                onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
              />
              {validationErrors.supervisor_id && <p className="text-xs text-red-600 mt-1">{validationErrors.supervisor_id}</p>}
              {!formData.supervisor_id && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Requerido para aprobaciones y firmas
                </p>
              )}
            </div>
            <div>
              <Input
                label="Fecha de Contratación *"
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                error={validationErrors.hire_date}
              />
              {validationErrors.hire_date && <p className="text-xs text-red-600 mt-1">{validationErrors.hire_date}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Contrato */}
      {activeTab === 'contrato' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Tipo de Contrato"
              options={contractTemplates.length > 0 ? [{ value: '', label: 'Seleccionar template' }, ...contractTemplates] : contractTypeOptions}
              value={contractTemplates.length > 0 ? formData.contract_template_id : formData.contract_type}
              onChange={(e) => {
                if (contractTemplates.length > 0) {
                  setFormData({ ...formData, contract_template_id: e.target.value })
                } else {
                  setFormData({ ...formData, contract_type: e.target.value })
                }
              }}
            />
            <Input
              label="Días de Periodo de Prueba"
              type="number"
              value={formData.trial_period_days}
              onChange={(e) => setFormData({ ...formData, trial_period_days: e.target.value })}
              placeholder="60"
            />
            <Input
              label="Fecha de Inicio del Contrato"
              type="date"
              value={formData.contract_start_date}
              onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
            />
            {(formData.contract_type === 'fixed_term' || formData.contract_type === 'work_or_labor') && (
              <>
                <Input
                  label="Fecha de Fin del Contrato"
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración del Contrato</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={formData.contract_duration_value}
                      onChange={(e) => setFormData({ ...formData, contract_duration_value: e.target.value })}
                      placeholder="12"
                      className="flex-1"
                    />
                    <Select
                      options={durationUnitOptions}
                      value={formData.contract_duration_unit}
                      onChange={(e) => setFormData({ ...formData, contract_duration_unit: e.target.value })}
                      className="w-32"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab: Compensación */}
      {activeTab === 'compensacion' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                label="Salario Mensual"
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                placeholder="2500000"
              />
              {formData.salary && (
                <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(formData.salary)}</p>
              )}
            </div>
            <div>
              <Input
                label="Auxilio de Alimentación"
                type="number"
                value={formData.food_allowance}
                onChange={(e) => setFormData({ ...formData, food_allowance: e.target.value })}
                placeholder="0"
              />
              {formData.food_allowance > 0 && (
                <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(formData.food_allowance)}</p>
              )}
            </div>
            <div>
              <Input
                label="Auxilio de Transporte"
                type="number"
                value={formData.transport_allowance}
                onChange={(e) => setFormData({ ...formData, transport_allowance: e.target.value })}
                placeholder="140606"
              />
              {formData.transport_allowance > 0 && (
                <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(formData.transport_allowance)}</p>
              )}
            </div>
          </div>
          {(formData.salary || formData.food_allowance || formData.transport_allowance) && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                <span className="font-medium">Compensación Total: </span>
                ${(
                  (parseFloat(formData.salary) || 0) +
                  (parseFloat(formData.food_allowance) || 0) +
                  (parseFloat(formData.transport_allowance) || 0)
                ).toLocaleString('es-CO')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Personal */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Datos Personales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Fecha de Nacimiento"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
              <Input
                label="Lugar de Nacimiento"
                value={formData.place_of_birth}
                onChange={(e) => setFormData({ ...formData, place_of_birth: e.target.value })}
                placeholder="Bogotá, Colombia"
              />
              <Input
                label="Nacionalidad"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                placeholder="Colombiana"
              />
              <Input
                label="Teléfono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+57 300 123 4567"
              />
              <div className="md:col-span-2">
                <Input
                  label="Dirección"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle 123 # 45-67, Bogotá"
                />
              </div>
            </div>
          </div>
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
        </div>
      )}

      <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Los campos marcados con <span className="text-red-500">*</span> son obligatorios
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            <UserPlus className="w-4 h-4" />
            Crear Empleado
          </Button>
        </div>
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

function EmployeeTable({ employees, onView, sortColumn, sortDirection, onSort }) {
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />
  }

  const SortableHeader = ({ column, children, align = 'left' }) => (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none`}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {children}
        <SortIcon column={column} />
      </div>
    </th>
  )

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <SortableHeader column="full_name">Empleado</SortableHeader>
              <SortableHeader column="job_title">Cargo</SortableHeader>
              <SortableHeader column="department">Departamento</SortableHeader>
              <SortableHeader column="employment_status">Estado</SortableHeader>
              <SortableHeader column="hire_date">Fecha Ingreso</SortableHeader>
              <SortableHeader column="available_vacation_days" align="center">Vacaciones</SortableHeader>
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
                <td className="px-4 py-4 text-sm text-gray-600">
                  {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-CO') : '-'}
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {employee.available_vacation_days ?? 0} días
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
  const { isHR, isAdmin } = useAuth()
  const canEdit = isHR || isAdmin

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [contractTypeFilter, setContractTypeFilter] = useState('')
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [page, setPage] = useState(1)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [updateError, setUpdateError] = useState('')
  const [createError, setCreateError] = useState('')
  const [sortColumn, setSortColumn] = useState('full_name')
  const [sortDirection, setSortDirection] = useState('asc')

  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', { q: searchQuery, status: statusFilter, department: departmentFilter, page, sortColumn, sortDirection }],
    queryFn: () => employeeService.list({
      q: searchQuery || undefined,
      status: statusFilter || undefined,
      department: departmentFilter || undefined,
      sort_by: sortColumn,
      sort_direction: sortDirection,
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

  const createMutation = useMutation({
    mutationFn: (data) => employeeService.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['employees'])
      setShowCreateModal(false)
      setCreateError('')
      // Mostrar el empleado creado
      const newEmployee = response.data?.data
      if (newEmployee) {
        setSelectedEmployee(newEmployee)
        setShowDetailModal(true)
      }
    },
    onError: (error) => {
      setCreateError(error.response?.data?.error || error.response?.data?.errors?.join(', ') || 'Error al crear el empleado')
    }
  })

  const createAccountMutation = useMutation({
    mutationFn: (id) => employeeService.createAccount(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['employees'])
      queryClient.invalidateQueries(['employee', selectedEmployee?.id])
      alert(response.data.message || 'Cuenta creada exitosamente. La contraseña inicial es el número de cédula.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al crear la cuenta')
    }
  })

  const generateDocumentMutation = useMutation({
    mutationFn: ({ employeeId, templateId }) => employeeService.generateDocument(employeeId, templateId),
    onSuccess: (response) => {
      setShowTemplateModal(false)
      alert(response.data.message || 'Documento generado exitosamente. Puede descargarlo desde la sección de documentos.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Error al generar el documento')
    }
  })

  // Query for contract templates (always enabled for form and modal)
  const { data: templatesData } = useQuery({
    queryKey: ['templates', { category: 'contract', status: 'active' }],
    queryFn: () => templateService.list({ category: 'contract', status: 'active' }),
  })

  const contractTemplates = templatesData?.data?.data || []

  // Build contract type options from templates
  const contractTypeOptionsFromTemplates = contractTemplates.map(t => ({
    value: t.id,
    label: t.name
  }))

  const employeesRaw = data?.data?.data || []
  const meta = data?.data?.meta || {}
  const employeeDetail = detailData?.data?.data || selectedEmployee

  // Apply client-side filters and sorting
  const employees = employeesRaw
    .filter(e => {
      if (contractTypeFilter && e.contract_type !== contractTypeFilter) return false
      if (employmentTypeFilter && e.employment_type !== employmentTypeFilter) return false
      return true
    })
    .sort((a, b) => {
      let aVal, bVal
      switch (sortColumn) {
        case 'full_name':
          aVal = (a.full_name || '').toLowerCase()
          bVal = (b.full_name || '').toLowerCase()
          break
        case 'job_title':
          aVal = (a.job_title || '').toLowerCase()
          bVal = (b.job_title || '').toLowerCase()
          break
        case 'department':
          aVal = (a.department || '').toLowerCase()
          bVal = (b.department || '').toLowerCase()
          break
        case 'employment_status':
          aVal = statusLabels[a.employment_status] || a.employment_status || ''
          bVal = statusLabels[b.employment_status] || b.employment_status || ''
          break
        case 'hire_date':
          aVal = a.hire_date ? new Date(a.hire_date).getTime() : 0
          bVal = b.hire_date ? new Date(b.hire_date).getTime() : 0
          break
        case 'available_vacation_days':
          aVal = a.available_vacation_days ?? 0
          bVal = b.available_vacation_days ?? 0
          break
        default:
          aVal = (a.full_name || '').toLowerCase()
          bVal = (b.full_name || '').toLowerCase()
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setDepartmentFilter('')
    setContractTypeFilter('')
    setEmploymentTypeFilter('')
    setPage(1)
  }

  const hasFilters = searchQuery || statusFilter || departmentFilter || contractTypeFilter || employmentTypeFilter

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

  const handleCreateAccount = (employeeId) => {
    if (confirm('¿Crear cuenta de usuario para este empleado?\n\nLa contraseña inicial será el número de cédula y deberá cambiarla en el primer inicio de sesión.')) {
      createAccountMutation.mutate(employeeId)
    }
  }

  const handleOpenTemplateModal = () => {
    setShowTemplateModal(true)
  }

  const handleGenerateDocument = (templateId) => {
    if (selectedEmployee) {
      generateDocumentMutation.mutate({
        employeeId: selectedEmployee.id,
        templateId
      })
    }
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
        <div className="flex items-center gap-3">
          {canEdit && (
            <Button onClick={() => { setCreateError(''); setShowCreateModal(true); }}>
              <Plus className="w-4 h-4" />
              Agregar Empleado
            </Button>
          )}
          <div className="flex items-center gap-1 border-l pl-3 ml-2">
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
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
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
                className="w-48"
              />
              <Select
                options={[
                  { value: '', label: 'Tipo de contrato' },
                  ...contractTypeOptions
                ]}
                value={contractTypeFilter}
                onChange={(e) => { setContractTypeFilter(e.target.value); setPage(1) }}
                className="w-44"
              />
              <Select
                options={[
                  { value: '', label: 'Tipo de empleo' },
                  ...employmentTypeOptions
                ]}
                value={employmentTypeFilter}
                onChange={(e) => { setEmploymentTypeFilter(e.target.value); setPage(1) }}
                className="w-44"
              />
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Limpiar
                </button>
              )}
            </div>
            {/* Results counter */}
            {!isLoading && employeesRaw.length > 0 && (
              <div className="text-sm text-gray-500 flex items-center justify-between">
                <span>
                  Mostrando <strong>{employees.length}</strong> de <strong>{meta.total || employeesRaw.length}</strong> empleados
                  {sortColumn && (
                    <span className="ml-2 text-gray-400">
                      · Ordenado por {sortColumn === 'full_name' ? 'nombre' : sortColumn === 'job_title' ? 'cargo' : sortColumn === 'department' ? 'departamento' : sortColumn === 'employment_status' ? 'estado' : 'fecha ingreso'} ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})
                    </span>
                  )}
                </span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

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
            <EmployeeTable
              employees={employees}
              onView={handleView}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
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
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <Button variant="secondary" size="sm" onClick={handleOpenTemplateModal}>
                      <FileDown className="w-4 h-4" />
                      Generar Contrato
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleEdit}>
                      <Edit className="w-4 h-4" />
                      Editar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Estado de Cuenta */}
            {canEdit && (
              <div className={`p-4 rounded-lg ${employeeDetail.has_account ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {employeeDetail.has_account ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Cuenta de usuario activa</p>
                          <p className="text-xs text-green-600">{employeeDetail.user_email}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Key className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Sin cuenta de usuario</p>
                          <p className="text-xs text-amber-600">
                            {employeeDetail.personal_email
                              ? `Se creara con: ${employeeDetail.personal_email}`
                              : 'Agregue correo personal para crear cuenta'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  {!employeeDetail.has_account && employeeDetail.personal_email && employeeDetail.identification_number && (
                    <Button
                      size="sm"
                      onClick={() => handleCreateAccount(employeeDetail.id)}
                      loading={createAccountMutation.isPending}
                    >
                      <UserPlus className="w-4 h-4" />
                      Crear Cuenta
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Información Laboral */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Correo electronico</p>
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
                    <p className="text-xs text-blue-600">Dias de vacaciones disponibles</p>
                    <p className="text-sm font-medium text-blue-900">{employeeDetail.vacation_balance_days} dias</p>
                  </div>
                </div>
              )}
            </div>

            {/* Información de Contrato */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Informacion de Contrato
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Tipo de Contrato</p>
                    <p className="text-sm font-medium text-gray-900">
                      {employeeDetail.contract_template_name || contractTypeLabels[employeeDetail.contract_type] || employeeDetail.contract_type || '-'}
                    </p>
                  </div>
                </div>

                {employeeDetail.hire_date && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Fecha de Contratacion</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(employeeDetail.hire_date).toLocaleDateString('es-ES', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {employeeDetail.contract_start_date && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Inicio del Contrato</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(employeeDetail.contract_start_date).toLocaleDateString('es-ES', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {employeeDetail.contract_end_date && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Fin del Contrato</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(employeeDetail.contract_end_date).toLocaleDateString('es-ES', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {employeeDetail.contract_duration_value && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Duracion del Contrato</p>
                      <p className="text-sm font-medium text-gray-900">
                        {employeeDetail.contract_duration_value} {durationUnitLabels[employeeDetail.contract_duration_unit] || employeeDetail.contract_duration_unit}
                      </p>
                    </div>
                  </div>
                )}

                {employeeDetail.trial_period_days && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Periodo de Prueba</p>
                      <p className="text-sm font-medium text-gray-900">{employeeDetail.trial_period_days} dias</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Compensación */}
            {(employeeDetail.salary || employeeDetail.food_allowance || employeeDetail.transport_allowance) && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Compensacion
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {employeeDetail.salary && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-xs text-green-600">Salario Mensual</p>
                          <p className="text-sm font-medium text-green-900">
                            ${parseFloat(employeeDetail.salary).toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-1 italic ml-8">
                        {numberToWords(employeeDetail.salary)}
                      </p>
                    </div>
                  )}
                  {employeeDetail.food_allowance > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-xs text-green-600">Auxilio Alimentacion</p>
                          <p className="text-sm font-medium text-green-900">
                            ${parseFloat(employeeDetail.food_allowance).toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-1 italic ml-8">
                        {numberToWords(employeeDetail.food_allowance)}
                      </p>
                    </div>
                  )}
                  {employeeDetail.transport_allowance > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-xs text-green-600">Auxilio Transporte</p>
                          <p className="text-sm font-medium text-green-900">
                            ${parseFloat(employeeDetail.transport_allowance).toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-1 italic ml-8">
                        {numberToWords(employeeDetail.transport_allowance)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded-lg">
                  <p className="text-sm text-green-800">
                    <span className="font-medium">Compensacion Total: </span>
                    ${(
                      (parseFloat(employeeDetail.salary) || 0) +
                      (parseFloat(employeeDetail.food_allowance) || 0) +
                      (parseFloat(employeeDetail.transport_allowance) || 0)
                    ).toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-green-700 mt-1 italic">
                    {numberToWords(
                      (parseFloat(employeeDetail.salary) || 0) +
                      (parseFloat(employeeDetail.food_allowance) || 0) +
                      (parseFloat(employeeDetail.transport_allowance) || 0)
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Información Personal */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Informacion Personal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employeeDetail.identification_number && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Documento de Identidad</p>
                      <p className="text-sm font-medium text-gray-900">
                        {employeeDetail.identification_type || 'CC'}: {employeeDetail.identification_number}
                      </p>
                    </div>
                  </div>
                )}

                {employeeDetail.date_of_birth && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Fecha de Nacimiento</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(employeeDetail.date_of_birth).toLocaleDateString('es-ES', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {employeeDetail.place_of_birth && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Lugar de Nacimiento</p>
                      <p className="text-sm font-medium text-gray-900">{employeeDetail.place_of_birth}</p>
                    </div>
                  </div>
                )}

                {employeeDetail.nationality && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Nacionalidad</p>
                      <p className="text-sm font-medium text-gray-900">{employeeDetail.nationality}</p>
                    </div>
                  </div>
                )}

                {employeeDetail.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Telefono</p>
                      <p className="text-sm font-medium text-gray-900">{employeeDetail.phone}</p>
                    </div>
                  </div>
                )}

                {employeeDetail.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg md:col-span-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Direccion</p>
                      <p className="text-sm font-medium text-gray-900">{employeeDetail.address}</p>
                    </div>
                  </div>
                )}
              </div>
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
                        <p className="text-xs text-orange-600">Telefono</p>
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
            contractTemplates={contractTypeOptionsFromTemplates}
            onSubmit={handleUpdate}
            onCancel={handleCloseEdit}
            loading={updateMutation.isPending}
            error={updateError}
          />
        )}
      </Modal>

      {/* Template Selection Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Seleccionar Template de Contrato"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Seleccione el template que desea usar para generar el contrato de <strong>{employeeDetail?.full_name}</strong>
          </p>

          {contractTemplates.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay templates de contrato disponibles</p>
              <p className="text-sm text-gray-400 mt-1">Cree un template con categoría "contract" desde Admin → Templates</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contractTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleGenerateDocument(template.id)}
                  disabled={generateDocumentMutation.isPending}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{template.name}</p>
                      {template.description && (
                        <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      )}
                    </div>
                    <FileDown className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {generateDocumentMutation.isPending && (
            <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
              <span className="text-sm text-primary-700">Generando documento...</span>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowTemplateModal(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Employee Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Agregar Nuevo Empleado"
        size="lg"
      >
        <EmployeeCreateForm
          employees={employees}
          contractTemplates={contractTypeOptionsFromTemplates}
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowCreateModal(false)}
          loading={createMutation.isPending}
          error={createError}
        />
      </Modal>
    </div>
  )
}
