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
  forceChangePassword: (data) => api.post('/auth/password/force_change', data),
}

// Digital Signatures
export const signatureService = {
  list: () => api.get('/auth/signatures'),
  get: (id) => api.get(`/auth/signatures/${id}`),
  create: (data) => api.post('/auth/signatures', { signature: data }),
  update: (id, data) => api.patch(`/auth/signatures/${id}`, { signature: data }),
  delete: (id) => api.delete(`/auth/signatures/${id}`),
  setDefault: (id) => api.post(`/auth/signatures/${id}/set_default`),
  getFonts: () => api.get('/auth/signatures/fonts'),
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
  generateDocument: (id) => api.post(`/hr/certifications/${id}/generate_document`),
  downloadDocument: (id) => api.get(`/hr/certifications/${id}/download_document`, { responseType: 'blob' }),
}

// HR - Approvals
export const approvalService = {
  list: (params) => api.get('/hr/approvals', { params }),
  get: (id) => api.get(`/hr/approvals/${id}`),
  approve: (id, data) => api.post(`/hr/approvals/${id}/approve`, data),
  reject: (id, reason) => api.post(`/hr/approvals/${id}/reject`, { reason }),
}

// HR - Employees
export const employeeService = {
  list: (params) => api.get('/hr/employees', { params }),
  get: (id) => api.get(`/hr/employees/${id}`),
  create: (data) => api.post('/hr/employees', { employee: data }),
  update: (id, data) => api.patch(`/hr/employees/${id}`, { employee: data }),
  getSubordinates: (id) => api.get(`/hr/employees/${id}/subordinates`),
  getVacationBalance: (id) => api.get(`/hr/employees/${id}/vacation_balance`),
  createAccount: (id) => api.post(`/hr/employees/${id}/create_account`),
  generateDocument: (id, templateId) => api.post(`/hr/employees/${id}/generate_document`, { template_id: templateId }),
}

// HR - Dashboard
export const dashboardService = {
  getStats: () => api.get('/hr/dashboard'),
}

// Generated Documents (from templates)
export const generatedDocumentService = {
  list: (params) => api.get('/documents', { params }),
  get: (id) => api.get(`/documents/${id}`),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/documents/${id}`),
}

// Folders
export const folderService = {
  list: (params) => api.get('/folders', { params }),
  get: (id) => api.get(`/folders/${id}`),
  create: (data) => api.post('/folders', { folder: data }),
  update: (id, data) => api.patch(`/folders/${id}`, { folder: data }),
  delete: (id) => api.delete(`/folders/${id}`),
  addDocument: (folderId, documentId) => api.post(`/folders/${folderId}/documents`, { document_id: documentId }),
  removeDocument: (folderId, documentId) => api.delete(`/folders/${folderId}/documents/${documentId}`),
}

// Content - Documents
export const contentDocumentService = {
  list: (params) => api.get('/content/documents', { params }),
  get: (id) => api.get(`/content/documents/${id}`),
  create: (data) => api.post('/content/documents', { document: data }),
  update: (id, data) => api.patch(`/content/documents/${id}`, { document: data }),
  delete: (id) => api.delete(`/content/documents/${id}`),
  lock: (id) => api.post(`/content/documents/${id}/lock`),
  unlock: (id) => api.post(`/content/documents/${id}/unlock`),
}

// Content - Folders (legacy)
export const contentFolderService = {
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

// Admin - Signatory Types
export const signatoryTypeService = {
  list: (params) => api.get('/admin/signatory_types', { params }),
  get: (id) => api.get(`/admin/signatory_types/${id}`),
  create: (data) => api.post('/admin/signatory_types', { signatory_type: data }),
  update: (id, data) => api.patch(`/admin/signatory_types/${id}`, { signatory_type: data }),
  delete: (id) => api.delete(`/admin/signatory_types/${id}`),
  toggleActive: (id) => api.post(`/admin/signatory_types/${id}/toggle_active`),
  seedSystem: () => api.post('/admin/signatory_types/seed_system'),
  reorder: (ids) => api.post('/admin/signatory_types/reorder', { ids }),
}

// Admin - Variable Mappings
export const variableMappingService = {
  list: (params) => api.get('/admin/variable_mappings', { params }),
  grouped: () => api.get('/admin/variable_mappings/grouped'),
  get: (id) => api.get(`/admin/variable_mappings/${id}`),
  create: (data) => api.post('/admin/variable_mappings', { mapping: data }),
  update: (id, data) => api.patch(`/admin/variable_mappings/${id}`, { mapping: data }),
  delete: (id) => api.delete(`/admin/variable_mappings/${id}`),
  toggleActive: (id) => api.post(`/admin/variable_mappings/${id}/toggle_active`),
  seedSystem: () => api.post('/admin/variable_mappings/seed_system'),
  reorder: (ids) => api.post('/admin/variable_mappings/reorder', { ids }),
  pendingVariables: () => api.get('/admin/variable_mappings/pending_variables'),
  autoAssign: (data) => api.post('/admin/variable_mappings/auto_assign', data),
  createAndAssign: (data) => api.post('/admin/variable_mappings/create_and_assign', data),
  // Alias management
  aliases: () => api.get('/admin/variable_mappings/aliases'),
  merge: (primaryId, aliasIds) => api.post('/admin/variable_mappings/merge', { primary_id: primaryId, alias_ids: aliasIds }),
  createAlias: (sourceId, aliasName) => api.post('/admin/variable_mappings/create_alias', { source_id: sourceId, alias_name: aliasName }),
  removeAlias: (id) => api.delete(`/admin/variable_mappings/${id}/remove_alias`),
}

// Admin - Templates
export const templateService = {
  list: (params) => api.get('/admin/templates', { params }),
  get: (id) => api.get(`/admin/templates/${id}`),
  create: (data) => api.post('/admin/templates', data),
  update: (id, data) => api.patch(`/admin/templates/${id}`, data),
  delete: (id) => api.delete(`/admin/templates/${id}`),
  activate: (id) => api.post(`/admin/templates/${id}/activate`),
  archive: (id) => api.post(`/admin/templates/${id}/archive`),
  duplicate: (id) => api.post(`/admin/templates/${id}/duplicate`),
  upload: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/admin/templates/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  getCategories: () => api.get('/admin/templates/categories'),
  getVariableMappings: () => api.get('/admin/templates/variable_mappings'),
  reassignMappings: (id) => api.post(`/admin/templates/${id}/reassign_mappings`),
  download: (id) => api.get(`/admin/templates/${id}/download`, { responseType: 'blob' }),
  preview: (id) => api.get(`/admin/templates/${id}/preview`, { responseType: 'blob' }),

  // Signatories
  listSignatories: (templateId) => api.get(`/admin/templates/${templateId}/signatories`),
  createSignatory: (templateId, data) => api.post(`/admin/templates/${templateId}/signatories`, { signatory: data }),
  updateSignatory: (templateId, sigId, data) => api.patch(`/admin/templates/${templateId}/signatories/${sigId}`, { signatory: data }),
  deleteSignatory: (templateId, sigId) => api.delete(`/admin/templates/${templateId}/signatories/${sigId}`),
  reorderSignatories: (templateId, ids) => api.post(`/admin/templates/${templateId}/signatories/reorder`, { ids }),
}

export default api
