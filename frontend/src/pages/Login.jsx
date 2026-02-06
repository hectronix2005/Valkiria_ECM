import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { FileText, AlertCircle, Users, Eye, EyeOff, Clock, Star, TrendingUp, Shield, UserCheck, Briefcase } from 'lucide-react'

// Todas las credenciales del sistema organizadas por categoría
const ALL_USERS = [
  // Administradores
  {
    email: 'admin@valkyria.com',
    password: 'Admin123',
    role: 'Admin',
    color: 'bg-red-100 text-red-700',
    description: 'Carlos - Acceso total al sistema',
    category: 'admin'
  },
  {
    email: 'hectorneira2005@hotmail.com',
    password: 'Admin123',
    role: 'Admin',
    color: 'bg-red-100 text-red-700',
    description: 'Hector Neira - Admin principal',
    category: 'admin'
  },

  // Recursos Humanos
  {
    email: 'hr.manager@valkyria.com',
    password: 'HrManager123',
    role: 'Gerente RRHH',
    color: 'bg-purple-100 text-purple-700',
    description: 'María García - Gestiona empleados',
    category: 'hr'
  },
  {
    email: 'hr.staff@valkyria.com',
    password: 'HrStaff123',
    role: 'Staff RRHH',
    color: 'bg-indigo-100 text-indigo-700',
    description: 'Monica Beltran - Operaciones RRHH',
    category: 'hr'
  },

  // Legal
  {
    email: 'legal@valkyria.com',
    password: 'Admin123',
    role: 'Legal',
    color: 'bg-amber-100 text-amber-700',
    description: 'Nathalia Mendoza - Contratos y legal',
    category: 'legal'
  },

  // Supervisores
  {
    email: 'supervisor@valkyria.com',
    password: 'Supervisor123',
    role: 'Supervisor',
    color: 'bg-blue-100 text-blue-700',
    description: 'Roberto Martínez - Aprueba solicitudes',
    category: 'supervisor'
  },

  // Empleados
  {
    email: 'employee1@valkyria.com',
    password: 'Employee123',
    role: 'Empleado',
    color: 'bg-green-100 text-green-700',
    description: 'Juan Pérez - Software Developer',
    category: 'employee'
  },
  {
    email: 'employee2@valkyria.com',
    password: 'Employee123',
    role: 'Empleado',
    color: 'bg-green-100 text-green-700',
    description: 'Laura Sánchez - QA Engineer',
    category: 'employee'
  },
  {
    email: 'employee3@valkyria.com',
    password: 'Employee123',
    role: 'Empleado',
    color: 'bg-green-100 text-green-700',
    description: 'Pedro Ramírez - DevOps Engineer',
    category: 'employee'
  },
  {
    email: 'paulacarrillo1007@gmail.com',
    password: 'Employee123',
    role: 'Empleado',
    color: 'bg-green-100 text-green-700',
    description: 'Paula Carrillo - Empleada',
    category: 'employee'
  },
  {
    email: 'hector.prueba@valkyria.com',
    password: 'Employee123',
    role: 'Empleado',
    color: 'bg-green-100 text-green-700',
    description: 'Empleado Prueba H',
    category: 'employee'
  },
  {
    email: 'empleado.prueba@valkyria.com',
    password: 'Employee123',
    role: 'Empleado',
    color: 'bg-green-100 text-green-700',
    description: 'Empleado Prueba N',
    category: 'employee'
  },

  // Viewer
  {
    email: 'viewer@valkyria.com',
    password: 'Viewer123',
    role: 'Viewer',
    color: 'bg-gray-100 text-gray-700',
    description: 'Visitante Externo - Solo lectura',
    category: 'viewer'
  },
]

const STORAGE_KEY = 'valkyria_login_history'

// Helpers para gestionar historial de uso
const getLoginHistory = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

const saveLoginHistory = (history) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

const recordLogin = (email) => {
  const history = getLoginHistory()
  const now = Date.now()

  if (!history[email]) {
    history[email] = { count: 0, lastUsed: 0 }
  }

  history[email].count += 1
  history[email].lastUsed = now

  saveLoginHistory(history)
}

// Iconos por categoría
const categoryIcons = {
  admin: Shield,
  hr: UserCheck,
  legal: Briefcase,
  supervisor: Users,
  employee: Users,
  viewer: Eye
}

