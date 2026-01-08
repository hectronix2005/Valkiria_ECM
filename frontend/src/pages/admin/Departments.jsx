import { Building, Settings } from 'lucide-react'

export default function Departments() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Building className="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departamentos</h1>
          <p className="text-gray-500">Gestión de departamentos y áreas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Settings className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">En Desarrollo</h2>
          <p className="text-gray-500 max-w-md">
            La gestión de departamentos estará disponible pronto.
            Podrás crear, editar y organizar los departamentos de la empresa.
          </p>
        </div>
      </div>
    </div>
  )
}
