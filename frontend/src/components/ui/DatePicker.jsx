import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

/**
 * DatePicker with visual calendar that shows booked dates as strikethrough
 *
 * @param {string} value - Selected date in YYYY-MM-DD format
 * @param {function} onChange - Called with YYYY-MM-DD string
 * @param {string} label - Input label
 * @param {string} min - Minimum selectable date (YYYY-MM-DD)
 * @param {Array} bookedDates - Array of Date objects that are already booked
 * @param {Array} weekendDates - (auto-calculated) weekends are disabled by default
 * @param {boolean} required
 */
export default function DatePicker({ value, onChange, label, min, bookedDates = [], required, error }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value + 'T00:00:00')
    if (min) return new Date(min + 'T00:00:00')
    return new Date()
  })
  const containerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Update viewDate when value changes externally
  useEffect(() => {
    if (value) setViewDate(new Date(value + 'T00:00:00'))
  }, [value])

  const minDate = min ? new Date(min + 'T00:00:00') : null

  const isBooked = (date) => {
    return bookedDates.some(bd => isSameDay(bd, date))
  }

  const isWeekend = (date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const isDisabled = (date) => {
    if (minDate && date < minDate && !isSameDay(date, minDate)) return true
    if (isWeekend(date)) return true
    if (isBooked(date)) return true
    return false
  }

  const isSelected = (date) => {
    if (!value) return false
    const sel = new Date(value + 'T00:00:00')
    return isSameDay(date, sel)
  }

  const handleSelect = (date) => {
    if (isDisabled(date)) return
    onChange(toDateStr(date))
    setOpen(false)
  }

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  // Build calendar grid
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  // Monday=0 based offset
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  // Empty cells before first day
  for (let i = 0; i < startOffset; i++) {
    cells.push(null)
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div
        className={`w-full px-3 py-2 border rounded-lg text-gray-900 cursor-pointer flex items-center justify-between
          focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${!value ? 'text-gray-400' : ''}
        `}
        onClick={() => setOpen(!open)}
      >
        <span className={!value ? 'text-gray-400' : 'text-gray-900'}>
          {displayValue || 'Seleccionar fecha'}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>
      {/* Hidden input for form validation */}
      {required && <input type="text" value={value || ''} required tabIndex={-1} className="sr-only" onChange={() => {}} />}

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[300px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-sm text-gray-900">
              {MONTHS_ES[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAYS_ES.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {cells.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="h-9" />
              }

              const disabled = isDisabled(date)
              const booked = isBooked(date)
              const weekend = isWeekend(date)
              const selected = isSelected(date)
              const today = isSameDay(date, new Date())

              return (
                <button
                  key={date.getDate()}
                  type="button"
                  onClick={() => handleSelect(date)}
                  disabled={disabled}
                  title={
                    booked ? 'Día ya solicitado' :
                    weekend ? 'Fin de semana' :
                    disabled ? 'No disponible' : ''
                  }
                  className={`
                    h-9 w-full text-sm rounded-md relative flex items-center justify-center
                    ${selected
                      ? 'bg-primary-500 text-white font-bold'
                      : today
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : ''
                    }
                    ${!disabled && !selected ? 'hover:bg-primary-100 cursor-pointer' : ''}
                    ${disabled && !booked ? 'text-gray-300 cursor-not-allowed' : ''}
                    ${booked ? 'cursor-not-allowed' : ''}
                  `}
                >
                  <span className={booked && !selected ? 'text-red-400 line-through decoration-red-500 decoration-2' : ''}>
                    {date.getDate()}
                  </span>
                  {booked && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 line-through decoration-red-500 decoration-2">15</span>
              <span>Ya solicitado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300">S</span>
              <span>No disponible</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
