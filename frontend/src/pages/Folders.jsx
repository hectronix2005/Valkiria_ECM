import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { folderService, generatedDocumentService } from '../services/api'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import {
  Folder,
  FolderPlus,
  FolderOpen,
  FileText,
  ChevronRight,
  Home,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
  X,
  AlertCircle,
  Search,
  FilePlus
} from 'lucide-react'

const FOLDER_COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#f43f5e', label: 'Rojo' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#eab308', label: 'Amarillo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#0ea5e9', label: 'Azul' },
  { value: '#6b7280', label: 'Gris' },
]

function FolderModal({ isOpen, onClose, folder = null, parentId = null }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [error, setError] = useState('')

  const isEditing = !!folder

  useEffect(() => {
    if (isOpen) {
      if (folder) {
        setName(folder.name || '')
        setDescription(folder.description || '')
        setColor(folder.color || '#6366f1')
      } else {
        setName('')
        setDescription('')
        setColor('#6366f1')
      }
      setError('')
    }
  }, [folder, isOpen])

  const createMutation = useMutation({
    mutationFn: (data) => folderService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['folders'])
      handleClose()
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al crear carpeta')
  })

  const updateMutation = useMutation({
    mutationFn: (data) => folderService.update(folder.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['folders'])
      handleClose()
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al actualizar carpeta')
  })

  const handleClose = () => {
    setName('')
    setDescription('')
    setColor('#6366f1')
    setError('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }

    const data = { name, description, color, parent_id: parentId }

    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Editar Carpeta' : 'Nueva Carpeta'}
          </h3>
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
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Contratos 2024"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la carpeta..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Guardar' : 'Crear Carpeta'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddDocumentModal({ isOpen, onClose, folder }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const { data: documentsData, isLoading } = useQuery({
    queryKey: ['available-documents'],
    queryFn: () => generatedDocumentService.list({ per_page: 100 }),
    enabled: isOpen
  })

  const addMutation = useMutation({
    mutationFn: (documentId) => folderService.addDocument(folder.id, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['folders'])
      queryClient.invalidateQueries(['folder', folder.id])
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al agregar documento')
  })

  const documents = documentsData?.data?.data || []
  const folderDocIds = folder?.documents?.map(d => d.id) || []

  const filteredDocs = documents.filter(doc => {
    if (folderDocIds.includes(doc.id)) return false
    if (!search) return true
    return doc.name.toLowerCase().includes(search.toLowerCase())
  })

  if (!isOpen || !folder) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Agregar Documento a "{folder.name}"</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {search ? 'No se encontraron documentos' : 'No hay documentos disponibles'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.template_name}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => addMutation.mutate(doc.id)}
                    loading={addMutation.isPending}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Folders() {
  const queryClient = useQueryClient()
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showAddDocModal, setShowAddDocModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState(null)
  const [menuOpen, setMenuOpen] = useState(null)

  // Fetch current folder details (if in subfolder)
  const { data: currentFolderData } = useQuery({
    queryKey: ['folder', currentFolderId],
    queryFn: () => folderService.get(currentFolderId),
    enabled: !!currentFolderId
  })

  // Fetch folders
  const { data: foldersData, isLoading } = useQuery({
    queryKey: ['folders', currentFolderId || 'root'],
    queryFn: () => folderService.list({ parent_id: currentFolderId || 'root' })
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => folderService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['folders'])
      setMenuOpen(null)
    }
  })

  const removeDocMutation = useMutation({
    mutationFn: ({ folderId, documentId }) => folderService.removeDocument(folderId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['folders'])
      queryClient.invalidateQueries(['folder', currentFolderId])
    }
  })

  const folders = foldersData?.data?.data || []
  const currentFolder = currentFolderData?.data?.data
  const breadcrumbs = currentFolder?.ancestors || []

  const handleOpenFolder = (folder) => {
    setCurrentFolderId(folder.id)
  }

  const handleGoBack = (folderId = null) => {
    setCurrentFolderId(folderId)
  }

  const handleEdit = (folder) => {
    setEditingFolder(folder)
    setShowFolderModal(true)
    setMenuOpen(null)
  }

  const handleDelete = (folder) => {
    if (folder.documents_count > 0 || folder.subfolders_count > 0) {
      alert('No se puede eliminar una carpeta que contiene documentos o subcarpetas')
      return
    }
    if (confirm(`¿Eliminar la carpeta "${folder.name}"?`)) {
      deleteMutation.mutate(folder.id)
    }
  }

  const handleNewFolder = () => {
    setEditingFolder(null)
    setShowFolderModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carpetas</h1>
          <p className="text-gray-500 mt-1">Organiza tus documentos en carpetas</p>
        </div>
        <Button onClick={handleNewFolder}>
          <FolderPlus className="w-4 h-4" />
          Nueva Carpeta
        </Button>
      </div>

      {/* Breadcrumbs */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => handleGoBack(null)}
              className={`flex items-center gap-1 hover:text-primary-600 ${
                !currentFolderId ? 'text-primary-600 font-medium' : 'text-gray-600'
              }`}
            >
              <Home className="w-4 h-4" />
              Inicio
            </button>
            {breadcrumbs.map((bc) => (
              <div key={bc.id} className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => handleGoBack(bc.id)}
                  className="text-gray-600 hover:text-primary-600"
                >
                  {bc.name}
                </button>
              </div>
            ))}
            {currentFolder && (
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-primary-600 font-medium">{currentFolder.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Folders & Subfolders */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
              ) : folders.length === 0 && !currentFolder ? (
                <div className="p-12 text-center">
                  <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay carpetas</h3>
                  <p className="text-gray-500 mb-4">Crea tu primera carpeta para organizar documentos</p>
                  <Button onClick={handleNewFolder}>
                    <FolderPlus className="w-4 h-4" />
                    Nueva Carpeta
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 group"
                    >
                      <button
                        onClick={() => handleOpenFolder(folder)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${folder.color}20` }}
                        >
                          <FolderOpen className="w-5 h-5" style={{ color: folder.color }} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{folder.name}</p>
                          <p className="text-sm text-gray-500">
                            {folder.documents_count} documentos
                            {folder.subfolders_count > 0 && ` • ${folder.subfolders_count} subcarpetas`}
                          </p>
                        </div>
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === folder.id ? null : folder.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpen === folder.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 w-36">
                            <button
                              onClick={() => handleEdit(folder)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Pencil className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(folder)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {folders.length === 0 && currentFolder && (
                    <div className="p-8 text-center text-gray-500">
                      No hay subcarpetas
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Folder Documents (when inside a folder) */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">
                  {currentFolder ? 'Documentos' : 'Selecciona una carpeta'}
                </h3>
                {currentFolder && (
                  <Button size="sm" variant="secondary" onClick={() => setShowAddDocModal(true)}>
                    <FilePlus className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {!currentFolder ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  Abre una carpeta para ver sus documentos
                </div>
              ) : currentFolder.documents?.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  No hay documentos en esta carpeta
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => setShowAddDocModal(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentFolder.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm truncate">{doc.name}</span>
                      </div>
                      <button
                        onClick={() => removeDocMutation.mutate({
                          folderId: currentFolder.id,
                          documentId: doc.id
                        })}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        title="Quitar de carpeta"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Folder Modal */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false)
          setEditingFolder(null)
        }}
        folder={editingFolder}
        parentId={currentFolderId}
      />

      {/* Add Document Modal */}
      <AddDocumentModal
        isOpen={showAddDocModal}
        onClose={() => setShowAddDocModal(false)}
        folder={currentFolder}
      />
    </div>
  )
}
