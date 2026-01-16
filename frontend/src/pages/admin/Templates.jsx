import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { templateService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import {
  FileText,
  Plus,
  Search,
  Upload,
  Settings,
  Archive,
  CheckCircle,
  Clock,
  Copy,
  Trash2,
  Eye,
  Filter,
  X,
  AlertCircle,
  FileUp,
  Pencil,
  Download,
  Users
} from 'lucide-react'

const STATUS_LABELS = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Archivado', color: 'bg-yellow-100 text-yellow-700' }
}

// Certification types for the dropdown
const CERTIFICATION_TYPES = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'employment', label: 'Certificado de Empleo' },
  { value: 'salary', label: 'Certificado de Salario' },
  { value: 'position', label: 'Certificado de Cargo' },
  { value: 'full', label: 'Certificado Completo' },
  { value: 'custom', label: 'Certificado Personalizado' },
]

function CreateTemplateModal({ isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [moduleType, setModuleType] = useState('hr')
  const [mainCategory, setMainCategory] = useState('laboral')
  const [category, setCategory] = useState('other')
  const [certificationType, setCertificationType] = useState('')
  const [error, setError] = useState('')

  const { data: categoriesData } = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => templateService.getCategories()
  })

  const createMutation = useMutation({
    mutationFn: (data) => templateService.create({ template: data }),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['templates'])
      onSuccess(response.data.data)
      handleClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al crear template')
    }
  })

  const handleClose = () => {
    setName('')
    setDescription('')
    setModuleType('hr')
    setMainCategory('laboral')
    setCategory('other')
    setCertificationType('')
    setError('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }
    const data = { name, description, module_type: moduleType, main_category: mainCategory, category }
    // Include certification_type only for certification templates
    if (category === 'certification' && certificationType) {
      data.certification_type = certificationType
    }
    createMutation.mutate(data)
  }

  const modules = categoriesData?.data?.modules || []
  const mainCategories = categoriesData?.data?.main_categories || []
  const categoryToModule = categoriesData?.data?.category_to_module || {}
  const grouped = categoriesData?.data?.grouped || {}
  const filteredSubcategories = grouped[mainCategory] || []

  // Handle module change - auto-select matching main category
  const handleModuleChange = (value) => {
    setModuleType(value)
    // Find matching main category
    const matchingCategory = Object.entries(categoryToModule).find(([cat, mod]) => mod === value)
    if (matchingCategory) {
      setMainCategory(matchingCategory[0])
      const subs = grouped[matchingCategory[0]] || []
      if (subs.length > 0) {
        setCategory(subs[0].value)
      }
    }
  }

  // Auto-select first subcategory when main category changes
  const handleMainCategoryChange = (value) => {
    setMainCategory(value)
    // Update module based on category
    if (categoryToModule[value]) {
      setModuleType(categoryToModule[value])
    }
    const subs = grouped[value] || []
    if (subs.length > 0) {
      setCategory(subs[0].value)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Nuevo Template</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Input
            label="Nombre del Template"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Certificacion Laboral Estandar"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Módulo
            </label>
            <select
              value={moduleType}
              onChange={(e) => handleModuleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {modules.map((mod) => (
                <option key={mod.value} value={mod.value}>
                  {mod.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Define a qué módulo del sistema pertenece este template</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={mainCategory}
                onChange={(e) => handleMainCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {mainCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subcategoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {filteredSubcategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Certification type - only shown for certification templates */}
          {category === 'certification' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Certificación
              </label>
              <select
                value={certificationType}
                onChange={(e) => setCertificationType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CERTIFICATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Solo los tipos de certificación con template aparecerán en el selector de solicitudes
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion del proposito del template..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              <Plus className="w-4 h-4" />
              Crear Template
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditTemplateModal({ isOpen, onClose, template }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [moduleType, setModuleType] = useState('hr')
  const [mainCategory, setMainCategory] = useState('laboral')
  const [category, setCategory] = useState('')
  const [certificationType, setCertificationType] = useState('')
  const [error, setError] = useState('')

  const { data: categoriesData } = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => templateService.getCategories()
  })

  const updateMutation = useMutation({
    mutationFn: (data) => templateService.update(template?.id, { template: data }),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates'])
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al actualizar template')
    }
  })

  const modules = categoriesData?.data?.modules || []
  const grouped = categoriesData?.data?.grouped || {}
  const mainCategories = categoriesData?.data?.main_categories || []
  const categoryToModule = categoriesData?.data?.category_to_module || {}
  const filteredSubcategories = grouped[mainCategory] || []

  // Update form when template changes
  useEffect(() => {
    if (isOpen && template) {
      setName(template.name || '')
      setDescription(template.description || '')
      setModuleType(template.module_type || 'hr')
      setMainCategory(template.main_category || 'laboral')
      setCategory(template.category || 'other')
      setCertificationType(template.certification_type || '')
      setError('')
    }
  }, [isOpen, template?.id])

  // Handle module change - auto-select matching main category
  const handleModuleChange = (value) => {
    setModuleType(value)
    const matchingCategory = Object.entries(categoryToModule).find(([cat, mod]) => mod === value)
    if (matchingCategory) {
      setMainCategory(matchingCategory[0])
      const subs = grouped[matchingCategory[0]] || []
      if (subs.length > 0) {
        setCategory(subs[0].value)
      }
    }
  }

  const handleMainCategoryChange = (value) => {
    setMainCategory(value)
    if (categoryToModule[value]) {
      setModuleType(categoryToModule[value])
    }
    const subs = grouped[value] || []
    if (subs.length > 0 && !subs.find(s => s.value === category)) {
      setCategory(subs[0].value)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }
    const data = { name, description, module_type: moduleType, main_category: mainCategory, category }
    // Include certification_type for certification templates (can be empty to clear)
    if (category === 'certification') {
      data.certification_type = certificationType || null
    }
    updateMutation.mutate(data)
  }

  if (!isOpen || !template) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Editar Template</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Input
            label="Nombre del Template"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Certificacion Laboral Estandar"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Módulo
            </label>
            <select
              value={moduleType}
              onChange={(e) => handleModuleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {modules.map((mod) => (
                <option key={mod.value} value={mod.value}>
                  {mod.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Define a qué módulo del sistema pertenece este template</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={mainCategory}
                onChange={(e) => handleMainCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {mainCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subcategoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {filteredSubcategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Certification type - only shown for certification templates */}
          {category === 'certification' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Certificación
              </label>
              <select
                value={certificationType}
                onChange={(e) => setCertificationType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CERTIFICATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Solo los tipos de certificación con template aparecerán en el selector de solicitudes
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion del proposito del template..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              <Pencil className="w-4 h-4" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PreviewModal({ isOpen, onClose, template }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && template?.file_name) {
      loadPreview()
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [isOpen, template?.id])

  const loadPreview = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await templateService.preview(template.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar la previsualización')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }
    setError('')
    onClose()
  }

  const handleDownload = async () => {
    try {
      const response = await templateService.download(template.id)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = template.file_name || `${template.name}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al descargar el archivo')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Previsualización</h3>
            <p className="text-sm text-gray-500">{template?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              Descargar Word
            </Button>
            <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
                <p className="text-gray-500">Generando previsualización...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
                <Button variant="secondary" className="mt-4" onClick={loadPreview}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-lg border"
              title="Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No hay archivo para previsualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MAIN_CATEGORY_COLORS = {
  laboral: 'bg-blue-100 text-blue-700',
  comercial: 'bg-purple-100 text-purple-700',
  administrativo: 'bg-amber-100 text-amber-700'
}

const MODULE_COLORS = {
  hr: 'bg-emerald-100 text-emerald-700',
  legal: 'bg-indigo-100 text-indigo-700',
  admin: 'bg-slate-100 text-slate-700'
}

export default function Templates() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [templateToEdit, setTemplateToEdit] = useState(null)
  const [templateToPreview, setTemplateToPreview] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [mainCategoryFilter, setMainCategoryFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', { q: searchQuery, status: statusFilter, main_category: mainCategoryFilter, category: categoryFilter }],
    queryFn: () => templateService.list({
      q: searchQuery || undefined,
      status: statusFilter || undefined,
      main_category: mainCategoryFilter || undefined,
      category: categoryFilter || undefined
    })
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => templateService.getCategories()
  })

  const activateMutation = useMutation({
    mutationFn: (id) => templateService.activate(id),
    onSuccess: () => queryClient.invalidateQueries(['templates'])
  })

  const archiveMutation = useMutation({
    mutationFn: (id) => templateService.archive(id),
    onSuccess: () => queryClient.invalidateQueries(['templates'])
  })

  const duplicateMutation = useMutation({
    mutationFn: (id) => templateService.duplicate(id),
    onSuccess: () => queryClient.invalidateQueries(['templates'])
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => templateService.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['templates'])
  })

  const handleAction = (action, template) => {
    switch (action) {
      case 'preview':
        setTemplateToPreview(template)
        setShowPreviewModal(true)
        break
      case 'edit':
        setTemplateToEdit(template)
        setShowEditModal(true)
        break
      case 'activate':
        activateMutation.mutate(template.id)
        break
      case 'archive':
        archiveMutation.mutate(template.id)
        break
      case 'duplicate':
        duplicateMutation.mutate(template.id)
        break
      case 'delete':
        if (confirm('¿Esta seguro de eliminar este template?')) {
          deleteMutation.mutate(template.id)
        }
        break
    }
  }

  const templates = templatesData?.data?.data || []
  const mainCategories = categoriesData?.data?.main_categories || []
  const grouped = categoriesData?.data?.grouped || {}
  const filteredSubcategories = mainCategoryFilter ? (grouped[mainCategoryFilter] || []) : (categoriesData?.data?.subcategories || [])
  const meta = templatesData?.data?.meta || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates de Documentos</h1>
          <p className="text-gray-500">Gestiona los templates para generacion de documentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/signatory-types">
            <Button variant="secondary">
              <Users className="w-4 h-4" />
              Tipos de Firmantes
            </Button>
          </Link>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Nuevo Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="archived">Archivado</option>
            </select>

            <select
              value={mainCategoryFilter}
              onChange={(e) => {
                setMainCategoryFilter(e.target.value)
                setCategoryFilter('') // Reset subcategory when main changes
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas las categorías</option>
              {mainCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas las subcategorías</option>
              {filteredSubcategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay templates
              </h3>
              <p className="text-gray-500 mb-4">
                Crea tu primer template para comenzar a generar documentos
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" />
                Crear Template
              </Button>
            </div>
          ) : (
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-[30%] px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Template
                  </th>
                  <th className="w-[12%] px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Módulo
                  </th>
                  <th className="w-[15%] px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="w-[6%] px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                    Vars
                  </th>
                  <th className="w-[6%] px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                    Firm.
                  </th>
                  <th className="w-[10%] px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="w-[21%] px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {templates.map((template) => {
                  const status = STATUS_LABELS[template.status] || STATUS_LABELS.draft
                  return (
                    <tr key={template.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 bg-primary-50 rounded flex-shrink-0">
                            {template.file_name ? (
                              <FileText className="w-4 h-4 text-primary-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 text-sm truncate" title={template.name}>
                              {template.name}
                            </p>
                            {template.file_name && (
                              <p className="text-xs text-gray-400 truncate" title={template.file_name}>
                                {template.file_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${MODULE_COLORS[template.module_type] || 'bg-gray-100 text-gray-700'}`}>
                          {template.module_type_label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium w-fit ${MAIN_CATEGORY_COLORS[template.main_category] || 'bg-gray-100 text-gray-700'}`}>
                            {template.main_category_label}
                          </span>
                          <span className="text-xs text-gray-500">{template.category_label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                          {template.variables?.length || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                          {template.signatories_count || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          {template.file_name && (
                            <button
                              onClick={() => handleAction('preview', template)}
                              title="Previsualizar"
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleAction('edit', template)}
                            title="Editar"
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <Link to={`/admin/templates/${template.id}`}>
                            <button title="Configurar" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Settings className="w-4 h-4" />
                            </button>
                          </Link>
                          {template.status === 'draft' && template.file_name && (
                            <button
                              onClick={() => handleAction('activate', template)}
                              title="Activar"
                              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {template.status === 'active' && (
                            <button
                              onClick={() => handleAction('archive', template)}
                              title="Archivar"
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleAction('duplicate', template)}
                            title="Duplicar"
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {template.status === 'draft' && (
                            <button
                              onClick={() => handleAction('delete', template)}
                              title="Eliminar"
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {meta.total > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Mostrando {templates.length} de {meta.total} templates
        </div>
      )}

      {/* Create Modal */}
      <CreateTemplateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(template) => {
          // Navigate to template edit page
          window.location.href = `/admin/templates/${template.id}`
        }}
      />

      {/* Edit Modal */}
      <EditTemplateModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setTemplateToEdit(null)
        }}
        template={templateToEdit}
      />

      {/* Preview Modal */}
      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false)
          setTemplateToPreview(null)
        }}
        template={templateToPreview}
      />
    </div>
  )
}
