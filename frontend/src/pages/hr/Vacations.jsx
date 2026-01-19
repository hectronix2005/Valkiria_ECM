import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { vacationService, publicTemplateService } from '../../services/api'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import {
  Calendar, Plus, Send, X, Eye, Filter, CalendarCheck, CalendarClock,
  CalendarDays, FileDown, FileText, PenTool, Users, CheckCircle, Clock,
  AlertCircle, Loader2, ExternalLink, Trash2
} from 'lucide-react'

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
  { value: 'pending', label: 'Solicitada' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'enjoyed', label: 'Disfrutada' },
  { value: 'rejected', label: 'Rechazada' },
  { value: 'cancelled', label: 'Cancelada' },
]

// Componente de creación con template integrado
function VacationRequestWizard({ onClose, onSuccess, balance }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    vacation_type: 'vacation',
    start_date: '',
    end_date: '',
    days_requested: '',
    reason: '',
  })
  const [createdVacation, setCreatedVacation] = useState(null)
  const [documentInfo, setDocumentInfo] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [signError, setSignError] = useState('')
  const queryClient = useQueryClient()

  // Obtener template de vacaciones
  const { data: templateData } = useQuery({
    queryKey: ['vacation-template'],
    queryFn: async () => {
      const response = await publicTemplateService.list({ category: 'vacation' })
      return response.data?.data?.[0] || null
    },
  })

  const template = templateData

  // Crear solicitud (genera documento automáticamente)
  const createMutation = useMutation({
    mutationFn: (data) => vacationService.create(data),
    onSuccess: async (response) => {
      const vacation = response.data?.data
      const doc = response.data?.document
      setCreatedVacation(vacation)
      setDocumentInfo(doc)
      setSignError('')

      // Cargar PDF para preview (solo si está listo)
      if (vacation?.id && vacation?.pdf_ready) {
        try {
          const pdfResponse = await vacationService.downloadDocument(vacation.id)
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' })
          setPdfUrl(URL.createObjectURL(blob))
        } catch (e) {
          console.error('Error loading PDF:', e)
          setPdfUrl(null)
        }
      } else {
        // PDF no disponible (pendiente de generación o sin documento)
        setPdfUrl(null)
      }

      setStep(2)
    },
    onError: (err) => {
      const errors = err.response?.data?.errors
      if (Array.isArray(errors)) {
        setSignError(errors.join(', '))
      } else {
        setSignError(err.response?.data?.error || 'Error al crear la solicitud')
      }
    }
  })

  // Firmar documento
  const signMutation = useMutation({
    mutationFn: (id) => vacationService.signDocument(id),
    onSuccess: (response) => {
      setDocumentInfo(response.data?.document)
      setCreatedVacation(response.data?.data)
      // Reload PDF with signature
      reloadPdf()
    },
    onError: (err) => {
      setSignError(err.response?.data?.error || 'Error al firmar el documento')
    }
  })

  // Enviar solicitud
  const submitMutation = useMutation({
    mutationFn: (id) => vacationService.submit(id),
    onSuccess: (response) => {
      setCreatedVacation(response.data?.data)
      setStep(3)
      queryClient.invalidateQueries(['vacations'])
    },
    onError: (err) => {
      setSignError(err.response?.data?.error || 'Error al enviar la solicitud')
    }
  })

  const reloadPdf = async () => {
    if (createdVacation?.id) {
      try {
        const pdfResponse = await vacationService.downloadDocument(createdVacation.id)
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' })
        if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        setPdfUrl(URL.createObjectURL(blob))
      } catch (e) {
        console.error('Error reloading PDF:', e)
      }
    }
  }

  // Calcular Domingo de Pascua (Algoritmo de Butcher)
  const getEasterSunday = (year) => {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month - 1, day)
  }

  // Mover al siguiente lunes (Ley Emiliani)
  const moveToNextMonday = (date) => {
    const d = new Date(date)
    const dayOfWeek = d.getDay()
    if (dayOfWeek === 0) { // Domingo
      d.setDate(d.getDate() + 1)
    } else if (dayOfWeek !== 1) { // No es lunes
      d.setDate(d.getDate() + (8 - dayOfWeek))
    }
    return d
  }

  // Obtener festivos colombianos para un año
  const getColombianHolidays = (year) => {
    const holidays = []
    const easter = getEasterSunday(year)

    // Festivos fijos
    holidays.push(new Date(year, 0, 1))   // Año Nuevo
    holidays.push(new Date(year, 4, 1))   // Día del Trabajo
    holidays.push(new Date(year, 6, 20))  // Día de la Independencia
    holidays.push(new Date(year, 7, 7))   // Batalla de Boyacá
    holidays.push(new Date(year, 11, 8))  // Inmaculada Concepción
    holidays.push(new Date(year, 11, 25)) // Navidad

    // Festivos Ley Emiliani (se trasladan al lunes)
    holidays.push(moveToNextMonday(new Date(year, 0, 6)))   // Reyes Magos
    holidays.push(moveToNextMonday(new Date(year, 2, 19)))  // San José
    holidays.push(moveToNextMonday(new Date(year, 5, 29)))  // San Pedro y San Pablo
    holidays.push(moveToNextMonday(new Date(year, 7, 15)))  // Asunción de la Virgen
    holidays.push(moveToNextMonday(new Date(year, 9, 12)))  // Día de la Raza
    holidays.push(moveToNextMonday(new Date(year, 10, 1)))  // Todos los Santos
    holidays.push(moveToNextMonday(new Date(year, 10, 11))) // Independencia de Cartagena

    // Festivos basados en Semana Santa
    const holyThursday = new Date(easter)
    holyThursday.setDate(easter.getDate() - 3)
    holidays.push(holyThursday) // Jueves Santo

    const goodFriday = new Date(easter)
    goodFriday.setDate(easter.getDate() - 2)
    holidays.push(goodFriday) // Viernes Santo

    // Ascensión del Señor (39 días después de Pascua, trasladado al lunes)
    const ascension = new Date(easter)
    ascension.setDate(easter.getDate() + 39)
    holidays.push(moveToNextMonday(ascension))

    // Corpus Christi (60 días después de Pascua, trasladado al lunes)
    const corpusChristi = new Date(easter)
    corpusChristi.setDate(easter.getDate() + 60)
    holidays.push(moveToNextMonday(corpusChristi))

    // Sagrado Corazón (68 días después de Pascua, trasladado al lunes)
    const sacredHeart = new Date(easter)
    sacredHeart.setDate(easter.getDate() + 68)
    holidays.push(moveToNextMonday(sacredHeart))

    return holidays
  }

  // Verificar si una fecha es festivo
  const isHoliday = (date, holidays) => {
    const dateStr = date.toISOString().split('T')[0]
    return holidays.some(h => h.toISOString().split('T')[0] === dateStr)
  }

  // Calcular días laborales (excluyendo fines de semana y festivos)
  const countBusinessDays = (startDate, endDate) => {
    let count = 0
    const current = new Date(startDate)
    const end = new Date(endDate)

    // Obtener festivos de los años involucrados
    const startYear = current.getFullYear()
    const endYear = end.getFullYear()
    let holidays = []
    for (let year = startYear; year <= endYear; year++) {
      holidays = holidays.concat(getColombianHolidays(year))
    }

    while (current <= end) {
      const dayOfWeek = current.getDay()
      // Excluir fines de semana y festivos
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(current, holidays)) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    return count
  }

  // Calcular días automáticamente (solo días laborales)
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date + 'T00:00:00')
      const end = new Date(formData.end_date + 'T00:00:00')

      if (end >= start) {
        const businessDays = countBusinessDays(start, end)
        setFormData(prev => ({ ...prev, days_requested: businessDays.toString() }))
      }
    }
  }, [formData.start_date, formData.end_date])

  // Cleanup PDF URL
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const handleCreateRequest = (e) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleSign = () => {
    setSignError('')
    if (createdVacation?.id) {
      signMutation.mutate(createdVacation.id)
    }
  }

  const handleSubmit = () => {
    setSignError('')
    if (createdVacation?.id) {
      submitMutation.mutate(createdVacation.id)
    }
  }

  const handleFinish = () => {
    queryClient.invalidateQueries(['vacations'])
    onSuccess?.()
    onClose()
  }

  const openPdfInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }

  const employeeSigned = documentInfo?.employee_signed || false
  const pdfPending = createdVacation?.pdf_ready === false
  const canSubmit = employeeSigned || pdfPending // Can submit if signed OR if PDF is pending

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= s
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s ? <CheckCircle className="w-5 h-5" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-1 mx-1 ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-between text-xs text-gray-500 px-4 mb-6">
        <span className={step >= 1 ? 'text-primary-600 font-medium' : ''}>Datos</span>
        <span className={step >= 2 ? 'text-primary-600 font-medium' : ''}>Firmar</span>
        <span className={step >= 3 ? 'text-primary-600 font-medium' : ''}>Enviado</span>
      </div>

      {/* Step 1: Formulario */}
      {step === 1 && (
        <form onSubmit={handleCreateRequest} className="space-y-4">
          {/* Template Info */}
          {template && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">{template.name}</p>
                <p className="text-sm text-blue-700">
                  Se generará el documento oficial para tu firma
                </p>
                {template.signatories_count > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-blue-600">
                    <Users className="w-4 h-4" />
                    <span>{template.signatories_count} firmantes requeridos</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Balance disponible */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <span className="text-green-700">Días disponibles para solicitar:</span>
            <span className="text-xl font-bold text-green-600">{Math.floor(balance?.available || 0)}</span>
          </div>

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
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setFormData({ ...formData, start_date: e.target.value }); setSignError(''); }}
              required
            />
            <Input
              label="Fecha Fin"
              type="date"
              value={formData.end_date}
              min={formData.start_date || new Date().toISOString().split('T')[0]}
              onChange={(e) => { setFormData({ ...formData, end_date: e.target.value }); setSignError(''); }}
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

          {parseFloat(formData.days_requested) > (balance?.available || 0) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Los días solicitados exceden tu saldo disponible</span>
            </div>
          )}

          {signError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{signError}</span>
            </div>
          )}

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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Continuar
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Documento y Firma */}
      {step === 2 && createdVacation && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900">Solicitud {createdVacation.request_number}</h3>
              <Badge status={createdVacation.status} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Tipo:</span>
                <p className="font-medium">{vacationTypes.find(t => t.value === createdVacation.vacation_type)?.label}</p>
              </div>
              <div>
                <span className="text-gray-500">Fechas:</span>
                <p className="font-medium">
                  {new Date(createdVacation.start_date).toLocaleDateString('es-ES')} - {new Date(createdVacation.end_date).toLocaleDateString('es-ES')}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Días:</span>
                <p className="font-bold text-primary-600">{createdVacation.days_requested}</p>
              </div>
            </div>
          </div>

          {/* Documento PDF */}
          {pdfUrl ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Documento de Solicitud</span>
                <Button variant="ghost" size="sm" onClick={openPdfInNewTab}>
                  <ExternalLink className="w-4 h-4" />
                  Abrir en nueva pestaña
                </Button>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full h-[400px] border-0"
                title="Vista previa del documento"
              />
            </div>
          ) : createdVacation?.pdf_ready === false ? (
            <div className="border rounded-lg p-8 text-center bg-amber-50 border-amber-200">
              <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-amber-700 font-medium">El documento está pendiente de generación</p>
              <p className="text-amber-600 text-sm mt-1">El PDF se generará próximamente. Puedes continuar con el proceso.</p>
            </div>
          ) : (
            <div className="border rounded-lg p-8 text-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">Cargando documento...</p>
            </div>
          )}

          {/* Estado de Firmas */}
          <div className="p-4 bg-white border rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Firmas Requeridas
            </h4>
            <div className="space-y-3">
              {documentInfo?.signatures?.map((sig, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      sig.signed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {sig.signed ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{sig.label}</p>
                      {sig.signed && (
                        <p className="text-xs text-green-600">
                          Firmado por {sig.signed_by} - {new Date(sig.signed_at).toLocaleString('es-ES')}
                        </p>
                      )}
                    </div>
                  </div>
                  {sig.signatory_type_code === 'employee' && !sig.signed && (
                    <Button
                      size="sm"
                      onClick={handleSign}
                      loading={signMutation.isPending}
                    >
                      <PenTool className="w-4 h-4" />
                      Firmar
                    </Button>
                  )}
                  {sig.signatory_type_code !== 'employee' && !sig.signed && (
                    <span className="text-xs text-gray-500 px-2 py-1 bg-gray-200 rounded">
                      Pendiente
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {signError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{signError}</span>
            </div>
          )}

          {pdfPending && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Documento pendiente de generación</p>
                <p className="mt-1">Puedes enviar la solicitud ahora. El documento se generará y firmará posteriormente.</p>
              </div>
            </div>
          )}

          {!pdfPending && !employeeSigned && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Debes firmar el documento antes de enviar</p>
                <p className="mt-1">Haz clic en el botón "Firmar" junto a tu nombre para continuar.</p>
              </div>
            </div>
          )}

          {!pdfPending && employeeSigned && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">¡Documento firmado!</p>
                <p className="mt-1">Ahora puedes enviar la solicitud para aprobación del supervisor y RRHH.</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Volver
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitMutation.isPending}
              disabled={!canSubmit}
            >
              <Send className="w-4 h-4" />
              Enviar Solicitud
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmación */}
      {step === 3 && createdVacation && (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900">
            ¡Solicitud Enviada!
          </h3>

          <p className="text-gray-600">
            Tu solicitud <span className="font-medium">{createdVacation.request_number}</span> ha sido enviada correctamente.
          </p>

          {pdfUrl && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">
                Documento firmado:
              </p>
              <Button variant="secondary" onClick={openPdfInNewTab}>
                <FileDown className="w-4 h-4" />
                Ver Documento PDF
              </Button>
            </div>
          )}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
            <h4 className="font-medium text-blue-900 mb-2">Próximos pasos:</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Tu supervisor recibirá la solicitud para aprobación y firma</span>
              </div>
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-600" />
                <span>Recursos Humanos revisará y firmará la solicitud</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span>Recibirás notificación cuando sea aprobada</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleFinish}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function VacationCard({ vacation, onSubmit, onCancel, onDelete, onView, onDownload, onSign }) {
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

        <div className="flex justify-end gap-1 mt-4 pt-4 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={() => onView(vacation)} title="Ver detalles">
            <Eye className="w-4 h-4" />
          </Button>

          {vacation.pdf_ready && (
            <Button variant="ghost" size="sm" onClick={() => onDownload(vacation.id)} title="Descargar documento">
              <FileDown className="w-4 h-4" />
            </Button>
          )}

          {vacation.status === 'draft' && vacation.needs_employee_signature && (
            <Button variant="secondary" size="sm" onClick={() => onSign(vacation)} title="Firmar documento">
              <PenTool className="w-4 h-4" />
              Firmar
            </Button>
          )}

          {vacation.status === 'draft' && !vacation.needs_employee_signature && (
            <Button variant="primary" size="sm" onClick={() => onSubmit(vacation.id)} title="Enviar solicitud">
              <Send className="w-4 h-4" />
            </Button>
          )}

          {['draft', 'pending'].includes(vacation.status) && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(vacation.id)} title="Cancelar solicitud">
              <X className="w-4 h-4" />
            </Button>
          )}

          {vacation.can_delete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(vacation.id)} title="Eliminar solicitud">
              <Trash2 className="w-4 h-4" />
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
  const location = useLocation()
  const navigate = useNavigate()

  // Auto-open modal if navigated with openNew state (from Dashboard quick action)
  useEffect(() => {
    if (location.state?.openNew) {
      setShowNewModal(true)
      // Clear the state to prevent re-opening on subsequent renders
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const { data, isLoading } = useQuery({
    queryKey: ['vacations', { status: statusFilter }],
    queryFn: () => vacationService.list({ status: statusFilter || undefined }),
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

  const deleteMutation = useMutation({
    mutationFn: (id) => vacationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations'])
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al eliminar la solicitud')
    }
  })

  const signMutation = useMutation({
    mutationFn: (id) => vacationService.signDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations'])
      alert('Documento firmado exitosamente. Ahora puedes enviar la solicitud.')
    },
    onError: (err) => {
      const error = err.response?.data?.error || 'Error al firmar el documento'
      if (err.response?.data?.action_required?.type === 'configure_signature') {
        if (window.confirm('No tienes firma digital configurada. ¿Deseas configurarla ahora?')) {
          navigate('/profile')
        }
      } else {
        alert(error)
      }
    }
  })

  const handleDelete = (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer.')) {
      deleteMutation.mutate(id)
    }
  }

  const handleSign = (vacation) => {
    signMutation.mutate(vacation.id)
  }

  const vacations = data?.data?.data || []
  const balance = data?.data?.meta?.vacation_balance || {}

  const handleView = (vacation) => {
    setSelectedVacation(vacation)
    setShowDetailModal(true)
  }

  const handleDownload = async (id) => {
    try {
      const response = await vacationService.downloadDocument(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Error al descargar el documento')
    }
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

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <CalendarDays className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600">
                  {Math.floor((balance.accrued || 0) - (balance.enjoyed || 0))}
                </p>
                <p className="text-sm text-blue-700 font-medium">Días por Contrato</p>
                <p className="text-xs text-blue-500">Acumulados - Disfrutados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <CalendarClock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600">{Math.floor(balance.scheduled || 0)}</p>
                <p className="text-sm text-amber-700 font-medium">Días Programados</p>
                <p className="text-xs text-amber-500">Aprobados sin disfrutar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-300 ring-2 ring-green-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Plus className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{Math.floor(balance.available || 0)}</p>
                <p className="text-sm text-green-700 font-medium">Días Vacaciones</p>
                <p className="text-xs text-green-500">Para solicitar</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
              onDelete={handleDelete}
              onView={handleView}
              onDownload={handleDownload}
              onSign={handleSign}
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
        size="xl"
      >
        <VacationRequestWizard
          onClose={() => setShowNewModal(false)}
          onSuccess={() => queryClient.invalidateQueries(['vacations'])}
          balance={balance}
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

            {selectedVacation.pdf_ready && (
              <div className="pt-4 border-t">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleDownload(selectedVacation.id)}
                >
                  <FileDown className="w-4 h-4" />
                  Descargar Documento
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
