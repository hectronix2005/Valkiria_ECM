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

// Default PDF dimensions (Letter size) in points (72 DPI)
const DEFAULT_PDF_WIDTH = 612
const DEFAULT_PDF_HEIGHT = 792

// Signature Preview Component - Shows page layout with draggable signature fields
function SignaturePreview({ templateId, hasFile, signatories, selectedId, onSelect, onUpdatePosition, onUpdateSize, scale = 0.6, numPages = 1, customPageHeight, customPageWidth }) {
  // Use actual PDF dimensions from template, with Letter size defaults
  const PDF_WIDTH = customPageWidth || DEFAULT_PDF_WIDTH
  const PDF_HEIGHT = customPageHeight || DEFAULT_PDF_HEIGHT
  const PAGE_HEIGHT = PDF_HEIGHT // Alias for backward compatibility
  const containerRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizing, setResizing] = useState(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Load PDF URL for "View PDF" button
  useEffect(() => {
    if (!templateId || !hasFile) {
      setPdfUrl(null)
      return
    }

    let isMounted = true
    let currentUrl = null
    setPdfLoading(true)

    templateService.preview(templateId)
      .then(response => {
        if (!isMounted) return
        const blob = new Blob([response.data], { type: 'application/pdf' })
        currentUrl = URL.createObjectURL(blob)
        setPdfUrl(currentUrl)
        setPdfLoading(false)
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Error loading PDF preview:', err)
        setPdfLoading(false)
      })

    return () => {
      isMounted = false
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [templateId, hasFile])

  // Track scroll position to update current page indicator
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop
    const scaledPageHeight = PAGE_HEIGHT * scale
    const page = Math.floor(scrollTop / scaledPageHeight) + 1
    setCurrentPage(Math.min(page, numPages))
  }, [scale, numPages, PAGE_HEIGHT])

  const handleMouseDown = (e, sig) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    // Mouse position relative to the scaled container, converted to native PDF coords
    const mouseXInPdf = (e.clientX - rect.left) / scale
    const mouseYInPdf = (e.clientY - rect.top) / scale
    setDragOffset({
      x: mouseXInPdf - (sig.x_position || 350),
      y: mouseYInPdf - (sig.y_position || 700)
    })
    setDragging(sig.id)
    onSelect(sig.id)
  }

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()

    // Handle resizing
    if (resizing && onUpdateSize) {
      const mouseXInPdf = (e.clientX - rect.left) / scale
      const mouseYInPdf = (e.clientY - rect.top) / scale

      const deltaX = mouseXInPdf - resizeStart.x
      const deltaY = mouseYInPdf - resizeStart.y

      const newWidth = Math.max(50, Math.min(400, resizeStart.width + deltaX))
      const newHeight = Math.max(25, Math.min(200, resizeStart.height + deltaY))

      onUpdateSize(resizing, Math.round(newWidth), Math.round(newHeight))
      return
    }

    // Handle dragging
    if (!dragging) return

    const sig = signatories.find(s => s.id === dragging)
    if (!sig) return

    // Calculate total document height (all pages)
    const totalHeight = PAGE_HEIGHT * numPages

    // Convert mouse position to native PDF coordinates
    const mouseXInPdf = (e.clientX - rect.left) / scale
    const mouseYInPdf = (e.clientY - rect.top) / scale

    const newX = Math.max(0, Math.min(PDF_WIDTH - (sig.width || 200), mouseXInPdf - dragOffset.x))
    const newY = Math.max(0, Math.min(totalHeight - (sig.height || 80), mouseYInPdf - dragOffset.y))

    onUpdatePosition(dragging, Math.round(newX), Math.round(newY))
  }, [dragging, dragOffset, resizing, resizeStart, scale, signatories, onUpdatePosition, onUpdateSize, numPages, PAGE_HEIGHT])

  const handleMouseUp = () => {
    setDragging(null)
    setResizing(null)
  }

  // Handle resize start
  const handleResizeStart = (e, sig) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    const mouseXInPdf = (e.clientX - rect.left) / scale
    const mouseYInPdf = (e.clientY - rect.top) / scale
    setResizeStart({
      x: mouseXInPdf,
      y: mouseYInPdf,
      width: sig.width || 200,
      height: sig.height || 80
    })
    setResizing(sig.id)
    onSelect(sig.id)
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
  const getPageFromY = (y) => Math.floor(y / PAGE_HEIGHT) + 1

  const displayWidth = PDF_WIDTH * scale
  const displayHeight = PAGE_HEIGHT * scale
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
      <div className="flex items-center justify-end mb-2 gap-3">
        {/* View PDF button */}
        {hasFile && pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
          >
            <Eye className="w-3 h-3" />
            Ver PDF
          </a>
        )}
        {pdfLoading && (
          <span className="text-xs text-gray-400 animate-pulse">Cargando PDF...</span>
        )}
        {!pdfLoading && hasFile && !pdfUrl && (
          <span className="text-xs text-red-400">Error al cargar PDF</span>
        )}
        {/* Page indicator and navigation */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Página {currentPage} de {numPages}
          </span>
          {numPages > 1 && (
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
          )}
        </div>
      </div>

      {/* Scrollable PDF Container - maintains A4 aspect ratio */}
      <div
        ref={scrollContainerRef}
        className="mx-auto border-2 border-gray-300 rounded-lg shadow-lg overflow-auto bg-gray-100"
        style={{
          width: displayWidth + 24, // Extra space for padding and shadows
          maxHeight: 650, // Visible scroll area
          padding: 10,
        }}
        onScroll={handleScroll}
      >
        {/* Wrapper to maintain scroll height (CSS transform doesn't affect document flow) */}
        <div style={{ width: displayWidth, height: totalHeight, margin: '0 auto' }}>
          {/* Scaled container - renders at full PDF size then transforms down */}
          <div
            ref={containerRef}
            className="relative origin-top-left"
            style={{
              width: PDF_WIDTH,
              height: PAGE_HEIGHT * numPages, // Full height for all pages at native size
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
          {/* PDF Background - show actual PDF if available */}
          {pdfUrl && hasFile && (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="absolute inset-0 pointer-events-none"
              style={{
                width: PDF_WIDTH,
                height: PAGE_HEIGHT * numPages,
                border: 'none',
              }}
              title="PDF Preview"
            />
          )}

          {/* Render page placeholders with correct A4 proportions */}
          {[...Array(numPages)].map((_, pageIndex) => (
            <div
              key={pageIndex}
              className={`border border-gray-300 ${pdfUrl ? 'bg-transparent' : 'bg-white'}`}
              style={{
                width: PDF_WIDTH,
                height: PAGE_HEIGHT,
                position: 'absolute',
                top: pageIndex * PAGE_HEIGHT,
                left: 0,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }}
            >
              {/* Page number indicator */}
              <div className="absolute top-2 right-2 bg-gray-100/80 text-gray-500 text-xs px-2 py-1 rounded">
                Página {pageIndex + 1}
              </div>
              {/* Visual grid lines to help with positioning - only show if no PDF */}
              {!pdfUrl && (
                <>
                  <div className="absolute inset-4 border border-dashed border-gray-200 pointer-events-none opacity-50" />
                  {/* Center guides */}
                  <div className="absolute left-1/2 top-4 bottom-4 w-px bg-gray-100 pointer-events-none" />
                  <div className="absolute top-1/2 left-4 right-4 h-px bg-gray-100 pointer-events-none" />
                </>
              )}
            </div>
          ))}

          {/* No file state */}
          {!hasFile && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center text-gray-400 p-4">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sube un archivo Word para ver el preview</p>
              </div>
            </div>
          )}

          {/* Page separators - at native PDF dimensions */}
          {numPages > 1 && [...Array(numPages - 1)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t-2 border-dashed border-gray-400 pointer-events-none"
              style={{ top: PAGE_HEIGHT * (i + 1) }}
            >
              <span className="absolute left-2 -top-4 bg-gray-200 px-2 py-0.5 text-xs text-gray-500 rounded">
                Página {i + 2}
              </span>
            </div>
          ))}

          {/* Signature Fields Overlay - uses native PDF coordinates */}
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            {signatories.map((sig) => {
              const colors = getSignatureColor(sig.effective_code || sig.role || sig.signatory_type_code)
              const isSelected = selectedId === sig.id
              const isDragging = dragging === sig.id
              const sigWidth = sig.width || 200
              const sigHeight = sig.height || 80
              const datePosition = sig.date_position || 'right'
              // y_position is already stored as absolute Y coordinate (includes page offset)
              const absoluteY = sig.y_position || 700
              // Calculate page number from absolute Y for display
              const sigPage = Math.floor(absoluteY / PAGE_HEIGHT) + 1

              // Calculate actual signature area based on date position (matching PDF rendering)
              let actualSigWidth = sigWidth
              let actualSigHeight = sigHeight
              let sigAreaStyle = {}
              let dateAreaStyle = {}

              switch (datePosition) {
                case 'right':
                  actualSigWidth = sigWidth * 0.75
                  sigAreaStyle = { width: '75%', height: '100%', left: 0, top: 0 }
                  dateAreaStyle = { width: '25%', height: '100%', right: 0, top: 0 }
                  break
                case 'below':
                  actualSigHeight = sigHeight * 0.80
                  sigAreaStyle = { width: '100%', height: '80%', left: 0, top: 0 }
                  dateAreaStyle = { width: '100%', height: '20%', left: 0, bottom: 0 }
                  break
                case 'above':
                  actualSigHeight = sigHeight * 0.80
                  sigAreaStyle = { width: '100%', height: '80%', left: 0, bottom: 0 }
                  dateAreaStyle = { width: '100%', height: '20%', left: 0, top: 0 }
                  break
                case 'none':
                default:
                  sigAreaStyle = { width: '100%', height: '100%', left: 0, top: 0 }
                  dateAreaStyle = null
                  break
              }

              return (
                <div
                  key={sig.id}
                  className="absolute cursor-move transition-all duration-100"
                  style={{
                    left: sig.x_position || 350,
                    top: absoluteY,
                    width: sigWidth,
                    height: sigHeight,
                    backgroundColor: 'transparent',
                    border: `2px dashed ${colors.border}`,
                    borderRadius: 4,
                    boxShadow: isSelected ? `0 0 0 3px ${colors.border}40, 0 4px 12px rgba(0,0,0,0.15)` : isDragging ? '0 8px 20px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: isDragging ? 100 : isSelected ? 50 : 10,
                    pointerEvents: 'auto',
                    opacity: isDragging ? 0.9 : 1
                  }}
                  onMouseDown={(e) => handleMouseDown(e, sig)}
                >
                  {/* Signature area - shows actual signature space */}
                  <div
                    className="absolute flex flex-col items-center justify-center"
                    style={{
                      ...sigAreaStyle,
                      backgroundColor: colors.bg,
                      borderRadius: 2
                    }}
                  >
                    <PenTool
                      style={{ width: 16, height: 16, color: colors.text, opacity: 0.6 }}
                    />
                    <span
                      className="font-medium text-center truncate w-full px-1"
                      style={{ fontSize: 10, color: colors.text }}
                    >
                      {sig.label || sig.role_label}
                    </span>
                    {sig.required && (
                      <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 'bold' }}>
                        *Req
                      </span>
                    )}
                  </div>

                  {/* Date area - shows where date will appear */}
                  {dateAreaStyle && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        ...dateAreaStyle,
                        backgroundColor: 'rgba(100, 100, 100, 0.15)',
                        borderRadius: 2
                      }}
                    >
                      <span style={{ fontSize: 8, color: '#666', opacity: 0.8 }}>
                        {datePosition === 'right' ? '📅' : 'Fecha'}
                      </span>
                    </div>
                  )}

                  {/* Page indicator */}
                  {numPages > 1 && (
                    <div
                      className="absolute -left-2 -top-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: colors.border }}
                    >
                      {sigPage}
                    </div>
                  )}

                  {/* Move indicator */}
                  {isSelected && (
                    <div
                      className="absolute -top-3 -right-3 rounded-full p-1"
                      style={{ backgroundColor: colors.border }}
                    >
                      <Move className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {/* Resize handle - functional */}
                  {isSelected && (
                    <div
                      className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-white border-2 cursor-se-resize hover:scale-110 transition-transform flex items-center justify-center"
                      style={{ borderColor: colors.border }}
                      onMouseDown={(e) => handleResizeStart(e, sig)}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke={colors.border} strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
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
        {/* End wrapper div */}
        </div>
      </div>

      {/* Legend */}
      {signatories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {signatories.map((sig) => {
            const colors = getSignatureColor(sig.effective_code || sig.role || sig.signatory_type_code)
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

// Date position options for signature field
const DATE_POSITION_OPTIONS = [
  { value: 'right', label: 'Derecha', desc: 'Fecha a la derecha (firma usa 75% ancho)' },
  { value: 'below', label: 'Abajo', desc: 'Fecha debajo (firma usa 100% ancho)' },
  { value: 'above', label: 'Arriba', desc: 'Fecha arriba (firma usa 100% ancho)' },
  { value: 'none', label: 'Sin fecha', desc: 'Sin fecha (firma usa 100% del espacio)' },
]

function EditSignatoryModal({ isOpen, onClose, templateId, signatory, numPages = 1, onSuccess, pdfWidth = DEFAULT_PDF_WIDTH, pdfHeight = DEFAULT_PDF_HEIGHT, totalSignatories = 1 }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState(signatory?.label || '')
  const [required, setRequired] = useState(signatory?.required ?? true)
  const [position, setPosition] = useState(signatory?.position ?? 0)
  const [xPosition, setXPosition] = useState(signatory?.x_position || 350)
  const [selectedPage, setSelectedPage] = useState(1)
  const [yInPage, setYInPage] = useState(700)
  const [width, setWidth] = useState(signatory?.width || 200)
  const [height, setHeight] = useState(signatory?.height || 80)
  const [datePosition, setDatePosition] = useState(signatory?.date_position || 'right')
  const [showLabel, setShowLabel] = useState(signatory?.show_label ?? true)
  const [showSignerName, setShowSignerName] = useState(signatory?.show_signer_name ?? false)
  const [error, setError] = useState('')

  // Use provided PDF dimensions
  const PDF_WIDTH = pdfWidth
  const PDF_HEIGHT = pdfHeight

  // Sync form with signatory when modal opens
  useEffect(() => {
    if (signatory && isOpen) {
      setLabel(signatory.label || '')
      setRequired(signatory.required ?? true)
      setPosition(signatory.position ?? 0)
      setXPosition(signatory.x_position || 350)
      setWidth(signatory.width || 200)
      setHeight(signatory.height || 80)
      setDatePosition(signatory.date_position || 'right')
      setShowLabel(signatory.show_label ?? true)
      setShowSignerName(signatory.show_signer_name ?? false)

      // Calculate page and Y position within page
      const absY = signatory.y_position || 700
      const page = Math.floor(absY / pdfHeight) + 1
      const yInPageVal = absY % pdfHeight
      setSelectedPage(Math.min(page, numPages))
      setYInPage(yInPageVal)
    }
  }, [signatory, isOpen, numPages, pdfHeight])

  // Calculate absolute Y from page + position in page
  const absoluteY = (selectedPage - 1) * pdfHeight + yInPage

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
      position,
      x_position: xPosition,
      y_position: absoluteY,
      width,
      height,
      date_position: datePosition,
      show_label: showLabel,
      show_signer_name: showSignerName
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <h3 className="font-semibold">Editar Firmante</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Basic Info - Compact */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
                <p className="px-2 py-1 bg-gray-50 rounded text-sm truncate">{signatory.role_label}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Etiqueta</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej: Firma del Empleado"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Orden de firma</label>
                <input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  min="0"
                  max={totalSignatories}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-3.5 h-3.5 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Firma requerida</span>
            </label>

            {/* Location Section */}
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-gray-600 mb-2">Ubicación</p>

              {/* Page + Quick Position in one row */}
              <div className="flex gap-2 items-center mb-2">
                <span className="text-xs text-gray-500 shrink-0">Pág:</span>
                <div className="flex gap-0.5">
                  {[...Array(Math.min(numPages, 10))].map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedPage(i + 1)}
                      className={`w-6 h-6 text-xs rounded font-medium ${
                        selectedPage === i + 1
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400 mx-1">|</span>
                {positionPresets.slice(0, 3).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setXPosition(preset.x); setYInPage(preset.y) }}
                    className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Position & Size Controls - Compact Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <div>
                  <label className="block text-xs text-gray-400">X</label>
                  <input
                    type="number"
                    value={xPosition}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) setXPosition(Math.max(0, Math.min(PDF_WIDTH - width, val)))
                    }}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400">Y</label>
                  <input
                    type="number"
                    value={yInPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) setYInPage(Math.max(0, Math.min(PDF_HEIGHT - height, val)))
                    }}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400">Ancho</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) setWidth(Math.max(20, Math.min(400, val)))
                    }}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400">Alto</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) setHeight(Math.max(15, Math.min(200, val)))
                    }}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Size Presets - Inline */}
              <div className="flex gap-1 mt-2">
                <span className="text-xs text-gray-400 shrink-0 py-0.5">Tamaño:</span>
                {[
                  { label: 'S', w: 120, h: 45 },
                  { label: 'M', w: 160, h: 60 },
                  { label: 'L', w: 200, h: 80 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setWidth(preset.w); setHeight(preset.h) }}
                    className={`px-2 py-0.5 text-xs rounded ${
                      width === preset.w && height === preset.h
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Position - Compact */}
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-gray-600 mb-1.5">Posición de fecha</p>
              <div className="grid grid-cols-4 gap-1">
                {DATE_POSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDatePosition(opt.value)}
                    className={`px-2 py-1 text-xs rounded border ${
                      datePosition === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Options - Compact */}
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-gray-600 mb-1.5">Mostrar</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLabel}
                    onChange={(e) => setShowLabel(e.target.checked)}
                    className="w-3.5 h-3.5 text-primary-600 rounded"
                  />
                  <span className="text-xs text-gray-700">Etiqueta</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSignerName}
                    onChange={(e) => setShowSignerName(e.target.checked)}
                    className="w-3.5 h-3.5 text-primary-600 rounded"
                  />
                  <span className="text-xs text-gray-700">Nombre firmante</span>
                </label>
              </div>
            </div>

            {/* Summary - Minimal */}
            <div className="p-1.5 bg-gray-50 rounded text-xs text-gray-500">
              Pág {selectedPage} • ({xPosition}, {yInPage}) • {width}×{height} • Fecha: {datePosition}
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-2 border-t shrink-0">
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

function AddSignatoryModal({ isOpen, onClose, templateId, onSuccess, pdfWidth = DEFAULT_PDF_WIDTH, pdfHeight = DEFAULT_PDF_HEIGHT, totalPages = 1, existingSignatories = 0 }) {
  const queryClient = useQueryClient()
  const [typeCode, setTypeCode] = useState('')
  const [label, setLabel] = useState('')
  const [required, setRequired] = useState(true)
  const [position, setPosition] = useState(existingSignatories) // Default to next position
  const [pageNumber, setPageNumber] = useState(1)
  const [xPosition, setXPosition] = useState(350)
  const [yPosition, setYPosition] = useState(700)
  const [width, setWidth] = useState(200)
  const [height, setHeight] = useState(80)
  const [datePosition, setDatePosition] = useState('right')
  const [showLabel, setShowLabel] = useState(true)
  const [showSignerName, setShowSignerName] = useState(false)
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
    setPosition(existingSignatories)
    setPageNumber(1)
    setXPosition(350)
    setYPosition(700)
    setWidth(200)
    setHeight(80)
    setDatePosition('right')
    setShowLabel(true)
    setShowSignerName(false)
    setError('')
    onClose()
  }

  const handleSubmit = () => {
    if (!typeCode) {
      setError('Seleccione un tipo de firmante')
      return
    }
    const selectedType = signatoryTypes.find(t => t.code === typeCode)
    const data = {
      signatory_type_code: typeCode,
      label: label || selectedType?.name || 'Firma',
      required,
      position,
      page_number: pageNumber,
      x_position: xPosition,
      y_position: yPosition,
      width,
      height,
      date_position: datePosition,
      show_label: showLabel,
      show_signer_name: showSignerName
    }
    console.log('Creating signatory with data:', data)
    createMutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header - fixed */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold">Agregar Firmante</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 mb-3">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Two column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Firmante</label>
                {loadingTypes ? (
                  <div className="py-1 text-gray-500 text-sm">Cargando...</div>
                ) : signatoryTypes.length === 0 ? (
                  <div className="py-1 text-amber-600 text-sm">No hay tipos configurados</div>
                ) : (
                  <select
                    value={typeCode}
                    onChange={(e) => {
                      setTypeCode(e.target.value)
                      const selectedType = signatoryTypes.find(t => t.code === e.target.value)
                      if (!label && selectedType) setLabel(selectedType.name)
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Seleccionar tipo...</option>
                    {signatoryTypes.map((t) => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Ej: Firma del Empleado"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden de firma</label>
                  <input
                    type="number"
                    value={position}
                    onChange={(e) => setPosition(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    min="0"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">0 = firma primero</p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">Requerida</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">Mostrar etiqueta</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSignerName} onChange={(e) => setShowSignerName(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">Mostrar nombre</span>
                </label>
              </div>

              {/* Date Position - compact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posición de fecha</label>
                <div className="grid grid-cols-4 gap-1">
                  {DATE_POSITION_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setDatePosition(opt.value)}
                      className={`px-2 py-1.5 text-xs rounded-lg border-2 transition-all ${
                        datePosition === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column - Position */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Página:</label>
                <input type="number" value={pageNumber}
                  onChange={(e) => setPageNumber(Math.max(1, Math.min(totalPages, Number(e.target.value))))}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center" min="1" max={totalPages} />
                <span className="text-xs text-gray-500">de {totalPages}</span>
                {totalPages > 1 && (
                  <div className="flex gap-1 ml-auto">
                    <button type="button" onClick={() => setPageNumber(1)}
                      className={`px-2 py-1 text-xs rounded ${pageNumber === 1 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>1ra</button>
                    <button type="button" onClick={() => setPageNumber(totalPages)}
                      className={`px-2 py-1 text-xs rounded ${pageNumber === totalPages ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Últ</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">X (horizontal)</label>
                  <input type="number" value={xPosition} onChange={(e) => setXPosition(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" min="0" max="600" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Y (vertical)</label>
                  <input type="number" value={yPosition} onChange={(e) => setYPosition(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" min="0" max={pdfHeight} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ancho</label>
                  <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" min="50" max="300" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Alto</label>
                  <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" min="30" max="150" />
                </div>
              </div>
              <p className="text-xs text-gray-400">PDF: {pdfWidth} x {pdfHeight} pts</p>
            </div>
          </div>
        </div>

        {/* Footer - fixed */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t bg-gray-50 flex-shrink-0">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={createMutation.isPending} disabled={!typeCode || signatoryTypes.length === 0}>
            <Plus className="w-4 h-4" />
            Agregar
          </Button>
        </div>
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
  const [previewScale, setPreviewScale] = useState(0.7)
  const [pageHeight, setPageHeight] = useState(792) // Letter default in points
  const [pageWidth, setPageWidth] = useState(612) // Letter default in points

  const { data: templateData, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => templateService.get(id)
  })

  const template = templateData?.data?.data

  // Sync local signatories when template data changes
  // Use JSON stringify to detect deep changes in the signatories array
  const signatoriesJson = JSON.stringify(template?.signatories || [])
  useEffect(() => {
    const signatories = template?.signatories || []
    setLocalSignatories(signatories)
    setHasPositionChanges(false)
  }, [signatoriesJson])

  // Load preview settings and PDF dimensions from template
  useEffect(() => {
    if (template) {
      if (template.preview_scale) setPreviewScale(template.preview_scale)
      // Use actual PDF dimensions from template, fallback to preview_page_height or defaults
      if (template.pdf_height) {
        setPageHeight(template.pdf_height)
      } else if (template.preview_page_height) {
        setPageHeight(template.preview_page_height)
      }
      if (template.pdf_width) {
        setPageWidth(template.pdf_width)
      }
      if (template.pdf_page_count) {
        setDocumentPages(template.pdf_page_count)
      }
    }
  }, [template?.id])

  // Handle position update from drag
  // Store absolute Y position - backend will calculate page and relative position
  const handleUpdateSignatoryPosition = useCallback((sigId, x, absoluteY) => {
    setLocalSignatories(prev =>
      prev.map(sig =>
        sig.id === sigId
          ? { ...sig, x_position: x, y_position: absoluteY }
          : sig
      )
    )
    setHasPositionChanges(true)
  }, [])

  // Handle size update from resize
  const handleUpdateSignatorySize = useCallback((sigId, width, height) => {
    setLocalSignatories(prev =>
      prev.map(sig =>
        sig.id === sigId
          ? { ...sig, width, height }
          : sig
      )
    )
    setHasPositionChanges(true)
  }, [])

  // Save all position changes and preview settings to backend
  const savePositionsMutation = useMutation({
    mutationFn: async () => {
      // Save preview settings (scale and page height)
      await templateService.update(id, {
        template: {
          preview_scale: previewScale,
          preview_page_height: pageHeight
        }
      })

      // Save signatory positions and sizes (absolute Y - backend calculates page)
      const updates = localSignatories.map(sig => ({
        id: sig.id,
        x_position: sig.x_position,
        y_position: sig.y_position,
        width: sig.width,
        height: sig.height
      }))
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
      // Merge existing mappings with edited ones to preserve unchanged values
      const allMappings = { ...template.variable_mappings, ...editingMappings }
      await updateMutation.mutateAsync({ variable_mappings: allMappings })
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
                                .map(([label, path], idx) => (
                                  <option key={`employee-${idx}-${path}`} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Organizacion">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('organization.'))
                                .map(([label, path], idx) => (
                                  <option key={`organization-${idx}-${path}`} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Sistema">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('system.'))
                                .map(([label, path], idx) => (
                                  <option key={`system-${idx}-${path}`} value={path}>{label}</option>
                                ))
                              }
                            </optgroup>
                            <optgroup label="Solicitud">
                              {Object.entries(availableMappings)
                                .filter(([, path]) => path.startsWith('request.'))
                                .map(([label, path], idx) => (
                                  <option key={`request-${idx}-${path}`} value={path}>{label}</option>
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
                  {(hasPositionChanges ||
                    previewScale !== (template?.preview_scale || 0.7) ||
                    pageHeight !== (template?.preview_page_height || 842)) && (
                    <Button
                      size="sm"
                      onClick={() => savePositionsMutation.mutate()}
                      loading={savePositionsMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                      Guardar Cambios
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-sm text-gray-500">
                  Arrastra los campos de firma para posicionarlos.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Escala:</label>
                    <input
                      type="number"
                      min="0.3"
                      max="2"
                      step="0.05"
                      value={previewScale}
                      onChange={(e) => setPreviewScale(parseFloat(e.target.value) || 0.7)}
                      className="w-16 px-2 py-1 text-xs border rounded text-center"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Alto página:</label>
                    <input
                      type="number"
                      min="500"
                      max="1500"
                      step="10"
                      value={pageHeight}
                      onChange={(e) => setPageHeight(parseInt(e.target.value) || 842)}
                      className="w-20 px-2 py-1 text-xs border rounded text-center"
                    />
                    <span className="text-xs text-gray-400">pts</span>
                  </div>
                </div>
              </div>
              <SignaturePreview
                templateId={id}
                hasFile={!!template.file_name}
                signatories={localSignatories}
                selectedId={selectedSignatoryId}
                onSelect={(id) => setSelectedSignatoryId(id)}
                onUpdatePosition={handleUpdateSignatoryPosition}
                onUpdateSize={handleUpdateSignatorySize}
                scale={previewScale}
                numPages={documentPages}
                customPageHeight={pageHeight}
                customPageWidth={pageWidth}
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
                            Tamaño: {sig.width || 200} x {sig.height || 80} px | Fecha: {DATE_POSITION_OPTIONS.find(o => o.value === (sig.date_position || 'right'))?.label || 'Derecha'}
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
                  {/* Sort by position for display */}
                  {[...localSignatories].sort((a, b) => (a.position || 0) - (b.position || 0)).map((sig) => (
                    <div
                      key={sig.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedSignatoryId === sig.id ? 'bg-primary-50 ring-2 ring-primary-500' : 'bg-gray-50 hover:bg-gray-100'}`}
                      onClick={() => setSelectedSignatoryId(sig.id)}
                    >
                      <div className="flex flex-col items-center">
                        <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {(sig.position ?? 0) + 1}
                        </span>
                        <span className="text-[10px] text-gray-400">orden</span>
                      </div>
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
        pdfWidth={pageWidth}
        pdfHeight={pageHeight}
        totalPages={documentPages}
        existingSignatories={localSignatories.length}
        onSuccess={() => {}}
      />

      {/* Edit Signatory Modal */}
      <EditSignatoryModal
        isOpen={!!editingSignatory}
        onClose={() => setEditingSignatory(null)}
        templateId={id}
        signatory={editingSignatory}
        numPages={documentPages}
        pdfWidth={pageWidth}
        pdfHeight={pageHeight}
        totalSignatories={localSignatories.length}
        onSuccess={() => {}}
      />
    </div>
  )
}
