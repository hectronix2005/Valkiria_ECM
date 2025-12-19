import { useState, useEffect } from 'react'

// Available signature fonts (must match backend SIGNATURE_FONTS)
const SIGNATURE_FONTS = [
  { name: 'Allura', family: 'Allura, cursive' },
  { name: 'Dancing Script', family: '"Dancing Script", cursive' },
  { name: 'Great Vibes', family: '"Great Vibes", cursive' },
  { name: 'Pacifico', family: 'Pacifico, cursive' },
  { name: 'Sacramento', family: 'Sacramento, cursive' },
]

// Color options for signatures
const SIGNATURE_COLORS = [
  { name: 'Negro', value: '#000000' },
  { name: 'Azul Oscuro', value: '#1e3a5f' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde Oscuro', value: '#166534' },
  { name: 'Gris', value: '#4b5563' },
]

export default function StyledSignature({
  defaultText = '',
  defaultFont = 'Allura',
  defaultColor = '#000000',
  defaultSize = 48,
  onChange,
  disabled = false
}) {
  const [text, setText] = useState(defaultText)
  const [selectedFont, setSelectedFont] = useState(defaultFont)
  const [selectedColor, setSelectedColor] = useState(defaultColor)
  const [fontSize, setFontSize] = useState(defaultSize)
  const [fontsLoaded, setFontsLoaded] = useState(false)

  // Load Google Fonts
  useEffect(() => {
    const loadFonts = async () => {
      const fontFamilies = SIGNATURE_FONTS.map(f => f.name.replace(' ', '+')).join('&family=')
      const link = document.createElement('link')
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`
      link.rel = 'stylesheet'
      document.head.appendChild(link)

      link.onload = () => setFontsLoaded(true)
    }

    loadFonts()
  }, [])

  // Notify parent of changes
  useEffect(() => {
    if (onChange && text) {
      onChange({
        styled_text: text,
        font_family: selectedFont,
        font_color: selectedColor,
        font_size: fontSize
      })
    }
  }, [text, selectedFont, selectedColor, fontSize, onChange])

  const currentFontFamily = SIGNATURE_FONTS.find(f => f.name === selectedFont)?.family || 'cursive'

  return (
    <div className="flex flex-col gap-4">
      {/* Text input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Texto de la firma
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escriba su nombre o iniciales"
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Font selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Estilo de fuente
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {SIGNATURE_FONTS.map((font) => (
            <button
              key={font.name}
              type="button"
              onClick={() => setSelectedFont(font.name)}
              disabled={disabled}
              className={`p-3 border rounded-lg text-left transition-all ${
                selectedFont === font.name
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                style={{
                  fontFamily: font.family,
                  fontSize: '20px',
                  color: selectedColor
                }}
              >
                {text || 'Firma'}
              </span>
              <span className="block text-xs text-gray-500 mt-1">{font.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Color de la firma
        </label>
        <div className="flex gap-2">
          {SIGNATURE_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setSelectedColor(color.value)}
              disabled={disabled}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                selectedColor === color.value
                  ? 'ring-2 ring-offset-2 ring-primary-500'
                  : 'hover:scale-110'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              disabled={disabled}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
              title="Color personalizado"
            />
            <span className="text-xs text-gray-500">Personalizado</span>
          </div>
        </div>
      </div>

      {/* Size selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tamano: {fontSize}px
        </label>
        <input
          type="range"
          min="24"
          max="72"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vista previa
        </label>
        <div
          className={`p-4 border-2 border-dashed rounded-lg bg-white min-h-[80px] flex items-center justify-center ${
            !fontsLoaded ? 'animate-pulse' : ''
          }`}
        >
          {text ? (
            <span
              style={{
                fontFamily: currentFontFamily,
                fontSize: `${fontSize}px`,
                color: selectedColor
              }}
            >
              {text}
            </span>
          ) : (
            <span className="text-gray-400">Escriba su nombre para ver la vista previa</span>
          )}
        </div>
      </div>
    </div>
  )
}
