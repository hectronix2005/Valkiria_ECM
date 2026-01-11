import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { approvalService, contractApprovalService } from '../services/api'
import {
  Home,
  FileText,
  Folder,
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
  ChevronRight,
  User,
  Shield,
  UserCircle,
  Scale,
  Building2,
  FileCheck,
  Network
} from 'lucide-react'

const navigation = [
  { name: 'Inicio', href: '/', icon: Home },
  { name: 'Documentos', href: '/documents', icon: FileText },
  { name: 'Carpetas', href: '/folders', icon: Folder },
]

const hrNavigation = [
  { name: 'Mis Solicitudes', href: '/hr/my-requests/vacations', icon: FileText },
  { name: 'Organigrama', href: '/hr/organigrama', icon: Network },
]

const hrAdminNavigation = [
  { name: 'Aprobaciones', href: '/hr/approvals', icon: CheckSquare, badge: true },
  { name: 'Empleados', href: '/hr/employees', icon: Users },
  { name: 'Documentacion', href: '/hr/documents', icon: FileCheck },
  { name: 'Dashboard HR', href: '/hr/dashboard', icon: BarChart3 },
]

// Combined HR navigation based on user role
const getHrNavigation = (isSupervisor, isHR, employeeMode) => {
  if (employeeMode || (!isSupervisor && !isHR)) {
    return hrNavigation
  }
  return [...hrNavigation, ...hrAdminNavigation]
}

const adminNavigation = [
  { name: 'Configuración', href: '/admin/settings', icon: Settings },
  { name: 'Usuarios', href: '/admin/users', icon: Shield },
  { name: 'Áreas', href: '/admin/departments', icon: Building2 },
  { name: 'Templates', href: '/admin/templates', icon: FileText },
]

const legalNavigation = [
  { name: 'Contratos', href: '/legal/contracts', icon: FileText },
  { name: 'Aprobaciones', href: '/legal/approvals', icon: FileCheck, badge: true },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState([])
  const { user, logout, isAdmin, isHR, isSupervisor, employeeMode, toggleEmployeeMode, hasElevatedRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Fetch pending HR approvals count for badge
  const { data: hrApprovalsData } = useQuery({
    queryKey: ['hr-approvals-count'],
    queryFn: () => approvalService.list(),
    enabled: isSupervisor || isHR,
    refetchInterval: 60000,
  })

  // Fetch pending Legal approvals count for badge
  const { data: legalApprovalsData } = useQuery({
    queryKey: ['legal-approvals-count'],
    queryFn: () => contractApprovalService.list(),
    enabled: isAdmin || user?.roles?.includes('legal'),
    refetchInterval: 60000,
  })

  const pendingHRApprovalsCount = hrApprovalsData?.data?.meta?.total_pending || 0
  const pendingLegalApprovalsCount = legalApprovalsData?.data?.meta?.total_pending || 0

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const toggleSection = (sectionId) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const NavLink = ({ item }) => {
    // Check if active: exact match or starts with the base path (for sub-routes like my-requests)
    const isActive = location.pathname === item.href ||
      (item.href.includes('/my-requests') && location.pathname.startsWith('/hr/my-requests'))
    // Determine badge count based on route
    const getBadgeCount = () => {
      if (!item.badge) return 0
      if (item.href === '/hr/approvals') return pendingHRApprovalsCount
      if (item.href === '/legal/approvals') return pendingLegalApprovalsCount
      return 0
    }
    const badgeCount = getBadgeCount()

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
        {badgeCount > 0 && (
          <span className="ml-auto bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
            {badgeCount}
          </span>
        )}
      </Link>
    )
  }

  const CollapsibleSection = ({ id, title, items, icon: Icon }) => {
    const isExpanded = expandedSections.includes(id)
    const hasActiveItem = items.some(item =>
      location.pathname === item.href ||
      (item.href.includes('/my-requests') && location.pathname.startsWith('/hr/my-requests'))
    )

    return (
      <div className="mb-2">
        <button
          onClick={() => toggleSection(id)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            hasActiveItem
              ? 'text-primary-700 bg-primary-50/50'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" />}
            <span className="uppercase tracking-wider text-xs">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <div className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
        }`}>
          <nav className="space-y-1 pl-2">
            {items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </div>
      </div>
    )
  }

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
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <img src="/Valkiria.png" alt="Valkyria" className="w-full h-full object-cover scale-[1.15]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-900 leading-tight">
                <span className="text-primary-600">VAL</span>KYRIA
              </span>
              <span className="text-[9px] text-gray-400 tracking-wider">ECM</span>
            </div>
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
          {/* Mode Toggle for users with elevated roles */}
          {hasElevatedRole && (
            <div className="mb-4 p-2 bg-gray-50 rounded-lg">
              <button
                onClick={toggleEmployeeMode}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  employeeMode
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {employeeMode ? (
                  <>
                    <UserCircle className="w-4 h-4" />
                    <span>Modo Empleado</span>
                    <span className="ml-auto text-xs bg-primary-200 px-2 py-0.5 rounded">Activo</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Cambiar a Empleado</span>
                  </>
                )}
              </button>
            </div>
          )}

          <CollapsibleSection
            id="general"
            title="General"
            items={navigation}
            icon={Home}
          />

          <CollapsibleSection
            id="hr"
            title="Recursos Humanos"
            items={getHrNavigation(isSupervisor, isHR, employeeMode)}
            icon={Users}
          />

          {/* Only show elevated sections when NOT in employee mode */}
          {!employeeMode && (
            <>
              {(isAdmin || isHR) && (
                <CollapsibleSection
                  id="legal"
                  title="Gestión Legal"
                  items={legalNavigation}
                  icon={Scale}
                />
              )}

              {isAdmin && (
                <CollapsibleSection
                  id="system"
                  title="Sistema"
                  items={adminNavigation}
                  icon={Settings}
                />
              )}
            </>
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
