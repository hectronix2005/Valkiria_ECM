import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [employeeMode, setEmployeeMode] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('token')

    if (storedUser && token) {
      setUser(JSON.parse(storedUser))
      // Verify token is still valid
      authService.me()
        .then(res => {
          setUser(res.data.data)
          localStorage.setItem('user', JSON.stringify(res.data.data))
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const response = await authService.login(email, password)
    // API returns { data: {user info}, token: "..." }
    const { data: userData, token } = response.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch (e) {
      // Ignore logout errors
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const hasRole = useCallback((role) => {
    if (!user?.roles) return false
    // In employee mode, only allow 'employee' role
    if (employeeMode && role !== 'employee') return false
    return user.roles.includes(role) || user.roles.includes('admin')
  }, [user, employeeMode])

  const hasPermission = useCallback((permission) => {
    if (!user?.permissions) return false
    // In employee mode, deny elevated permissions
    if (employeeMode) return false
    if (user.permissions.includes('*')) return true
    return user.permissions.includes(permission)
  }, [user, employeeMode])

  // Real roles (unaffected by employee mode) - for toggle visibility
  const realIsAdmin = user?.roles?.includes('admin')
  const realIsHR = user?.is_hr || user?.roles?.includes('hr') || user?.roles?.includes('hr_manager')
  const realIsSupervisor = user?.is_supervisor || false
  const hasElevatedRole = realIsAdmin || realIsHR || realIsSupervisor

  // Effective roles (affected by employee mode) - for permission checks
  const isAdmin = employeeMode ? false : realIsAdmin
  const isHR = employeeMode ? false : realIsHR
  const isSupervisor = employeeMode ? false : realIsSupervisor
  const mustChangePassword = user?.must_change_password || false

  // Toggle employee mode
  const toggleEmployeeMode = useCallback(() => {
    setEmployeeMode(prev => !prev)
  }, [])

  const updateUser = useCallback((userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }, [])

  const value = {
    user,
    loading,
    login,
    logout,
    hasRole,
    hasPermission,
    isAdmin,
    isHR,
    isSupervisor,
    isAuthenticated: !!user,
    mustChangePassword,
    updateUser,
    // Employee mode
    employeeMode,
    toggleEmployeeMode,
    hasElevatedRole,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
