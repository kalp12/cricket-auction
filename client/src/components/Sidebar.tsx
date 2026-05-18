import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  Briefcase,
  Gavel,
  LogOut,
  Trophy
} from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/auctions/new', icon: PlusCircle, label: 'New Auction' },
  { to: '/auctions', icon: Briefcase, label: 'My Auctions' },
  { to: '/auction-panel', icon: Gavel, label: 'Auction Panel' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-blue-900 text-white flex flex-col z-50">
      <div className="px-6 py-5 border-b border-blue-800 flex items-center gap-3">
        <Trophy className="w-8 h-8 text-yellow-400" />
        <div>
          <h1 className="text-lg font-bold leading-tight">Cricket Auction</h1>
          <p className="text-xs text-blue-300">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-800 shadow-lg text-white'
                  : 'text-blue-200 hover:bg-blue-800/50 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-blue-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-800/50 hover:text-white w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
