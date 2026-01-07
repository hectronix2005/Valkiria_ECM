import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templateService, variableMappingService, signatoryTypeService } from '../../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import {
  ArrowLeft,
  Upload,
  Save,
  FileText,
  Variable,
  Users,
  CheckCircle,
  Archive,
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  X,
  Settings,
  RefreshCw,
  Edit2,
  Move,
  Eye,
  PenTool
} from 'lucide-react'

// PDF A4 dimensions in points (72 DPI)
const PDF_WIDTH = 595
const PDF_HEIGHT = 842

// Signature Preview Component - Shows real PDF with draggable signature fields
function SignaturePreview({ templateId, hasFile, signatories, selectedId, onSelect, onUpdatePosition, scale = 0.6, numPages, onPagesChange }) {
  const containerRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Handle page change
  const handleSetNumPages = (pages) => {
    if (onPagesChange) {
      onPagesChange(pages)
    }
  }

  // Load PDF preview
  useEffect(() => {
    if (!templateId || !hasFile) {
      setPdfUrl(null)
      return
    }

    let isMounted = true
    setPdfLoading(true)
    setPdfError(null)

    templateService.preview(templateId)
      .then(response => {
        if (!isMounted) return
        const blob = new Blob([response.data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        setPdfLoading(false)
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Error loading PDF preview:', err)
        setPdfError(err.response?.data?.error || 'Error al cargar el preview')
        setPdfLoading(false)
      })

    return () => {
      isMounted = false
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [templateId, hasFile])

  // Track scroll position to update current page indicator
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop
    const pageHeight = PDF_HEIGHT * scale
    const page = Math.floor(scrollTop / pageHeight) + 1
    setCurrentPage(Math.min(page, numPages))
  }, [scale, numPages])

  const handleMouseDown = (e, sig) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    const sigX = (sig.x_position || 350) * scale
    const sigY = (sig.y_position || 700) * scale - scrollTop
    setDragOffset({
      x: e.clientX - rect.left - sigX,
      y: e.clientY - rect.top - sigY
    })
    setDragging(sig.id)
    onSelect(sig.id)
  }

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    const sig = signatories.find(s => s.id === dragging)
    if (!sig) return

    // Calculate total document height (all pages)
    const totalHeight = PDF_HEIGHT * numPages

    const newX = Math.max(0, Math.min(PDF_WIDTH - (sig.width || 200),
      (e.clientX - rect.left - dragOffset.x) / scale))
    const newY = Math.max(0, Math.min(totalHeight - (sig.height || 80),
      (e.clientY - rect.top + scrollTop - dragOffset.y) / scale))

    onUpdatePosition(dragging, Math.round(newX), Math.round(newY))
  }, [dragging, dragOffset, scale, signatories, onUpdatePosition, numPages])

  const handleMouseUp = () => {
    setDragging(null)
  }

  // Signature field colors by role type
  const getSignatureColor = (role) => {
    const colors = {
      employee: { bg: 'rgba(59, 130, 246, 0.3)', border: '#3b82f6', text: '#1d4ed8' },
      supervisor: { bg: 'rgba(147, 51, 234, 0.3)', border: '#9333ea', text: '#7c3aed' },
      hr: { bg: 'rgba(34, 197, 94, 0.3)', border: '#22c55e', text: '#16a34a' },
      hr_manager: { bg: 'rgba(16, 185, 129, 0.3)', border: '#10b981', text: '#059669' },
      legal: { bg: 'rgba(249, 115, 22, 0.3)', border: '#f97316', text: '#ea580c' },
      general_manager: { bg: 'rgba(239, 68, 68, 0.3)', border: '#ef4444', text: '#dc2626' },
      legal_representative: { bg: 'rgba(245, 158, 11, 0.3)', border: '#f59e0b', text: '#d97706' },
      accountant: { bg: 'rgba(6, 182, 212, 0.3)', border: '#06b6d4', text: '#0891b2' },
      admin: { bg: 'rgba(107, 114, 128, 0.3)', border: '#6b7280', text: '#4b5563' },
    }
    return colors[role] || colors.admin
  }

  // Calculate page from Y position
  const getPageFromY = (y) => Math.floor(y / PDF_HEIGHT) + 1

  const displayWidth = PDF_WIDTH * scale
  const displayHeight = PDF_HEIGHT * scale
  const totalHeight = displayHeight * numPages

  // Scroll to specific page
  const scrollToPage = (page) => {
    if (scrollContainerRef.current) {
      const targetY = displayHeight * (page - 1)
      scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }

  return (
    <div className="relative">
      {/* Page Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Páginas:</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
              <button
                key={p}
                onClick={() => {
                  handleSetNumPages(p)
                  if (currentPage > p) setCurrentPage(p)
                }}
                className={`w-5 h-5 text-[10px] rounded ${numPages === p ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {numPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Página {currentPage} de {numPages}
            </span>
            <div className="flex gap-1">
              {[...Array(numPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i + 1)}
                  className={`w-5 h-5 text-[10px] rounded ${currentPage === i + 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable PDF Container */}
      <div
        ref={scrollContainerRef}
        className="mx-auto border-2 border-gray-300 rounded-lg shadow-lg overflow-y-auto overflow-x-hidden bg-gray-200"
        style={{
          width: displayWidth + 16,
          height: Math.min(totalHeight, 550) // Visible area - scrollable
        }}
        onScroll={handleScroll}
      >
        <div
          ref={containerRef}
          className="relative bg-gray-100"
          style={{
            width: displayWidth,
            height: displayHeight * numPages // Total height for all pages
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* PDF Display */}
          {pdfLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Cargando documento...</p>
              </div>
            </div>
          ) : pdfError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-center text-red-500 p-4">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">{pdfError}</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="absolute inset-0 w-full h-full pointer-events-none border-0"
              style={{ background: 'white' }}
              title="PDF Preview"
            />
          ) : !hasFile ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-center text-gray-400 p-4">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sube un archivo Word para ver el preview</p>
              </div>
            </div>
          ) : null}

          {/* Page separators */}
          {numPages > 1 && [...Array(numPages - 1)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t-2 border-dashed border-gray-400 pointer-events-none"
              style={{ top: displayHeight * (i + 1) }}
            >
              <span className="absolute left-2 -top-3 bg-gray-200 px-2 text-xs text-gray-500 rounded">
                Página {i + 2}
              </span>
            </div>
          ))}

          {/* Signature Fields Overlay */}
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            {signatories.map((sig) => {
              const colors = getSignatureColor(sig.role || sig.signatory_type_code)
              const isSelected = selectedId === sig.id
              const isDragging = dragging === sig.id
              const sigPage = getPageFromY(sig.y_position || 700)

              return (
                <div
                  key={sig.id}
                  className="absolute cursor-move transition-all duration-100"
                  style={{
                    left: (sig.x_position || 350) * scale,
                    top: (sig.y_position || 700) * scale,
                    width: (sig.width || 200) * scale,
                    height: (sig.height || 80) * scale,
                    backgroundColor: colors.bg,
                    border: `2px dashed ${colors.border}`,
                    borderRadius: 4,
                    boxShadow: isSelected ? `0 0 0 3px ${colors.border}40, 0 4px 12px rgba(0,0,0,0.15)` : isDragging ? '0 8px 20px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: isDragging ? 100 : isSelected ? 50 : 10,
                    pointerEvents: 'auto',
                    opacity: isDragging ? 0.9 : 1
                  }}
                  onMouseDown={(e) => handleMouseDown(e, sig)}
                >
                  {/* Signature field content */}
                  <div className="h-full flex flex-col items-center justify-center p-1">
                    <PenTool
                      style={{ width: 14 * scale, height: 14 * scale, color: colors.text, opacity: 0.6 }}
                    />
                    <span
                      className="font-medium text-center truncate w-full px-1"
                      style={{ fontSize: Math.max(9, 11 * scale), color: colors.text }}
                    >
                      {sig.label || sig.role_label}
                    </span>
                    {sig.required && (
                      <span style={{ fontSize: Math.max(7, 9 * scale), color: '#ef4444', fontWeight: 'bold' }}>
                        *Req
                      </span>
                    )}
                  </div>

                  {/* Page indicator */}
                  {numPages > 1 && (
                    <div
                      className="absolute -left-1 -top-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                      style={{ backgroundColor: colors.border }}
                    >
                      {sigPage}
                    </div>
                  )}

                  {/* Move indicator */}
                  {isSelected && (
                    <div
                      className="absolute -top-2 -right-2 rounded-full p-1"
                      style={{ backgroundColor: colors.border }}
                    >
                      <Move className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Resize handles (visual only for now) */}
                  {isSelected && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-white border-2" style={{ borderColor: colors.border }} />
                  )}
                </div>
              )
            })}

            {/* Empty state */}
            {signatories.length === 0 && hasFile && !pdfLoading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 text-center shadow-lg">
                  <PenTool className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Agrega firmantes para posicionarlos aquí</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      {signatories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {signatories.map((sig) => {
            const colors = getSignatureColor(sig.role || sig.signatory_type_code)
            const sigPage = getPageFromY(sig.y_position || 700)
            return (
              <button
                key={sig.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedId === sig.id ? 'ring-2 ring-offset-1' : 'hover:opacity-80'}`}
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  ringColor: colors.border
                }}
                onClick={() => {
                  onSelect(sig.id)
                  // Scroll to the signature position
                  if (scrollContainerRef.current) {
                    const targetY = (sig.y_position || 700) * scale - 100
                    scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' })
                  }
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors.border }}
                />
                {sig.label || sig.role_label}
                {numPages > 1 && (
                  <span className="ml-1 opacity-70">(p.{sigPage})</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Instructions */}
      <p className="text-xs text-gray-400 text-center mt-2">
        Coordenadas PDF: {PDF_WIDTH} x {PDF_HEIGHT} pts por página | Usa scroll para documentos largos
      </p>
    </div>
  )
}

// Legacy roles for backward compatibility (will be replaced by SignatoryType)
const LEGACY_ROLES = {
  employee: 'Empleado Solicitante',
  supervisor: 'Supervisor Directo',
  hr: 'Recursos Humanos',
  hr_manager: 'Gerente de RR.HH.',
  legal: 'Departamento Legal',
  admin: 'Administrador',
  custom: 'Personalizado',
}

function EditSignatoryModal({ isOpen, onClose, templateId, signatory, numPages = 1, onSuccess }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState(signatory?.label || '')
  const [required, setRequired] = useState(signatory?.required ?? true)
  const [xPosition, setXPosition] = useState(signatory?.x_position || 350)
  const [selectedPage, setSelectedPage] = useState(1)
  const [yInPage, setYInPage] = useState(700)
  const [width, setWidth] = useState(signatory?.width || 200)
  const [height, setHeight] = useState(signatory?.height || 80)
  const [error, setError] = useState('')

  // Sync form with signatory when modal opens
  useEffect(() => {
    if (signatory && isOpen) {
      setLabel(signatory.label || '')
      setRequired(signatory.required ?? true)
      setXPosition(signatory.x_position || 350)
      setWidth(signatory.width || 200)
      setHeight(signatory.height || 80)

      // Calculate page and Y position within page
      const absY = signatory.y_position || 700
      const page = Math.floor(absY / PDF_HEIGHT) + 1
      const yInPageVal = absY % PDF_HEIGHT
      setSelectedPage(Math.min(page, numPages))
      setYInPage(yInPageVal)
    }
  }, [signatory, isOpen, numPages])

  // Calculate absolute Y from page + position in page
  const absoluteY = (selectedPage - 1) * PDF_HEIGHT + yInPage

  const updateMutation = useMutation({
    mutationFn: (data) => templateService.updateSignatory(templateId, signatory?.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', templateId])
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al actualizar firmante')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    updateMutation.mutate({
      label,
      required,
      x_position: xPosition,
      y_position: absoluteY,
      width,
      height
    })
  }

  // Quick position presets
  const positionPresets = [
    { label: 'Arriba Izq', x: 50, y: 100 },
    { label: 'Arriba Der', x: 350, y: 100 },
    { label: 'Centro', x: 200, y: 400 },
    { label: 'Abajo Izq', x: 50, y: 700 },
    { label: 'Abajo Der', x: 350, y: 700 },
  ]

  if (!isOpen || !signatory) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Editar Firmante</h3>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm">{signatory.role_label}</p>
            </div>
            <Input
              label="Etiqueta"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Firma del Empleado"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="edit-required" className="text-sm text-gray-700">
              Firma requerida
            </label>
          </div>

          {/* Page Selection */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Ubicación de la firma</p>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-2">Página</label>
              <div className="flex gap-1 flex-wrap">
                {[...Array(numPages)].map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPage(i + 1)}
                    className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
                      selectedPage === i + 1
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Position Presets */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-2">Posición rápida</label>
              <div className="flex gap-1 flex-wrap">
                {positionPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setXPosition(preset.x)
                      setYInPage(preset.y)
                    }}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position Controls */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">X</label>
                <input
                  type="number"
                  value={xPosition}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) setXPosition(Math.max(0, Math.min(PDF_WIDTH - width, val)))
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max={PDF_WIDTH - width}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y en pág</label>
                <input
                  type="number"
                  value={yInPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) setYInPage(Math.max(0, Math.min(PDF_HEIGHT - height, val)))
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max={PDF_HEIGHT - height}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ancho</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) setWidth(Math.max(20, Math.min(400, val)))
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  min="20"
                  max="400"
                  step="10"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Alto</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) setHeight(Math.max(15, Math.min(200, val)))
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  min="15"
                  max="200"
                  step="5"
                />
              </div>
            </div>

            {/* Size Presets */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-2">Tamaño rápido</label>
              <div className="flex gap-1 flex-wrap">
                {[
                  { label: 'XS', w: 80, h: 30 },
                  { label: 'S', w: 120, h: 45 },
                  { label: 'M', w: 160, h: 60 },
                  { label: 'L', w: 200, h: 80 },
                  { label: 'XL', w: 280, h: 100 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setWidth(preset.w)
                      setHeight(preset.h)
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      width === preset.w && height === preset.h
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {preset.label} ({preset.w}×{preset.h})
                  </button>
                ))}
              </div>
            </div>

            {/* Position Summary */}
            <div className="mt-3 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
              <span className="font-medium">Resumen:</span> Página {selectedPage}, posición ({xPosition}, {yInPage}) → Y absoluta: {absoluteY}, tamaño {width}×{height}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              <Save className="w-4 h-4" />
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddSignatoryModal({ isOpen, onClose, templateId, onSuccess }) {
  const queryClient = useQueryClient()
  const [typeCode, setTypeCode] = useState('')
  const [label, setLabel] = useState('')
  const [required, setRequired] = useState(true)
  const [xPosition, setXPosition] = useState(350)
  const [yPosition, setYPosition] = useState(700)
  const [width, setWidth] = useState(200)
  const [height, setHeight] = useState(80)
  const [error, setError] = useState('')

  // Fetch signatory types from API
  const { data: typesData, isLoading: loadingTypes } = useQuery({
    queryKey: ['signatory-types', { active: 'true' }],
    queryFn: () => signatoryTypeService.list({ active: 'true' }),
    enabled: isOpen
  })

  const signatoryTypes = typesData?.data?.data || []

  const createMutation = useMutation({
    mutationFn: (data) => templateService.createSignatory(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', templateId])
      queryClient.invalidateQueries(['template-signatories', templateId])
      onSuccess()
      handleClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al agregar firmante')
    }
  })

  const handleClose = () => {
    setTypeCode('')
    setLabel('')
    setRequired(true)
    setXPosition(350)
    setYPosition(700)
    setWidth(200)
    setHeight(80)
    setError('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!typeCode) {
      setError('Seleccione un tipo de firmante')
      return
    }
    const selectedType = signatoryTypes.find(t => t.code === typeCode)
    createMutation.mutate({
      signatory_type_code: typeCode,
      label: label || selectedType?.name || 'Firma',
      required,
      x_position: xPosition,
      y_position: yPosition,
      width,
      height
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Agregar Firmante</h3>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Firmante
            </label>
            {loadingTypes ? (
              <div className="py-2 text-gray-500 text-sm">Cargando tipos...</div>
            ) : signatoryTypes.length === 0 ? (
              <div className="py-2 text-amber-600 text-sm">
                No hay tipos de firmante. Configure tipos en Admin &gt; Firmantes.
              </div>
            ) : (
              <select
                value={typeCode}
                onChange={(e) => {
                  setTypeCode(e.target.value)
                  const selectedType = signatoryTypes.find(t => t.code === e.target.value)
                  if (!label && selectedType) setLabel(selectedType.name)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Seleccionar tipo...</option>
                {signatoryTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <Input
            label="Etiqueta"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Firma del Empleado"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="required" className="text-sm text-gray-700">
              Firma requerida
            </label>
          </div>

          {/* Position Configuration */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Posición del campo de firma (en puntos PDF)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">X (horizontal)</label>
                <input
                  type="number"
                  value={xPosition}
                  onChange={(e) => setXPosition(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max="600"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y (desde arriba)</label>
                <input
                  type="number"
                  value={yPosition}
                  onChange={(e) => setYPosition(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max="850"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ancho</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="50"
                  max="300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Alto</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="30"
                  max="150"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              PDF A4: 595 x 842 puntos. Valores típicos: X=350, Y=700 (parte inferior derecha)
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending} disabled={!typeCode || signatoryTypes.length === 0}>
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TemplateEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [showAddSignatory, setShowAddSignatory] = useState(false)
  const [editingSignatory, setEditingSignatory] = useState(null)
  const [editingMappings, setEditingMappings] = useState({})
  const [isSavingMappings, setIsSavingMappings] = useState(false)
  const [selectedSignatoryId, setSelectedSignatoryId] = useState(null)
  const [localSignatories, setLocalSignatories] = useState([])
  const [hasPositionChanges, setHasPositionChanges] = useState(false)
  const [documentPages, setDocumentPages] = useState(1)

  const { data: templateData, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => templateService.get(id),
    onSuccess: (data) => {
      // Sync local signatories when template loads
      if (data?.data?.data?.signatories) {
        setLocalSignatories(data.data.data.signatories)
        setHasPositionChanges(false)
      }
    }
  })

  const template = templateData?.data?.data

  // Sync local signatories when template data changes
  useEffect(() => {
    if (template?.signatories) {
      setLocalSignatories(template.signatories)
      setHasPositionChanges(false)
    }
  }, [template?.signatories])

  // Handle position update from drag
  const handleUpdateSignatoryPosition = useCallback((sigId, x, y) => {
    setLocalSignatories(prev =>
      prev.map(sig =>
        sig.id === sigId
          ? { ...sig, x_position: x, y_position: y }
          : sig
      )
    )
    setHasPositionChanges(true)
  }, [])

  // Save all position changes to backend
  const savePositionsMutation = useMutation({
    mutationFn: async () => {
      const updates = localSignatories.map(sig => ({
        id: sig.id,
        x_position: sig.x_position,
        y_position: sig.y_position,
        width: sig.width,
        height: sig.height
      }))
      // Update each signatory
      for (const update of updates) {
        await templateService.updateSignatory(id, update.id, update)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
      setHasPositionChanges(false)
    }
  })

  const { data: mappingsData } = useQuery({
    queryKey: ['variable-mappings-grouped'],
    queryFn: () => variableMappingService.grouped()
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => templateService.upload(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => templateService.update(id, { template: data }),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const activateMutation = useMutation({
    mutationFn: () => templateService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const deleteSignatoryMutation = useMutation({
    mutationFn: (sigId) => templateService.deleteSignatory(id, sigId),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
    }
  })

  const reassignMutation = useMutation({
    mutationFn: () => templateService.reassignMappings(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['template', id])
      setEditingMappings({})
    }
  })

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.docx')) {
      alert('Solo se permiten archivos Word (.docx)')
      return
    }

    uploadMutation.mutate(file)
  }

  const handleSaveMappings = async () => {
    setIsSavingMappings(true)
    try {
      await updateMutation.mutateAsync({ variable_mappings: editingMappings })
    } finally {
      setIsSavingMappings(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Template no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/admin/templates')} className="mt-4">
          Volver a Templates
        </Button>
      </div>
    )
  }

  const mappings = { ...template.variable_mappings, ...editingMappings }
  const availableMappings = template.available_mappings || {}
  const groupedMappings = mappingsData?.data?.data || {}

  const CATEGORY_LABELS = {
    employee: 'Empleado',
    organization: 'Organizacion',
    system: 'Sistema',
    request: 'Solicitud',
    custom: 'Personalizado'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/templates')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{template.category_label}</Badge>
            <Badge
              status={template.status === 'active' ? 'approved' : template.status === 'draft' ? 'pending' : 'rejected'}
            >
              {template.status === 'active' ? 'Activo' : template.status === 'draft' ? 'Borrador' : 'Archivado'}
            </Badge>
          </div>
        </div>

        {template.status === 'draft' && template.file_name && (
          <Button onClick={() => activateMutation.mutate()} loading={activateMutation.isPending}>
            <CheckCircle className="w-4 h-4" />
            Activar Template
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Archivo del Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              {template.file_name ? (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary-600" />
                    <div>
                      <p className="font-medium">{template.file_name}</p>
                      <p className="text-sm text-gray-500">
                        {(template.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploadMutation.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    Reemplazar
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Haz clic para subir un archivo Word (.docx)
                  </p>
                  <p className="text-sm text-gray-400">
                    El archivo debe contener variables en formato {"{{Variable}}"}
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Variables */}
          {template.variables?.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Variable className="w-5 h-5" />
                    Variables Detectadas ({template.variables.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reassignMutation.mutate()}
                      loading={reassignMutation.isPending}
                      title="Reasignar automaticamente desde variables del sistema"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Auto-asignar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMappings}
                      loading={isSavingMappings}
                      disabled={Object.keys(editingMappings).length === 0}
                    >
                      <Save className="w-4 h-4" />
                      Guardar Mapeo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {template.variables.map((variable) => (
                    <div key={variable} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <code className="px-2 py-1 bg-white border rounded text-sm flex-shrink-0">
                        {`{{${variable}}}`}
                      </code>
                      <span className="text-gray-400">=</span>
                      <select
                        value={mappings[variable] || ''}
                        onChange={(e) => setEditingMappings({
                          ...editingMappings,
                          [variable]: e.target.value
                        })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">-- Seleccionar mapeo --</option>
                        {Object.keys(groupedMappings).length > 0 ? (
                          // Use grouped mappings from API
                          Object.entries(groupedMappings).map(([category, items]) => (
                            <optgroup key={category} label={CATEGORY_LABELS[category] || category}>
                              {items.map((m, idx) => (
                                <option key={m.id || `${category}-${idx}`} value={m.key}>{m.name}</option>
                              ))}
                            </optgroup>
                          ))
                        ) : (
                          // Fallback to template's available mappings
                          <>
                            <optgroup label="Empleado">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('employee.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Organizacion">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('organization.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Sistema">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('system.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Solicitud">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('request.'))
                                .map(([label, path]) => (
                                  <option key={path} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                          </>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signature Fields Visual Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Vista Previa de Firmas
                </CardTitle>
                <div className="flex items-center gap-2">
                  {hasPositionChanges && (
                    <Button
                      size="sm"
                      onClick={() => savePositionsMutation.mutate()}
                      loading={savePositionsMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                      Guardar Posiciones
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setShowAddSignatory(true)}>
                    <Plus className="w-4 h-4" />
                    Agregar Firmante
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Arrastra los campos de firma para posicionarlos. Haz clic para seleccionar y editar.
              </p>
              <SignaturePreview
                templateId={id}
                hasFile={!!template.file_name}
                signatories={localSignatories}
                selectedId={selectedSignatoryId}
                onSelect={(id) => setSelectedSignatoryId(id)}
                onUpdatePosition={handleUpdateSignatoryPosition}
                scale={0.65}
                numPages={documentPages}
                onPagesChange={setDocumentPages}
              />

              {/* Selected signatory details */}
              {selectedSignatoryId && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                  {(() => {
                    const sig = localSignatories.find(s => s.id === selectedSignatoryId)
                    if (!sig) return null
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{sig.label || sig.role_label}</p>
                          <p className="text-xs text-gray-500">
                            Posición: X={sig.x_position || 350}, Y={sig.y_position || 700}
                          </p>
                          <p className="text-xs text-gray-400">
                            Tamaño: {sig.width || 200} x {sig.height || 80} px
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingSignatory(sig)}
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (confirm('¿Eliminar este firmante?')) {
                                deleteSignatoryMutation.mutate(sig.id)
                                setSelectedSignatoryId(null)
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          {/* Signatories List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Firmantes ({localSignatories.length})
                </CardTitle>
                <Button size="sm" onClick={() => setShowAddSignatory(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {localSignatories.length > 0 ? (
                <div className="space-y-2">
                  {localSignatories.map((sig, index) => (
                    <div
                      key={sig.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedSignatoryId === sig.id ? 'bg-primary-50 ring-2 ring-primary-500' : 'bg-gray-50 hover:bg-gray-100'}`}
                      onClick={() => setSelectedSignatoryId(sig.id)}
                    >
                      <span className="text-sm text-gray-400">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{sig.label}</p>
                        <p className="text-xs text-gray-500">{sig.role_label}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          ({sig.x_position || 350}, {sig.y_position || 700})
                        </p>
                      </div>
                      {sig.required && (
                        <Badge variant="secondary" className="text-xs">Req</Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSignatory(sig)
                        }}
                        className="p-1 hover:bg-blue-100 rounded text-blue-500"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('¿Eliminar este firmante?')) {
                            deleteSignatoryMutation.mutate(sig.id)
                            if (selectedSignatoryId === sig.id) {
                              setSelectedSignatoryId(null)
                            }
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay firmantes configurados</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => setShowAddSignatory(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Firmante
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Informacion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="font-medium">{template.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Creado</span>
                <span className="font-medium">
                  {new Date(template.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Actualizado</span>
                <span className="font-medium">
                  {new Date(template.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Signatory Modal */}
      <AddSignatoryModal
        isOpen={showAddSignatory}
        onClose={() => setShowAddSignatory(false)}
        templateId={id}
        onSuccess={() => {}}
      />

      {/* Edit Signatory Modal */}
      <EditSignatoryModal
        isOpen={!!editingSignatory}
        onClose={() => setEditingSignatory(null)}
        templateId={id}
        signatory={editingSignatory}
        numPages={documentPages}
        onSuccess={() => {}}
      />
    </div>
  )
}
