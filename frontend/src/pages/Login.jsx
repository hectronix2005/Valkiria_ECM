import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { FileText, AlertCircle, Users } from 'lucide-react'

const TEST_USERS = [
  { email: 'admin@valkyria.com', password: 'Admin123!', role: 'Admin', color: 'bg-red-100 text-red-700' },
  { email: 'hr.manager@valkyria.com', password: 'HrManager123!', role: 'Gerente RRHH', color: 'bg-purple-100 text-purple-700' },
  { email: 'hr.staff@valkyria.com', password: 'HrStaff123!', role: 'Staff RRHH', color: 'bg-indigo-100 text-indigo-700' },
  { email: 'supervisor@valkyria.com', password: 'Supervisor123!', role: 'Supervisor', color: 'bg-blue-100 text-blue-700' },
  { email: 'employee1@valkyria.com', password: 'Employee123!', role: 'Empleado', color: 'bg-green-100 text-green-700' },
  { email: 'employee2@valkyria.com', password: 'Employee123!', role: 'Empleado', color: 'bg-green-100 text-green-700' },
  { email: 'legal@valkyria.com', password: 'Legal123!', role: 'Legal', color: 'bg-amber-100 text-amber-700' },
  { email: 'viewer@valkyria.com', password: 'Viewer123!', role: 'Viewer', color: 'bg-gray-100 text-gray-700' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/'

  const fillTestUser = (testUser) => {
    setEmail(testUser.email)
    setPassword(testUser.password)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userData = await login(email, password)
      // Check if user must change password on first login
      if (userData.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <FileText className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">VALKYRIA ECM</h1>
          <p className="text-primary-200 mt-2">Sistema de Gestión de Contenido Empresarial</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
            Iniciar Sesión
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo Electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />

            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-gray-600">Recordarme</span>
              </label>
              <a href="#" className="text-primary-600 hover:text-primary-700">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              Iniciar Sesión
            </Button>
          </form>
        </div>

        {/* Test Users Panel */}
        <div className="mt-6 bg-white/10 backdrop-blur rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary-200" />
            <span className="text-sm font-medium text-primary-100">Usuarios de Prueba</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TEST_USERS.map((user) => (
              <button
                key={user.email}
                onClick={() => fillTestUser(user)}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-left"
              >
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${user.color}`}>
                  {user.role}
                </span>
                <span className="text-xs text-white truncate">{user.email.split('@')[0]}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-primary-300 mt-2 text-center">
            Click para autocompletar credenciales
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-200 text-sm mt-6">
          © 2025 VALKYRIA ECM. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
