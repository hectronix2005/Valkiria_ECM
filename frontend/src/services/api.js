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
  toggleActive: (id) => api.post(`/auth/signatures/${id}/toggle_active`),
  getFonts: () => api.get('/auth/signatures/fonts'),
}

// HR - Vacations
export const vacationService = {
  list: (params) => api.get('/hr/vacations', { params }),
  get: (id) => api.get(`/hr/vacations/${id}`),
  create: (data) => api.post('/hr/vacations', { vacation: data }),
  update: (id, data) => api.patch(`/hr/vacations/${id}`, { vacation: data }),
  delete: (id) => api.delete(`/hr/vacations/${id}`),
  submit: (id) => api.post(`/hr/vacations/${id}/submit`),
  cancel: (id, reason) => api.post(`/hr/vacations/${id}/cancel`, { reason }),
  generateDocument: (id) => api.post(`/hr/vacations/${id}/generate_document`),
  signDocument: (id) => api.post(`/hr/vacations/${id}/sign_document`),
  downloadDocument: (id) => api.get(`/hr/vacations/${id}/download_document`, { responseType: 'blob' }),
}

// HR - Certifications
export const certificationService = {
  list: (params) => api.get('/hr/certifications', { params }),
  get: (id) => api.get(`/hr/certifications/${id}`),
  create: (data) => api.post('/hr/certifications', { certification: data }),
  update: (id, data) => api.patch(`/hr/certifications/${id}`, { certification: data }),
  cancel: (id) => api.post(`/hr/certifications/${id}/cancel`),
  delete: (id) => api.delete(`/hr/certifications/${id}`),
  generateDocument: (id) => api.post(`/hr/certifications/${id}/generate_document`),
  signDocument: (id) => api.post(`/hr/certifications/${id}/sign_document`),
  downloadDocument: (id) => api.get(`/hr/certifications/${id}/download_document`, { responseType: 'blob' }),
  getAvailableTypes: () => api.get('/hr/certifications/available_types'),
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

// HR - Orgchart
export const orgchartService = {
  get: () => api.get('/hr/orgchart'),
}

// Generated Documents (from templates)
export const generatedDocumentService = {
  list: (params) => api.get('/documents', { params }),
  get: (id) => api.get(`/documents/${id}`),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/documents/${id}`),
  pendingSignatures: () => api.get('/documents/pending_signatures'),
  sign: (id) => api.post(`/documents/${id}/sign`),
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
  pendingVariables: (params) => api.get('/admin/variable_mappings/pending_variables', { params }),
  autoAssign: (data) => api.post('/admin/variable_mappings/auto_assign', data),
  createAndAssign: (data) => api.post('/admin/variable_mappings/create_and_assign', data),
  // Alias management (aliases are now stored directly in each mapping)
  aliases: () => api.get('/admin/variable_mappings/aliases'),
  addAlias: (id, aliasName) => api.post(`/admin/variable_mappings/${id}/add_alias`, { alias_name: aliasName }),
  removeAlias: (id, aliasName) => api.post(`/admin/variable_mappings/${id}/remove_alias`, { alias_name: aliasName }),
}

// Public - Templates (read-only, active only)
export const publicTemplateService = {
  list: (params) => api.get('/templates', { params }),
  get: (id) => api.get(`/templates/${id}`),
  getThirdPartyRequirements: (id) => api.get(`/templates/${id}/third_party_requirements`),
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
  // Third party requirements for legal templates
  getThirdPartyRequirements: (id) => api.get(`/admin/templates/${id}/third_party_requirements`),
}

// Legal - Third Party Types (admin-managed)
export const thirdPartyTypeService = {
  list: (params) => api.get('/legal/third_party_types', { params }),
  get: (id) => api.get(`/legal/third_party_types/${id}`),
  create: (data) => api.post('/legal/third_party_types', { third_party_type: data }),
  update: (id, data) => api.patch(`/legal/third_party_types/${id}`, { third_party_type: data }),
  delete: (id) => api.delete(`/legal/third_party_types/${id}`),
  toggleActive: (id) => api.post(`/legal/third_party_types/${id}/toggle_active`),
}

// Legal - Third Parties
export const thirdPartyService = {
  list: (params) => api.get('/legal/third_parties', { params }),
  get: (id) => api.get(`/legal/third_parties/${id}`),
  create: (data) => api.post('/legal/third_parties', { third_party: data }),
  update: (id, data) => api.patch(`/legal/third_parties/${id}`, { third_party: data }),
  delete: (id) => api.delete(`/legal/third_parties/${id}`),
  activate: (id) => api.post(`/legal/third_parties/${id}/activate`),
  deactivate: (id) => api.post(`/legal/third_parties/${id}/deactivate`),
  block: (id, reason) => api.post(`/legal/third_parties/${id}/block`, { reason }),
}

// Legal - Contracts
export const contractService = {
  list: (params) => api.get('/legal/contracts', { params }),
  get: (id) => api.get(`/legal/contracts/${id}`),
  create: (data) => api.post('/legal/contracts', { contract: data }),
  update: (id, data) => api.patch(`/legal/contracts/${id}`, { contract: data }),
  delete: (id) => api.delete(`/legal/contracts/${id}`),
  submit: (id) => api.post(`/legal/contracts/${id}/submit`),
  activate: (id) => api.post(`/legal/contracts/${id}/activate`),
  terminate: (id, reason) => api.post(`/legal/contracts/${id}/terminate`, { reason }),
  cancel: (id, reason) => api.post(`/legal/contracts/${id}/cancel`, { reason }),
  archive: (id) => api.post(`/legal/contracts/${id}/archive`),
  unarchive: (id) => api.post(`/legal/contracts/${id}/unarchive`),
  generateDocument: (id, templateId) => api.post(`/legal/contracts/${id}/generate_document`, { template_id: templateId }),
  signDocument: (id) => api.post(`/legal/contracts/${id}/sign_document`),
  downloadDocument: (id) => api.get(`/legal/contracts/${id}/download_document`, { responseType: 'blob' }),
  validateTemplate: (data) => api.post('/legal/contracts/validate_template', data),
}

// Legal - Contract Approvals
export const contractApprovalService = {
  list: (params) => api.get('/legal/contract_approvals', { params }),
  get: (id) => api.get(`/legal/contract_approvals/${id}`),
  approve: (id, notes) => api.post(`/legal/contract_approvals/${id}/approve`, { notes }),
  reject: (id, reason) => api.post(`/legal/contract_approvals/${id}/reject`, { reason }),
  sign: (id, position) => api.post(`/legal/contract_approvals/${id}/sign`, { signature_position: position }),
}

// Legal - Dashboard
export const legalDashboardService = {
  getStats: () => api.get('/legal/dashboard'),
}

// Admin - Settings
export const settingsService = {
  get: () => api.get('/admin/settings'),
  update: (data) => api.patch('/admin/settings', { settings: data }),
}

// Admin - Departments (Areas)
export const departmentService = {
  list: (params) => api.get('/admin/departments', { params }),
  get: (id) => api.get(`/admin/departments/${id}`),
  create: (data) => api.post('/admin/departments', { department: data }),
  update: (id, data) => api.patch(`/admin/departments/${id}`, { department: data }),
  delete: (id) => api.delete(`/admin/departments/${id}`),
  toggleActive: (id) => api.post(`/admin/departments/${id}/toggle_active`),
}

// Admin - Users
export const userService = {
  list: (params) => api.get('/admin/users', { params }),
  get: (id) => api.get(`/admin/users/${id}`),
  create: (data) => api.post('/admin/users', { user: data }),
  update: (id, data) => api.patch(`/admin/users/${id}`, { user: data }),
  delete: (id) => api.delete(`/admin/users/${id}`),
  toggleActive: (id) => api.post(`/admin/users/${id}/toggle_active`),
  assignRoles: (id, roleNames) => api.post(`/admin/users/${id}/assign_roles`, { role_names: roleNames }),
  getRoles: () => api.get('/admin/users/roles'),
  getStats: () => api.get('/admin/users/stats'),
}

export default api
