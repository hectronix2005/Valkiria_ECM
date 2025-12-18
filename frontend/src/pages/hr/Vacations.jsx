import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { vacationService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Calendar, Plus, Send, X, Eye, Filter } from 'lucide-react'

const vacationTypes = [
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'personal', label: 'Día Personal' },
  { value: 'sick', label: 'Enfermedad' },
  { value: 'bereavement', label: 'Duelo' },
  { value: 'unpaid', label: 'Sin Goce' },
]

const statusFilters = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'cancelled', label: 'Cancelado' },
]

function VacationForm({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    vacation_type: 'vacation',
    start_date: '',
    end_date: '',
    days_requested: '',
    reason: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Tipo de Solicitud"
        options={vacationTypes}
        value={formData.vacation_type}
        onChange={(e) => setFormData({ ...formData, vacation_type: e.target.value })}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Fecha Inicio"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          required
        />
        <Input
          label="Fecha Fin"
          type="date"
          value={formData.end_date}
          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          required
        />
      </div>

      <Input
        label="Días Solicitados"
        type="number"
        step="0.5"
        min="0.5"
        value={formData.days_requested}
        onChange={(e) => setFormData({ ...formData, days_requested: e.target.value })}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motivo (opcional)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Describe el motivo de tu solicitud..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Crear Solicitud
        </Button>
      </div>
    </form>
  )
}

function VacationCard({ vacation, onSubmit, onCancel, onView }) {
  const typeLabels = {
    vacation: 'Vacaciones',
    personal: 'Día Personal',
    sick: 'Enfermedad',
    bereavement: 'Duelo',
    unpaid: 'Sin Goce',
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {typeLabels[vacation.vacation_type] || vacation.vacation_type}
              </p>
              <p className="text-sm text-gray-500">
                {vacation.request_number}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(vacation.start_date).toLocaleDateString('es-ES')} - {new Date(vacation.end_date).toLocaleDateString('es-ES')}
              </p>
              <p className="text-sm font-medium text-primary-600 mt-1">
                {vacation.days_requested} días
              </p>
            </div>
          </div>
          <Badge status={vacation.status} />
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={() => onView(vacation)}>
            <Eye className="w-4 h-4" />
            Ver
          </Button>

          {vacation.status === 'draft' && (
            <Button variant="primary" size="sm" onClick={() => onSubmit(vacation.id)}>
              <Send className="w-4 h-4" />
              Enviar
            </Button>
          )}

          {['draft', 'pending'].includes(vacation.status) && (
            <Button variant="danger" size="sm" onClick={() => onCancel(vacation.id)}>
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Vacations() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedVacation, setSelectedVacation] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['vacations', { status: statusFilter }],
    queryFn: () => vacationService.list({ status: statusFilter || undefined }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => vacationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations'])
      setShowNewModal(false)
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id) => vacationService.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations'])
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => vacationService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations'])
    },
  })

  const vacations = data?.data?.data || []

  const handleView = (vacation) => {
    setSelectedVacation(vacation)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Vacaciones</h1>
          <p className="text-gray-500">Gestiona tus solicitudes de vacaciones</p>
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
          </div>
        </CardContent>
      </Card>

      {/* Vacation List */}
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
      ) : vacations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vacations.map((vacation) => (
            <VacationCard
              key={vacation.id}
              vacation={vacation}
              onSubmit={(id) => submitMutation.mutate(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              onView={handleView}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes solicitudes de vacaciones
            </h3>
            <p className="text-gray-500 mb-4">
              Crea tu primera solicitud de vacaciones
            </p>
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4" />
              Nueva Solicitud
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Vacation Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nueva Solicitud de Vacaciones"
        size="md"
      >
        <VacationForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowNewModal(false)}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle de Solicitud"
        size="md"
      >
        {selectedVacation && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Número:</span>
              <span className="font-medium">{selectedVacation.request_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Estado:</span>
              <Badge status={selectedVacation.status} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tipo:</span>
              <span>{selectedVacation.vacation_type}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Fechas:</span>
              <span>
                {new Date(selectedVacation.start_date).toLocaleDateString('es-ES')} - {new Date(selectedVacation.end_date).toLocaleDateString('es-ES')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Días:</span>
              <span className="font-medium text-primary-600">{selectedVacation.days_requested}</span>
            </div>
            {selectedVacation.reason && (
              <div>
                <span className="text-gray-500 block mb-1">Motivo:</span>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedVacation.reason}</p>
              </div>
            )}
            {selectedVacation.decision_reason && (
              <div>
                <span className="text-gray-500 block mb-1">Comentario del aprobador:</span>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedVacation.decision_reason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
