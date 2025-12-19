import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { certificationService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { FileText, Plus, X, Eye, Filter, Clock, CheckCircle, AlertCircle } from 'lucide-react'

const certificationTypes = [
  { value: 'employment', label: 'Certificación Laboral Básica' },
  { value: 'salary', label: 'Certificación con Salario' },
  { value: 'position', label: 'Certificación de Cargo' },
  { value: 'full', label: 'Certificación Completa' },
  { value: 'custom', label: 'Certificación Personalizada' },
]

const purposes = [
  { value: 'bank', label: 'Entidad Bancaria / Crédito' },
  { value: 'visa', label: 'Trámite de Visa' },
  { value: 'rental', label: 'Arrendamiento / Inmobiliaria' },
  { value: 'government', label: 'Trámite Gubernamental' },
  { value: 'legal', label: 'Proceso Legal' },
  { value: 'other', label: 'Otro' },
]

const deliveryMethods = [
  { value: 'digital', label: 'Digital (PDF)' },
  { value: 'physical', label: 'Física (Impresa)' },
  { value: 'both', label: 'Digital y Física' },
]

const languages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
]

const statusFilters = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'processing', label: 'En Proceso' },
  { value: 'completed', label: 'Completado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const typeFilters = [
  { value: '', label: 'Todos los tipos' },
  ...certificationTypes,
]

const typeLabels = {
  employment: 'Certificación Laboral',
  salary: 'Con Salario',
  position: 'Certificación de Cargo',
  full: 'Certificación Completa',
  custom: 'Personalizada',
}

const purposeLabels = {
  bank: 'Entidad Bancaria',
  visa: 'Trámite de Visa',
  rental: 'Arrendamiento',
  government: 'Trámite Gubernamental',
  legal: 'Proceso Legal',
  other: 'Otro',
}

const estimatedDays = {
  employment: 1,
  salary: 2,
  position: 1,
  full: 3,
  custom: 3,
}

