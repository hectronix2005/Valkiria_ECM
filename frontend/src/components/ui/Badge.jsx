const variants = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
  on_leave: 'bg-yellow-100 text-yellow-800',
}

const labels = {
  draft: 'Borrador',
  pending: 'Pendiente',
  processing: 'En proceso',
  approved: 'Aprobado',
  completed: 'Completado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  active: 'Activo',
  inactive: 'Inactivo',
  on_leave: 'De licencia',
}

export default function Badge({ status, children }) {
  const variant = variants[status] || 'bg-gray-100 text-gray-700'
  const label = children || labels[status] || status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant}`}>
      {label}
    </span>
  )
}
