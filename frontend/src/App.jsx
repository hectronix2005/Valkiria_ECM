import { lazy, Suspense, Component, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import { reportFrontendError } from './services/api'

// Error Boundary - catches React render crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    reportFrontendError({
      message: error?.message || 'React render crash',
      error_class: error?.name || 'ReactError',
      backtrace: (error?.stack || '').split('\n').slice(0, 20),
      url: window.location.href,
      component: errorInfo?.componentStack?.split('\n')?.[1]?.trim() || 'Unknown',
      action_context: 'React render',
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-8">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Algo salio mal</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ocurrio un error inesperado. Intenta recargar la pagina.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
            >
              Recargar pagina
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Global error handlers - catches unhandled JS errors and promise rejections
function GlobalErrorHandlers() {
  useEffect(() => {
    const handleError = (event) => {
      reportFrontendError({
        message: event.message || 'Unhandled error',
        error_class: event.error?.name || 'WindowError',
        backtrace: (event.error?.stack || '').split('\n').slice(0, 20),
        url: window.location.href,
        component: `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`,
        action_context: 'window.onerror',
      })
    }

    const handleRejection = (event) => {
      const error = event.reason
      reportFrontendError({
        message: error?.message || String(error) || 'Unhandled promise rejection',
        error_class: error?.name || 'UnhandledRejection',
        backtrace: (error?.stack || '').split('\n').slice(0, 20),
        url: window.location.href,
        action_context: 'unhandledrejection',
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const ForceChangePassword = lazy(() => import('./pages/ForceChangePassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const MyRequests = lazy(() => import('./pages/hr/MyRequests'))
const Approvals = lazy(() => import('./pages/hr/Approvals'))
const Employees = lazy(() => import('./pages/hr/Employees'))
const HRDashboard = lazy(() => import('./pages/hr/HRDashboard'))
const Orgchart = lazy(() => import('./pages/hr/Orgchart'))
const HRDocuments = lazy(() => import('./pages/hr/HRDocuments'))
const Templates = lazy(() => import('./pages/admin/Templates'))
const TemplateEdit = lazy(() => import('./pages/admin/TemplateEdit'))
const Companies = lazy(() => import('./pages/admin/Companies'))
const SignatoryTypes = lazy(() => import('./pages/admin/SignatoryTypes'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Departments = lazy(() => import('./pages/admin/Departments'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const ErrorLogs = lazy(() => import('./pages/admin/ErrorLogs'))
const Permissions = lazy(() => import('./pages/admin/Permissions'))
const Documents = lazy(() => import('./pages/Documents'))
const Folders = lazy(() => import('./pages/Folders'))
const ThirdParties = lazy(() => import('./pages/legal/ThirdParties'))
const Contracts = lazy(() => import('./pages/legal/Contracts'))
const ContractApprovals = lazy(() => import('./pages/legal/ContractApprovals'))

// Loading spinner component
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    </div>
  )
}

// Protected Route wrapper
function ProtectedRoute({ children, requireHR = false, requireApprover = false, requireAdmin = false, requireStrictAdmin = false }) {
  const { isAuthenticated, loading, isHR, isSupervisor, isAdmin, hasAdminAccess } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireStrictAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  if (requireAdmin && !hasAdminAccess && !isHR) {
    return <Navigate to="/" replace />
  }

  if (requireHR && !isHR) {
    return <Navigate to="/" replace />
  }

  if (requireApprover && !isHR && !isSupervisor) {
    return <Navigate to="/" replace />
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </Layout>
  )
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <GlobalErrorHandlers />
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          )
        }
      />

      {/* Force change password route */}
      <Route
        path="/change-password"
        element={
          isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <ForceChangePassword />
            </Suspense>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* HR - My Requests (unified vacations + certifications) */}
      <Route
        path="/hr/my-requests"
        element={
          <ProtectedRoute>
            <MyRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/my-requests/:tab"
        element={
          <ProtectedRoute>
            <MyRequests />
          </ProtectedRoute>
        }
      />
      {/* Legacy routes - redirect to my-requests */}
      <Route path="/hr/vacations" element={<Navigate to="/hr/my-requests/vacations" replace />} />
      <Route path="/hr/vacations/new" element={<Navigate to="/hr/my-requests/vacations" replace />} />
      <Route path="/hr/certifications" element={<Navigate to="/hr/my-requests/certifications" replace />} />

      {/* HR - Approvals (supervisors/HR only) */}
      <Route
        path="/hr/approvals"
        element={
          <ProtectedRoute requireApprover>
            <Approvals />
          </ProtectedRoute>
        }
      />

      {/* HR - Employees (HR & Supervisors) */}
      <Route
        path="/hr/employees"
        element={
          <ProtectedRoute requireApprover>
            <Employees />
          </ProtectedRoute>
        }
      />

      {/* HR - Dashboard (HR only) */}
      <Route
        path="/hr/dashboard"
        element={
          <ProtectedRoute requireHR>
            <HRDashboard />
          </ProtectedRoute>
        }
      />

      {/* HR - Organigrama */}
      <Route
        path="/hr/organigrama"
        element={
          <ProtectedRoute>
            <Orgchart />
          </ProtectedRoute>
        }
      />

      {/* HR - Documentacion */}
      <Route
        path="/hr/documents"
        element={
          <ProtectedRoute requireApprover>
            <HRDocuments />
          </ProtectedRoute>
        }
      />

      {/* Documents */}
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <Documents />
          </ProtectedRoute>
        }
      />

      {/* Folders */}
      <Route
        path="/folders"
        element={
          <ProtectedRoute>
            <Folders />
          </ProtectedRoute>
        }
      />

      {/* Profile */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Admin - Settings */}
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requireAdmin>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Admin - Departments */}
      <Route
        path="/admin/departments"
        element={
          <ProtectedRoute requireAdmin>
            <Departments />
          </ProtectedRoute>
        }
      />

      {/* Admin - Users */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requireAdmin>
            <AdminUsers />
          </ProtectedRoute>
        }
      />

      {/* Admin - Templates */}
      <Route
        path="/admin/templates"
        element={<Navigate to="/admin/templates/legal" replace />}
      />
      <Route
        path="/admin/templates/legal"
        element={
          <ProtectedRoute requireAdmin>
            <Templates module="legal" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/templates/hr"
        element={
          <ProtectedRoute requireAdmin>
            <Templates module="hr" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/templates/:id"
        element={
          <ProtectedRoute requireAdmin>
            <TemplateEdit />
          </ProtectedRoute>
        }
      />

      {/* Admin - Companies */}
      <Route
        path="/admin/companies"
        element={
          <ProtectedRoute requireAdmin>
            <Companies />
          </ProtectedRoute>
        }
      />

      {/* Admin - Signatory Types */}
      <Route
        path="/admin/signatory-types"
        element={
          <ProtectedRoute requireAdmin>
            <SignatoryTypes />
          </ProtectedRoute>
        }
      />

      {/* Admin - Permissions (strict admin only) */}
      <Route
        path="/admin/permissions"
        element={
          <ProtectedRoute requireStrictAdmin>
            <Permissions />
          </ProtectedRoute>
        }
      />

      {/* Admin - Error Logs (strict admin only) */}
      <Route
        path="/admin/error-logs"
        element={
          <ProtectedRoute requireStrictAdmin>
            <ErrorLogs />
          </ProtectedRoute>
        }
      />

      {/* Legal - Third Parties */}
      <Route
        path="/legal/third-parties"
        element={
          <ProtectedRoute requireHR>
            <ThirdParties />
          </ProtectedRoute>
        }
      />

      {/* Legal - Contracts */}
      <Route
        path="/legal/contracts"
        element={
          <ProtectedRoute requireApprover>
            <Contracts />
          </ProtectedRoute>
        }
      />

      {/* Legal - Contract Approvals */}
      <Route
        path="/legal/approvals"
        element={
          <ProtectedRoute requireApprover>
            <ContractApprovals />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}
