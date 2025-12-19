import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { FileText, AlertCircle, Lock, ShieldCheck } from 'lucide-react'

export default function ForceChangePassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const response = await authService.forceChangePassword({
        new_password: newPassword,
        new_password_confirmation: confirmPassword
      })

      // Update the token and user data
      if (response.data.token) {
        localStorage.setItem('token', response.data.token)
      }
      if (response.data.data) {
        updateUser(response.data.data)
      }

      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">Cambio de Contraseña</h1>
          <p className="text-amber-100 mt-2">Por seguridad, debes cambiar tu contraseña</p>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Bienvenido(a), {user?.first_name || 'Usuario'}</p>
                <p className="text-sm text-amber-700 mt-1">
                  Esta es tu primera vez iniciando sesion. Por razones de seguridad,
                  debes establecer una nueva contraseña antes de continuar.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nueva Contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              required
              autoFocus
            />

            <Input
              label="Confirmar Nueva Contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
            />

            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <p className="font-medium mb-1">Requisitos de la contraseña:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                <li>Minimo 6 caracteres</li>
                <li>No puede ser igual a tu numero de documento</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={loading}
                className="flex-1"
              >
                Cambiar Contraseña
              </Button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-amber-100 text-sm mt-6">
          VALKYRIA ECM - Sistema de Gestion de Contenido Empresarial
        </p>
      </div>
    </div>
  )
}
