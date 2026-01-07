import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsService } from '../../services/api'
import {
  Building2,
  Users,
  FileText,
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'

const VACATION_POLICIES = [
  { value: 'monthly', label: 'Acumulación Mensual' },
  { value: 'yearly', label: 'Acumulación Anual' },
]

const FILE_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word (DOCX)' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'pptx', label: 'PowerPoint (PPTX)' },
  { value: 'jpg', label: 'Imagen JPG' },
  { value: 'png', label: 'Imagen PNG' },
  { value: 'gif', label: 'Imagen GIF' },
  { value: 'txt', label: 'Texto (TXT)' },
  { value: 'csv', label: 'CSV' },
]

export default function Settings() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('organization')
  const [formData, setFormData] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.get(),
    onSuccess: (response) => {
      const settings = response.data.data
      setFormData({
        // Organization
        name: settings.organization?.name || '',
        legal_name: settings.organization?.legal_name || '',
        tax_id: settings.organization?.tax_id || '',
        address: settings.organization?.address || '',
        city: settings.organization?.city || '',
        country: settings.organization?.country || 'Colombia',
        phone: settings.organization?.phone || '',
        email: settings.organization?.email || '',
        website: settings.organization?.website || '',
        // HR
        vacation_days_per_year: settings.hr?.vacation_days_per_year || 15,
        vacation_accrual_policy: settings.hr?.vacation_accrual_policy || 'monthly',
        max_vacation_carryover: settings.hr?.max_vacation_carryover || 15,
        probation_period_months: settings.hr?.probation_period_months || 2,
        // Documents
        allowed_file_types: settings.documents?.allowed_file_types || ['pdf', 'docx', 'xlsx'],
        max_file_size_mb: settings.documents?.max_file_size_mb || 25,
        document_retention_years: settings.documents?.document_retention_years || 10,
        // Security
        session_timeout_minutes: settings.security?.session_timeout_minutes || 480,
        password_min_length: settings.security?.password_min_length || 8,
        password_require_uppercase: settings.security?.password_require_uppercase ?? true,
        password_require_number: settings.security?.password_require_number ?? true,
        password_require_special: settings.security?.password_require_special ?? false,
        max_login_attempts: settings.security?.max_login_attempts || 5,
      })
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => settingsService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileTypeToggle = (type) => {
    setFormData(prev => ({
      ...prev,
      allowed_file_types: prev.allowed_file_types.includes(type)
        ? prev.allowed_file_types.filter(t => t !== type)
        : [...prev.allowed_file_types, type]
    }))
  }

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const tabs = [
    { id: 'organization', label: 'Organización', icon: Building2 },
    { id: 'hr', label: 'Recursos Humanos', icon: Users },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'security', label: 'Seguridad', icon: Shield },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-danger-600" />
        <span className="text-danger-700">Error al cargar configuración: {error.message}</span>
      </div>
    )
  }

  if (!formData) return null

  const settings = data?.data?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 mt-1">Administra la configuración del sistema</p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isLoading}
          className="btn-primary flex items-center gap-2"
        >
          {updateMutation.isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar Cambios
        </button>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success-600" />
          <span className="text-success-700">Configuración guardada correctamente</span>
        </div>
      )}

      {/* System Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-4">
        <Info className="w-5 h-5 text-gray-500" />
        <div className="text-sm text-gray-600">
          <span className="font-medium">{settings?.system?.app_name}</span>
          {' '}&bull;{' '}
          <span>v{settings?.system?.version}</span>
          {' '}&bull;{' '}
          <span className="capitalize">{settings?.system?.environment}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'organization' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Información de la Organización
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Empresa
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="input"
                  placeholder="Mi Empresa S.A.S."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => handleChange('legal_name', e.target.value)}
                  className="input"
                  placeholder="Mi Empresa S.A.S."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIT
                </label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => handleChange('tax_id', e.target.value)}
                  className="input"
                  placeholder="900.123.456-7"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="input"
                  placeholder="+57 601 234 5678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Corporativo
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="input"
                  placeholder="contacto@empresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sitio Web
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className="input"
                  placeholder="https://www.empresa.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="input"
                  placeholder="Calle 100 # 10-20, Oficina 501"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="input"
                  placeholder="Bogotá D.C."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="input"
                  placeholder="Colombia"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hr' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Configuración de Recursos Humanos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Días de Vacaciones por Año
                </label>
                <input
                  type="number"
                  value={formData.vacation_days_per_year}
                  onChange={(e) => handleChange('vacation_days_per_year', parseInt(e.target.value))}
                  className="input"
                  min="1"
                  max="30"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Según el CST Art. 186, mínimo 15 días hábiles
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Política de Acumulación
                </label>
                <select
                  value={formData.vacation_accrual_policy}
                  onChange={(e) => handleChange('vacation_accrual_policy', e.target.value)}
                  className="input"
                >
                  {VACATION_POLICIES.map((policy) => (
                    <option key={policy.value} value={policy.value}>
                      {policy.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máximo Días Acumulables
                </label>
                <input
                  type="number"
                  value={formData.max_vacation_carryover}
                  onChange={(e) => handleChange('max_vacation_carryover', parseInt(e.target.value))}
                  className="input"
                  min="0"
                  max="60"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Días que se pueden trasladar al siguiente año
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Período de Prueba (meses)
                </label>
                <input
                  type="number"
                  value={formData.probation_period_months}
                  onChange={(e) => handleChange('probation_period_months', parseInt(e.target.value))}
                  className="input"
                  min="0"
                  max="6"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Según el CST, máximo 2 meses
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Configuración de Documentos
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tipos de Archivo Permitidos
                </label>
                <div className="flex flex-wrap gap-2">
                  {FILE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleFileTypeToggle(type.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        formData.allowed_file_types.includes(type.value)
                          ? 'bg-primary-100 text-primary-700 border border-primary-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      .{type.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamaño Máximo de Archivo (MB)
                  </label>
                  <input
                    type="number"
                    value={formData.max_file_size_mb}
                    onChange={(e) => handleChange('max_file_size_mb', parseInt(e.target.value))}
                    className="input"
                    min="1"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retención de Documentos (años)
                  </label>
                  <input
                    type="number"
                    value={formData.document_retention_years}
                    onChange={(e) => handleChange('document_retention_years', parseInt(e.target.value))}
                    className="input"
                    min="1"
                    max="50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tiempo mínimo de conservación de documentos
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Configuración de Seguridad
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiempo de Sesión (minutos)
                </label>
                <input
                  type="number"
                  value={formData.session_timeout_minutes}
                  onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value))}
                  className="input"
                  min="15"
                  max="1440"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tiempo de inactividad antes de cerrar sesión
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Intentos Máximos de Login
                </label>
                <input
                  type="number"
                  value={formData.max_login_attempts}
                  onChange={(e) => handleChange('max_login_attempts', parseInt(e.target.value))}
                  className="input"
                  min="3"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bloqueo temporal después de estos intentos fallidos
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitud Mínima de Contraseña
                </label>
                <input
                  type="number"
                  value={formData.password_min_length}
                  onChange={(e) => handleChange('password_min_length', parseInt(e.target.value))}
                  className="input"
                  min="6"
                  max="20"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Requisitos de Contraseña
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_uppercase}
                    onChange={(e) => handleChange('password_require_uppercase', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Requiere mayúsculas</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_number}
                    onChange={(e) => handleChange('password_require_number', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Requiere números</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_special}
                    onChange={(e) => handleChange('password_require_special', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Requiere caracteres especiales</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
