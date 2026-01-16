import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

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
const SignatoryTypes = lazy(() => import('./pages/admin/SignatoryTypes'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Departments = lazy(() => import('./pages/admin/Departments'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
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
function ProtectedRoute({ children, requireHR = false, requireApprover = false, requireAdmin = false }) {
  const { isAuthenticated, loading, isHR, isSupervisor, isAdmin } = useAuth()

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

  if (requireAdmin && !isAdmin && !isHR) {
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

      {/* Admin - Signatory Types */}
      <Route
        path="/admin/signatory-types"
        element={
          <ProtectedRoute requireAdmin>
            <SignatoryTypes />
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
  )
}