// Componente de tarjeta de usuario mejorado
function UserCard({ user, usageData, onSelect, isRecent, isMostUsed }) {
  const Icon = categoryIcons[user.category] || Users

  return (
    <button
      onClick={() => onSelect(user)}
      className={`
        relative flex flex-col p-2.5 rounded-lg transition-all text-left w-full
        ${isRecent
          ? 'bg-white/25 hover:bg-white/35 ring-2 ring-white/30'
          : 'bg-white/10 hover:bg-white/20'
        }
      `}
    >
      {/* Badges */}
      <div className="absolute -top-1 -right-1 flex gap-1">
        {isMostUsed && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-400 text-yellow-900 rounded text-[10px] font-bold">
            <Star className="w-2.5 h-2.5" />
          </span>
        )}
        {isRecent && !isMostUsed && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-400 text-blue-900 rounded text-[10px] font-bold">
            <Clock className="w-2.5 h-2.5" />
          </span>
        )}
      </div>

      {/* Role badge */}
      <span className={`inline-flex self-start px-2 py-0.5 rounded text-[10px] font-semibold ${user.color}`}>
        {user.role}
      </span>

      {/* Email */}
      <span className="text-xs text-white font-medium mt-1 truncate" title={user.email}>
        {user.email.length > 20 ? user.email.split('@')[0] : user.email.split('@')[0]}
      </span>

      {/* Description */}
      <span className="text-[10px] text-primary-200 mt-0.5 line-clamp-1">
        {user.description}
      </span>

      {/* Usage stats */}
      {usageData && usageData.count > 0 && (
        <div className="flex items-center gap-1 mt-1.5 text-[9px] text-primary-300">
          <TrendingUp className="w-2.5 h-2.5" />
          <span>{usageData.count}x</span>
        </div>
      )}
    </button>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginHistory, setLoginHistory] = useState({})
  const [showAllUsers, setShowAllUsers] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/'

  // Cargar historial al montar
  useEffect(() => {
    setLoginHistory(getLoginHistory())
  }, [])

  // Ordenar usuarios por uso
  const sortedUsers = useMemo(() => {
    const now = Date.now()
    const ONE_HOUR = 60 * 60 * 1000
    const ONE_DAY = 24 * ONE_HOUR

    return [...ALL_USERS].map(user => {
      const usage = loginHistory[user.email] || { count: 0, lastUsed: 0 }
      const timeSinceUse = now - usage.lastUsed

      // Score: prioriza uso reciente y frecuencia
      let score = usage.count * 10
      if (usage.lastUsed > 0) {
        if (timeSinceUse < ONE_HOUR) score += 1000
        else if (timeSinceUse < ONE_DAY) score += 500
      }

      return {
        ...user,
        usage,
        score,
        isRecent: usage.lastUsed > 0 && timeSinceUse < ONE_DAY,
        isMostUsed: false
      }
    }).sort((a, b) => b.score - a.score)
  }, [loginHistory])

  // Marcar el más usado
  const usersWithMostUsed = useMemo(() => {
    if (sortedUsers.length === 0) return sortedUsers

    const maxCount = Math.max(...sortedUsers.map(u => u.usage.count))
    if (maxCount === 0) return sortedUsers

    return sortedUsers.map((user, idx) => ({
      ...user,
      isMostUsed: user.usage.count === maxCount && maxCount > 0 && idx === 0
    }))
  }, [sortedUsers])

  // Usuarios a mostrar (primeros 8 o todos)
  const displayedUsers = showAllUsers ? usersWithMostUsed : usersWithMostUsed.slice(0, 8)

  const fillTestUser = (testUser) => {
    setEmail(testUser.email)
    setPassword(testUser.password)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Registrar uso antes del login
      recordLogin(email)
      setLoginHistory(getLoginHistory())

      const userData = await login(email, password)
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

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-36 h-36 mx-auto mb-4 rounded-full overflow-hidden shadow-2xl">
            <img src="/Valkiria.png" alt="Valkyria" className="w-full h-full object-cover scale-[1.15]" />
          </div>
          <h1 className="text-3xl font-bold text-white">VALKYRIA ECM</h1>
          <p className="text-primary-200 mt-2">Protegemos lo que importa</p>
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

            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

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

        {/* Test Users Panel - Solo visible en localhost */}
        {isDev && (
          <div className="mt-6 bg-white/10 backdrop-blur rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-200" />
                <span className="text-sm font-medium text-primary-100">
                  Usuarios ({ALL_USERS.length})
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-primary-300">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400" /> Favorito
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" /> Reciente
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {displayedUsers.map((user) => (
                <UserCard
                  key={user.email}
                  user={user}
                  usageData={user.usage}
                  onSelect={fillTestUser}
                  isRecent={user.isRecent}
                  isMostUsed={user.isMostUsed}
                />
              ))}
            </div>

            {ALL_USERS.length > 8 && (
              <button
                onClick={() => setShowAllUsers(!showAllUsers)}
                className="w-full mt-3 py-2 text-xs text-primary-200 hover:text-white transition-colors"
              >
                {showAllUsers
                  ? `Mostrar menos`
                  : `Ver todos (${ALL_USERS.length - 8} más)`
                }
              </button>
            )}

            <p className="text-[10px] text-primary-300 mt-2 text-center">
              Ordenados por frecuencia de uso
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-primary-200 text-sm mt-6">
          © 2025 VALKYRIA ECM. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
