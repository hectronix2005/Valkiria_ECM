import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Vacations from './pages/hr/Vacations'
import Approvals from './pages/hr/Approvals'
import Employees from './pages/hr/Employees'

// Protected Route wrapper
function ProtectedRoute({ children, requireHR = false, requireApprover = false }) {
  const { isAuthenticated, loading, isHR, isSupervisor } = useAuth()

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

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* HR - Vacations */}
      <Route
        path="/hr/vacations"
        element={
          <ProtectedRoute>
            <Vacations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/vacations/new"
        element={
          <ProtectedRoute>
            <Vacations />
          </ProtectedRoute>
        }
      />

      {/* HR - Certifications */}
      <Route
        path="/hr/certifications"
        element={
          <ProtectedRoute>
            <ComingSoon title="Certificaciones" />
          </ProtectedRoute>
        }
      />

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
            <ComingSoon title="Dashboard HR" />
          </ProtectedRoute>
        }
      />

      {/* Documents */}
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <ComingSoon title="Documentos" />
          </ProtectedRoute>
        }
      />

      {/* Folders */}
      <Route
        path="/folders"
        element={
          <ProtectedRoute>
            <ComingSoon title="Carpetas" />
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
          <ProtectedRoute>
            <ComingSoon title="Configuración" />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
