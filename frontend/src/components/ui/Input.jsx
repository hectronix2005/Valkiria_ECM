import { forwardRef } from 'react'

const Input = forwardRef(({ label, error, hint, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 border rounded-lg text-gray-900
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-500
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
