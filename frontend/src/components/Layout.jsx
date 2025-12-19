import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { approvalService } from '../services/api'
import {
  Home,
  FileText,
  Folder,
  Calendar,
  Award,
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronDown,
  User
} from 'lucide-react'

const navigation = [
  { name: 'Inicio', href: '/', icon: Home },
  { name: 'Documentos', href: '/documents', icon: FileText },
  { name: 'Carpetas', href: '/folders', icon: Folder },
]

const hrNavigation = [
  { name: 'Mis Vacaciones', href: '/hr/vacations', icon: Calendar },
  { name: 'Mis Certificaciones', href: '/hr/certifications', icon: Award },
]

const approverNavigation = [
  { name: 'Aprobaciones', href: '/hr/approvals', icon: CheckSquare, badge: true },
]

const hrAdminNavigation = [
  { name: 'Empleados', href: '/hr/employees', icon: Users },
  { name: 'Dashboard HR', href: '/hr/dashboard', icon: BarChart3 },
]

const adminNavigation = [
  { name: 'Configuración', href: '/admin/settings', icon: Settings },
  { name: 'Templates', href: '/admin/templates', icon: FileText },
  { name: 'Variables', href: '/admin/variable-mappings', icon: Settings },
  { name: 'Firmantes', href: '/admin/signatory-types', icon: Users },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, logout, isAdmin, isHR, isSupervisor } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Fetch pending approvals count for badge
  const { data: approvalsData } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => approvalService.list(),
    enabled: isSupervisor || isHR,
    refetchInterval: 60000, // Refresh every minute
  })

  const pendingApprovalsCount = approvalsData?.data?.meta?.total_pending || 0

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.href
    return (
      <Link
        to={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <item.icon className="w-5 h-5" />
        {item.name}
        {item.badge && pendingApprovalsCount > 0 && (
          <span className="ml-auto bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
            {pendingApprovalsCount}
          </span>
        )}
      </Link>
    )
  }

  const NavSection = ({ title, items }) => (
    <div className="mb-6">
      <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">VALKYRIA</span>
          </Link>
          <button
            className="lg:hidden p-1 rounded hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="p-4 overflow-y-auto h-[calc(100%-4rem)]">
          <NavSection title="General" items={navigation} />
          <NavSection title="Recursos Humanos" items={hrNavigation} />

          {(isSupervisor || isHR) && (
            <NavSection title="Aprobaciones" items={approverNavigation} />
          )}

          {isHR && (
            <NavSection title="Administración HR" items={hrAdminNavigation} />
          )}

          {isAdmin && (
            <NavSection title="Sistema" items={adminNavigation} />
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-full px-4">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Search */}
              <div className="hidden md:flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar documentos..."
                    className="w-64 pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button className="relative p-2 rounded-lg hover:bg-gray-100">
                <Bell className="w-5 h-5 text-gray-500" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        Mi Perfil
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