function CertificationForm({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    certification_type: 'employment',
    purpose: 'bank',
    purpose_details: '',
    language: 'es',
    delivery_method: 'digital',
    addressee: '',
    include_salary: false,
    include_position: true,
    include_start_date: true,
    include_department: false,
    special_instructions: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const selectedType = formData.certification_type

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Tipo de Certificación"
        options={certificationTypes}
        value={formData.certification_type}
        onChange={(e) => setFormData({ ...formData, certification_type: e.target.value })}
        required
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-blue-700">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">
            Tiempo estimado: {estimatedDays[selectedType]} día{estimatedDays[selectedType] > 1 ? 's' : ''} hábil{estimatedDays[selectedType] > 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      <Select
        label="Propósito"
        options={purposes}
        value={formData.purpose}
        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
        required
      />

      {formData.purpose === 'other' && (
        <Input
          label="Especifique el propósito"
          value={formData.purpose_details}
          onChange={(e) => setFormData({ ...formData, purpose_details: e.target.value })}
          placeholder="Describa el propósito de la certificación..."
          required
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Idioma"
          options={languages}
          value={formData.language}
          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
        />
        <Select
          label="Método de Entrega"
          options={deliveryMethods}
          value={formData.delivery_method}
          onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value })}
        />
      </div>

      <Input
        label="Dirigido a (opcional)"
        value={formData.addressee}
        onChange={(e) => setFormData({ ...formData, addressee: e.target.value })}
        placeholder="Ej: A quien corresponda, Banco XYZ, Embajada..."
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Información a incluir
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={formData.include_start_date}
              onChange={(e) => setFormData({ ...formData, include_start_date: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">Fecha de ingreso</span>
          </label>
          <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={formData.include_position}
              onChange={(e) => setFormData({ ...formData, include_position: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">Cargo actual</span>
          </label>
          <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={formData.include_department}
              onChange={(e) => setFormData({ ...formData, include_department: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">Departamento</span>
          </label>
          <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={formData.include_salary}
              onChange={(e) => setFormData({ ...formData, include_salary: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">Información salarial</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Instrucciones especiales (opcional)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          value={formData.special_instructions}
          onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
          placeholder="Información adicional o requisitos especiales..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Solicitar Certificación
        </Button>
      </div>
    </form>
  )
}

function CertificationCard({ certification, onCancel, onView }) {
  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-yellow-500" />,
    processing: <Clock className="w-4 h-4 text-blue-500 animate-pulse" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    rejected: <AlertCircle className="w-4 h-4 text-red-500" />,
    cancelled: <X className="w-4 h-4 text-gray-400" />,
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {typeLabels[certification.certification_type] || certification.certification_type}
              </p>
              <p className="text-sm text-gray-500">
                {certification.request_number}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {purposeLabels[certification.purpose] || certification.purpose}
              </p>
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{certification.estimated_days} día{certification.estimated_days > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusIcons[certification.status]}
            <Badge status={certification.status} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={() => onView(certification)}>
            <Eye className="w-4 h-4" />
            Ver
          </Button>

          {['pending', 'processing'].includes(certification.status) && (
            <Button variant="danger" size="sm" onClick={() => onCancel(certification.id)}>
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Certifications() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCertification, setSelectedCertification] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['certifications', { status: statusFilter, type: typeFilter }],
    queryFn: () => certificationService.list({
      status: statusFilter || undefined,
      type: typeFilter || undefined
    }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => certificationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['certifications'])
      setShowNewModal(false)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => certificationService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['certifications'])
    },
  })

  const certifications = data?.data?.data || []

  const handleView = (certification) => {
    setSelectedCertification(certification)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificaciones</h1>
          <p className="text-gray-500">Solicita certificaciones laborales para distintos trámites</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="w-4 h-4" />
          Nueva Solicitud
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select
              options={statusFilters}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
            />
            <Select
              options={typeFilters}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-56"
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Certificación Laboral</p>
                <p className="text-sm text-blue-700">Confirma tu vínculo laboral actual</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Con Información Salarial</p>
                <p className="text-sm text-green-700">Incluye detalles de tu compensación</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-600" />
              <div>
                <p className="font-medium text-purple-900">Entrega Rápida</p>
                <p className="text-sm text-purple-700">1-3 días hábiles según el tipo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Certification List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-24 bg-gray-100 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : certifications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certifications.map((certification) => (
            <CertificationCard
              key={certification.id}
              certification={certification}
              onCancel={(id) => cancelMutation.mutate(id)}
              onView={handleView}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes solicitudes de certificaciones
            </h3>
            <p className="text-gray-500 mb-4">
              Solicita una certificación laboral para tus trámites
            </p>
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4" />
              Nueva Solicitud
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Certification Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nueva Solicitud de Certificación"
        size="lg"
      >
        <CertificationForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowNewModal(false)}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle de Certificación"
        size="md"
      >
        {selectedCertification && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Número:</span>
              <span className="font-medium">{selectedCertification.request_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Estado:</span>
              <Badge status={selectedCertification.status} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tipo:</span>
              <span>{typeLabels[selectedCertification.certification_type]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Propósito:</span>
              <span>{purposeLabels[selectedCertification.purpose]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tiempo estimado:</span>
              <span>{selectedCertification.estimated_days} día{selectedCertification.estimated_days > 1 ? 's' : ''} hábil{selectedCertification.estimated_days > 1 ? 'es' : ''}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Fecha solicitud:</span>
              <span>{new Date(selectedCertification.created_at).toLocaleDateString('es-ES')}</span>
            </div>

            {selectedCertification.language && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Idioma:</span>
                <span>{selectedCertification.language === 'es' ? 'Español' : 'Inglés'}</span>
              </div>
            )}

            {selectedCertification.delivery_method && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Entrega:</span>
                <span>
                  {selectedCertification.delivery_method === 'digital' && 'Digital (PDF)'}
                  {selectedCertification.delivery_method === 'physical' && 'Física (Impresa)'}
                  {selectedCertification.delivery_method === 'both' && 'Digital y Física'}
                </span>
              </div>
            )}

            {selectedCertification.status === 'completed' && selectedCertification.completed_at && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Fecha completado:</span>
                <span className="text-green-600 font-medium">
                  {new Date(selectedCertification.completed_at).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}

            {selectedCertification.status === 'rejected' && selectedCertification.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                <p className="text-sm font-medium text-red-800 mb-1">Motivo de rechazo:</p>
                <p className="text-red-700">{selectedCertification.rejection_reason}</p>
              </div>
            )}

            {selectedCertification.processed_by && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Procesado por:</p>
                <p className="text-gray-600">{selectedCertification.processed_by.name}</p>
              </div>
            )}

            {/* Download button for completed certifications */}
            {selectedCertification.status === 'completed' && selectedCertification.document_uuid && (
              <div className="pt-4 border-t">
                <Button className="w-full" variant="primary">
                  <FileText className="w-4 h-4" />
                  Descargar Certificación
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
