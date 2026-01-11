import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { Calendar, Award } from 'lucide-react'
import Vacations from './Vacations'
import Certifications from './Certifications'

const tabs = [
  { id: 'vacations', name: 'Vacaciones', icon: Calendar, path: '/hr/my-requests/vacations' },
  { id: 'certifications', name: 'Certificaciones', icon: Award, path: '/hr/my-requests/certifications' },
]

export default function MyRequests() {
  const { tab } = useParams()
  const navigate = useNavigate()

  // Redirect to default tab if no tab specified
  if (!tab) {
    return <Navigate to="/hr/my-requests/vacations" replace />
  }

  // Validate tab parameter
  const validTabs = ['vacations', 'certifications']
  if (!validTabs.includes(tab)) {
    return <Navigate to="/hr/my-requests/vacations" replace />
  }

  const activeTab = tab

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tabItem) => {
            const Icon = tabItem.icon
            const isActive = activeTab === tabItem.id
            return (
              <button
                key={tabItem.id}
                onClick={() => navigate(tabItem.path)}
                className={`
                  group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tabItem.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content - Components render with their own headers and buttons */}
      <div>
        {activeTab === 'vacations' && <Vacations />}
        {activeTab === 'certifications' && <Certifications />}
      </div>
    </div>
  )
}
