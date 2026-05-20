import { useNavigate } from 'react-router-dom'
import { PlusCircle, Briefcase, Gavel } from 'lucide-react'

const cards = [
  {
    label: 'New Auction',
    description: 'Create a new auction event',
    icon: PlusCircle,
    to: '/auctions/new',
    color: 'blue',
  },
  {
    label: 'My Auctions',
    description: 'View and manage your auctions',
    icon: Briefcase,
    to: '/auctions',
    color: 'purple',
  },
  {
    label: 'Auction Panel',
    description: 'Go to live auction room',
    icon: Gavel,
    to: '/auction-panel',
    color: 'red',
  },
]

const colorMap: Record<string, { bg: string; border: string; iconBg: string; icon: string }> = {
  blue: { bg: 'hover:bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', icon: 'text-blue-600' },
  purple: { bg: 'hover:bg-purple-50', border: 'border-purple-200', iconBg: 'bg-purple-100', icon: 'text-purple-600' },
  red: { bg: 'hover:bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', icon: 'text-red-600' },
}

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">DASHBOARD</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
        {cards.map(({ label, description, icon: Icon, to, color }) => {
          const c = colorMap[color]
          return (
            <button
              key={label}
              onClick={() => navigate(to)}
              className={`bg-white rounded-xl border-2 ${c.border} ${c.bg} p-8 flex flex-col items-center gap-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className={`w-16 h-16 rounded-full ${c.iconBg} flex items-center justify-center`}>
                <Icon className={`w-8 h-8 ${c.icon}`} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800">{label}</h3>
                <p className="text-sm text-gray-500 mt-1">{description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
