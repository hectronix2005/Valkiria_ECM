import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { approvalService, contractApprovalService, notificationService } from '../services/api'
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
  Network,
  Check
} from 'lucide-react'

function formatTimeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return date.toLocaleDateString('es')
}

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
  { name: 'Plantillas HR', href: '/admin/templates/hr', icon: FileText },
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
  { name: 'Compañías', href: '/admin/companies', icon: Building2 },
  { name: 'Templates', href: '/admin/templates', icon: FileText },
]

const legalNavigation = [
  { name: 'Contratos', href: '/legal/contracts', icon: FileText },
  { name: 'Aprobaciones', href: '/legal/approvals', icon: FileCheck, badge: true },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState([])
  const { user, logout, isAdmin, isHR, isSupervisor, employeeMode, toggleEmployeeMode, hasElevatedRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notifRef = useRef(null)

  // Auto-redirect when entering employee mode from admin pages
  const handleToggleEmployeeMode = () => {
    const newMode = !employeeMode
    toggleEmployeeMode()

    // If switching TO employee mode from an admin/elevated page, redirect
    if (newMode) {
      const adminPaths = ['/admin', '/hr/approvals', '/hr/employees', '/hr/documents', '/hr/dashboard', '/legal']
      const isOnAdminPage = adminPaths.some(path => location.pathname.startsWith(path))
      if (isOnAdminPage) {
        navigate('/hr/my-requests/vacations')
      }
    }
  }

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

  // Notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list(),
    refetchInterval: 30000,
  })

  const notifications = notificationsData?.data?.data || []
  const unreadCount = notificationsData?.data?.meta?.unread_count || 0

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close notification dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
    setNotificationsOpen(false)
  }

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
            <div className={`mb-4 p-2 rounded-lg border-2 transition-colors ${
              employeeMode
                ? 'bg-amber-50 border-amber-300'
                : 'bg-gray-50 border-transparent'
            }`}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                Modo de Vista
              </div>
              <div className="flex gap-1">
                <button
                  onClick={employeeMode ? handleToggleEmployeeMode : undefined}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
                    !employeeMode
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={!employeeMode ? handleToggleEmployeeMode : undefined}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
                    employeeMode
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <UserCircle className="w-3.5 h-3.5" />
                  <span>Empleado</span>
                </button>
              </div>
              {employeeMode && (
                <p className="text-xs text-amber-700 mt-2 px-1">
                  Viendo como empleado regular
                </p>
              )}
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
              {isAdmin && (
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
              <div className="relative" ref={notifRef}>
                <button
                  className="relative p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                >
                  <Bell className="w-5 h-5 text-gray-500" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <Check className="w-3 h-3" />
                          Marcar todo como leído
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-400">
                          No hay notificaciones
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                              !n.read ? 'bg-primary-50/40' : ''
                            }`}
                          >
                            <div className="flex gap-3">
                              {!n.read && (
                                <div className="flex-shrink-0 mt-1.5">
                                  <span className="block w-2 h-2 bg-primary-500 rounded-full" />
                                </div>
                              )}
                              <div className={`flex-1 min-w-0 ${n.read ? 'pl-5' : ''}`}>
                                <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {n.actor_name && (
                                    <span className="text-xs text-gray-400">{n.actor_name}</span>
                                  )}
                                  <span className="text-xs text-gray-300">{formatTimeAgo(n.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

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
