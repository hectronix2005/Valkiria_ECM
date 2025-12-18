import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.delete('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', { user: data }),
  changePassword: (data) => api.patch('/auth/password', data),
}

// HR - Vacations
export const vacationService = {
  list: (params) => api.get('/hr/vacations', { params }),
  get: (id) => api.get(`/hr/vacations/${id}`),
  create: (data) => api.post('/hr/vacations', { vacation: data }),
  update: (id, data) => api.patch(`/hr/vacations/${id}`, { vacation: data }),
  submit: (id) => api.post(`/hr/vacations/${id}/submit`),
  cancel: (id, reason) => api.post(`/hr/vacations/${id}/cancel`, { reason }),
}

// HR - Certifications
export const certificationService = {
  list: (params) => api.get('/hr/certifications', { params }),
  get: (id) => api.get(`/hr/certifications/${id}`),
  create: (data) => api.post('/hr/certifications', { certification: data }),
  update: (id, data) => api.patch(`/hr/certifications/${id}`, { certification: data }),
  cancel: (id) => api.post(`/hr/certifications/${id}/cancel`),
}

// HR - Approvals
export const approvalService = {
  list: () => api.get('/hr/approvals'),
  get: (id) => api.get(`/hr/approvals/${id}`),
  approve: (id, data) => api.post(`/hr/approvals/${id}/approve`, data),
  reject: (id, reason) => api.post(`/hr/approvals/${id}/reject`, { reason }),
}

// HR - Employees
export const employeeService = {
  list: (params) => api.get('/hr/employees', { params }),
  get: (id) => api.get(`/hr/employees/${id}`),
  update: (id, data) => api.patch(`/hr/employees/${id}`, { employee: data }),
  getSubordinates: (id) => api.get(`/hr/employees/${id}/subordinates`),
  getVacationBalance: (id) => api.get(`/hr/employees/${id}/vacation_balance`),
}

// HR - Dashboard
export const dashboardService = {
  getStats: () => api.get('/hr/dashboard'),
}

// Content - Documents
export const documentService = {
  list: (params) => api.get('/content/documents', { params }),
  get: (id) => api.get(`/content/documents/${id}`),
  create: (data) => api.post('/content/documents', { document: data }),
  update: (id, data) => api.patch(`/content/documents/${id}`, { document: data }),
  delete: (id) => api.delete(`/content/documents/${id}`),
  lock: (id) => api.post(`/content/documents/${id}/lock`),
  unlock: (id) => api.post(`/content/documents/${id}/unlock`),
}

// Content - Folders
export const folderService = {
  list: (params) => api.get('/content/folders', { params }),
  getRoot: () => api.get('/content/folders/root'),
  get: (id) => api.get(`/content/folders/${id}`),
  create: (data) => api.post('/content/folders', { folder: data }),
  update: (id, data) => api.patch(`/content/folders/${id}`, { folder: data }),
  delete: (id) => api.delete(`/content/folders/${id}`),
}

// Search
export const searchService = {
  search: (query, params) => api.get('/search', { params: { q: query, ...params } }),
}

export default api
