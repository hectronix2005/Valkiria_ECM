import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  AlertCircle,
  Save
} from 'lucide-react'

function CompanyModal({ company, isOpen, onClose }) {
  const queryClient = useQueryClient()
  const isEdit = !!company

  const [formData, setFormData] = useState({
    name: company?.name || '',
    nit: company?.nit || ''
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (data) => companyService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies'])
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Error al crear compañía')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => companyService.update(company.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies'])
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Error al actualizar compañía')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('El nombre es requerido')
      return
    }

    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar Compañía' : 'Nueva Compañía'}
          </h3>
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
            label="Nombre"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Mi Empresa S.A.S."
            required
          />

          <Input
            label="NIT"
            value={formData.nit}
            onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
            placeholder="Ej: 900123456-7"
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              <Save className="w-4 h-4" />
              {isEdit ? 'Guardar Cambios' : 'Crear Compañía'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Companies() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: companiesData, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.list()
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => companyService.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['companies']),
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => companyService.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries(['companies'])
  })

  const handleEdit = (company) => {
    setEditingCompany(company)
    setShowModal(true)
  }

  const handleToggle = (company) => {
    toggleMutation.mutate({ id: company.id, active: !company.active })
  }

  const handleDelete = (company) => {
    if (confirm(`¿Está seguro de eliminar la compañía "${company.name}"?`)) {
      deleteMutation.mutate(company.id)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCompany(null)
  }

  const companies = companiesData?.data?.data || []

  const filteredCompanies = searchQuery
    ? companies.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.nit && c.nit.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : companies

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compañías</h1>
          <p className="text-gray-500">Gestiona las compañías disponibles para asociar a plantillas</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Nueva Compañía
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar compañías..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay compañías
              </h3>
              <p className="text-gray-500 mb-4">
                {companies.length === 0
                  ? 'Crea tu primera compañía para asociarla a plantillas'
                  : 'No se encontraron compañías con los filtros aplicados'
                }
              </p>
              {companies.length === 0 && (
                <Button onClick={() => setShowModal(true)}>
                  <Plus className="w-4 h-4" />
                  Crear Compañía
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      NIT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} className={`${!company.active ? 'opacity-50 bg-gray-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary-500" />
                          <span className="font-medium">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {company.nit ? (
                          <code className="px-2 py-1 bg-gray-100 rounded text-xs">{company.nit}</code>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(company)}
                          className={`p-1 rounded ${company.active ? 'text-green-600' : 'text-gray-400'}`}
                          title={company.active ? 'Desactivar' : 'Activar'}
                        >
                          {company.active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(company)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(company)}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {companies.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Mostrando {filteredCompanies.length} de {companies.length} compañías
        </div>
      )}

      {/* Modal */}
      <CompanyModal
        company={editingCompany}
        isOpen={showModal}
        onClose={handleCloseModal}
      />
    </div>
  )
}
