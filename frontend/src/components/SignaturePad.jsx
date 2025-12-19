import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'

export default function SignaturePad({
  onSave,
  initialData = null,
  width = 400,
  height = 150,
  strokeColor = '#000000',
  strokeWidth = 2,
  disabled = false
}) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [lastPoint, setLastPoint] = useState(null)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Set drawing styles
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Fill with transparent background
    ctx.clearRect(0, 0, width, height)

    // Load initial data if provided
    if (initialData) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        setHasContent(true)
      }
      img.src = initialData.startsWith('data:')
        ? initialData
        : `data:image/png;base64,${initialData}`
    }
  }, [initialData, width, height, strokeColor, strokeWidth])

  const getPointFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }, [])

  const startDrawing = useCallback((e) => {
    if (disabled) return
    e.preventDefault()

    const point = getPointFromEvent(e)
    setLastPoint(point)
    setIsDrawing(true)
    setHasContent(true)
  }, [disabled, getPointFromEvent])

  const draw = useCallback((e) => {
    if (!isDrawing || disabled) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const currentPoint = getPointFromEvent(e)

    ctx.beginPath()
    ctx.moveTo(lastPoint.x, lastPoint.y)
    ctx.lineTo(currentPoint.x, currentPoint.y)
    ctx.stroke()

    setLastPoint(currentPoint)
  }, [isDrawing, disabled, lastPoint, getPointFromEvent])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    setLastPoint(null)

    if (hasContent && onSave) {
      const canvas = canvasRef.current
      const dataUrl = canvas.toDataURL('image/png')
      // Remove the data:image/png;base64, prefix for backend storage
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
      onSave(base64Data)
    }
  }, [hasContent, onSave])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)

    if (onSave) {
      onSave(null)
    }
  }, [onSave])

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`border-2 border-dashed rounded-lg bg-white relative ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-crosshair'
        }`}
        style={{ width: '100%', maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{
            aspectRatio: `${width}/${height}`,
            maxHeight: height
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!hasContent && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-sm">
            Dibuje su firma aqui
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Eraser className="w-4 h-4" />
            Borrar
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar
          </button>
        </div>
      )}
    </div>
  )
}
