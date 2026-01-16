import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ForceChangePassword from './pages/ForceChangePassword'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Vacations from './pages/hr/Vacations'
import Approvals from './pages/hr/Approvals'
import Employees from './pages/hr/Employees'
import Certifications from './pages/hr/Certifications'
import MyRequests from './pages/hr/MyRequests'
import HRDashboard from './pages/hr/HRDashboard'
import Orgchart from './pages/hr/Orgchart'
import HRDocuments from './pages/hr/HRDocuments'
import Templates from './pages/admin/Templates'
import TemplateEdit from './pages/admin/TemplateEdit'
// HRVariables is now integrated into HRDocuments.jsx
import SignatoryTypes from './pages/admin/SignatoryTypes'
import Settings from './pages/admin/Settings'
import Departments from './pages/admin/Departments'
import AdminUsers from './pages/admin/Users'
import Documents from './pages/Documents'
import Folders from './pages/Folders'
import ThirdParties from './pages/legal/ThirdParties'
// ThirdPartyTypes is now integrated into ThirdParties.jsx
import Contracts from './pages/legal/Contracts'
import ContractApprovals from './pages/legal/ContractApprovals'
// LegalVariables is now integrated into Contracts.jsx

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

  return <Layout>{children}</Layout>
}

// Placeholder pages
function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="text-6xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500">Esta sección está en desarrollo</p>
    </div>
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
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Force change password route */}
      <Route
        path="/change-password"
        element={isAuthenticated ? <ForceChangePassword /> : <Navigate to="/login" replace />}
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
