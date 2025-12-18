import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import {
  User,
  Mail,
  Building2,
  Briefcase,
  Shield,
  Calendar,
  Clock,
  Globe,
  Key,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Camera,
  Award,
  TrendingUp,
  CalendarDays,
  AlertTriangle
} from 'lucide-react'

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="p-2 bg-gray-50 rounded-lg">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || '-'}</p>
      </div>
    </div>
  )
}

function ProfileSection({ title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function VacationProgressBar({ used, total, label }) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{used} / {total} días</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function EditProfileModal({ user, isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    time_zone: user?.time_zone || 'UTC',
    locale: user?.locale || 'es'
  })
  const [error, setError] = useState('')

  const updateMutation = useMutation({
    mutationFn: (data) => authService.updateProfile(data),
    onSuccess: (response) => {
      onSuccess(response.data.data)
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al actualizar perfil')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    updateMutation.mutate(formData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Editar Perfil</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Input
            label="Nombre"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            required
          />

          <Input
            label="Apellido"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zona Horaria
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.time_zone}
              onChange={(e) => setFormData({ ...formData, time_zone: e.target.value })}
            >
              <option value="UTC">UTC</option>
              <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
              <option value="America/Bogota">Bogotá (GMT-5)</option>
              <option value="America/Lima">Lima (GMT-5)</option>
              <option value="America/Santiago">Santiago (GMT-4)</option>
              <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
              <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
              <option value="Europe/Madrid">Madrid (GMT+1)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Idioma
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.locale}
              onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              <Save className="w-4 h-4" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChangePasswordModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const passwordMutation = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: () => {
      setSuccess(true)
      setFormData({ current_password: '', new_password: '', confirm_password: '' })
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al cambiar contraseña')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (formData.new_password !== formData.confirm_password) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (formData.new_password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    passwordMutation.mutate({
      current_password: formData.current_password,
      password: formData.new_password,
      password_confirmation: formData.confirm_password
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Cambiar Contraseña</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">¡Contraseña actualizada!</p>
            <p className="text-sm text-gray-500 mt-1">Tu contraseña ha sido cambiada exitosamente</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Input
              label="Contraseña Actual"
              type="password"
              value={formData.current_password}
              onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
              required
            />

            <Input
              label="Nueva Contraseña"
              type="password"
              value={formData.new_password}
              onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
              required
              hint="Mínimo 8 caracteres"
            />

            <Input
              label="Confirmar Nueva Contraseña"
              type="password"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              required
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={passwordMutation.isPending}>
                <Key className="w-4 h-4" />
                Cambiar Contraseña
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatYears(years) {
  if (!years) return '0 años'
  const completeYears = Math.floor(years)
  const months = Math.round((years - completeYears) * 12)

  if (completeYears === 0 && months === 0) return 'Menos de 1 mes'
  if (completeYears === 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`
  if (months === 0) return `${completeYears} ${completeYears === 1 ? 'año' : 'años'}`
  return `${completeYears} ${completeYears === 1 ? 'año' : 'años'} y ${months} ${months === 1 ? 'mes' : 'meses'}`
}

export default function Profile() {
  const { user } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const handleProfileUpdate = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser))
    window.location.reload()
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700',
      hr: 'bg-purple-100 text-purple-700',
      legal: 'bg-blue-100 text-blue-700',
      employee: 'bg-green-100 text-green-700',
      viewer: 'bg-gray-100 text-gray-700'
    }
    return colors[role] || colors.employee
  }

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      hr: 'Recursos Humanos',
      legal: 'Legal',
      employee: 'Empleado',
      viewer: 'Visor'
    }
    return labels[role] || role
  }

  const vacation = user?.vacation || {}
  const employee = user?.employee || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-500">Gestiona tu información personal y preferencias</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary-600">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                  <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border hover:bg-gray-50">
                    <Camera className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{user?.full_name}</h2>
                  <p className="text-gray-500">{user?.email}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {employee.job_title} • {employee.department}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {user?.roles?.map((role) => (
                      <span
                        key={role}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(role)}`}
                      >
                        {getRoleLabel(role)}
                      </span>
                    ))}
                    {user?.is_supervisor && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        Supervisor
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button size="sm" onClick={() => setShowEditModal(true)}>
                      Editar Perfil
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowPasswordModal(true)}>
                      <Key className="w-4 h-4" />
                      Cambiar Contraseña
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Information */}
          <ProfileSection title="Información Laboral">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={User} label="Número de Empleado" value={employee.employee_number} />
              <InfoRow icon={Briefcase} label="Cargo" value={employee.job_title} />
              <InfoRow icon={Building2} label="Departamento" value={employee.department} />
              <InfoRow icon={CalendarDays} label="Fecha de Contratación" value={formatDate(employee.hire_date)} />
              <InfoRow icon={TrendingUp} label="Antigüedad" value={formatYears(vacation.years_of_service)} />
              <InfoRow icon={Award} label="Años Completos" value={`${vacation.complete_years || 0} años`} />
            </div>
          </ProfileSection>

          {/* Contact Information */}
          <ProfileSection title="Información de Contacto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={Mail} label="Correo Electrónico" value={user?.email} />
              <InfoRow icon={Building2} label="Organización" value="VALKYRIA Corp" />
            </div>
          </ProfileSection>

          {/* Preferences */}
          <ProfileSection title="Preferencias">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={Globe} label="Idioma" value={user?.locale === 'es' ? 'Español' : 'English'} />
              <InfoRow icon={Clock} label="Zona Horaria" value={user?.time_zone || 'UTC'} />
            </div>
          </ProfileSection>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vacation Card - Main */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                Vacaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Balance */}
              <div className="text-center py-4 bg-primary-50 rounded-xl">
                <p className="text-4xl font-bold text-primary-600">
                  {vacation.days_available || 0}
                </p>
                <p className="text-sm text-primary-700 mt-1">Días disponibles</p>
              </div>

              {/* Policy Info */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">Política: Ley Laboral Colombiana</p>
                <p className="text-xs text-blue-600 mt-1">
                  {vacation.days_per_year || 15} días hábiles por año de servicio
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Días causados (total)</span>
                  <span className="font-medium">{vacation.days_accrued_total?.toFixed(1) || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Días usados (total)</span>
                  <span className="font-medium">{vacation.days_used_total || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Días pendientes</span>
                  <span className="font-medium text-primary-600">{vacation.days_pending?.toFixed(1) || 0}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Máximo acumulable</span>
                    <span className="font-medium">{vacation.max_accumulation_days || 30} días</span>
                  </div>
                </div>
              </div>

              {/* Warning if days expiring */}
              {vacation.days_expiring > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      {vacation.days_expiring.toFixed(1)} días por vencer
                    </p>
                    <p className="text-xs text-yellow-600">
                      Exceden el máximo acumulable de {vacation.max_accumulation_days} días
                    </p>
                  </div>
                </div>
              )}

              {/* Cash compensation info */}
              {vacation.can_compensate_cash && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Puedes compensar hasta {vacation.max_cash_compensation} días en efectivo
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Disponible después de 4 años de servicio
                  </p>
                </div>
              )}

              {/* Progress bar */}
              <div className="pt-2">
                <VacationProgressBar
                  used={vacation.days_used_total || 0}
                  total={vacation.days_accrued_total || 0}
                  label="Días usados vs causados"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Contraseña</span>
                <Badge status="approved">Configurada</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Último acceso</span>
                <span className="text-sm text-gray-900">Hoy</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowPasswordModal(true)}
              >
                Cambiar Contraseña
              </Button>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Permisos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {user?.permissions?.slice(0, 6).map((permission) => (
                  <div
                    key={permission}
                    className="flex items-center gap-2 text-sm"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-600">
                      {permission === '*' ? 'Acceso completo' : permission.replace('.', ' - ')}
                    </span>
                  </div>
                ))}
                {user?.permissions?.length > 6 && (
                  <p className="text-xs text-gray-400 mt-2">
                    +{user.permissions.length - 6} permisos más
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <EditProfileModal
        user={user}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleProfileUpdate}
      />

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  )
}
