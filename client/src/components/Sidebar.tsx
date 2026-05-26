import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  PlusCircle,
  Briefcase,
  Gavel,
  LogOut,
  Trophy,
  Sun,
  Moon,
  X,
  Users
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useSidebar } from './DashboardLayout'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/auctions/new', icon: PlusCircle, label: 'New Auction' },
  { to: '/auctions', icon: Briefcase, label: 'My Auctions' },
  { to: '/auction-panel', icon: Gavel, label: 'Auction Panel' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { setOpen } = useSidebar()
  const { canEdit, isOwner } = useAuth()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  const handleNav = () => {
    setOpen(false)
  }

  return (
    <aside className="w-72 h-full bg-surface-0 border-r border-white/5 flex flex-col noise-bg">
      {/* Logo + mobile close */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl tracking-wide text-white">CRICKET AUCTION</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Admin Panel</p>
            </div>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-6 px-4 space-y-1">
        {links.map(({ to, icon: Icon, label }, i) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
              isActive
                ? 'bg-white/10 text-white shadow-lg shadow-white/5 border border-white/10'
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-accent-gold' : 'text-gray-600 group-hover:text-gray-400'}`} />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-gold"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
        {canEdit && (
          <NavLink
            to="/users"
            onClick={handleNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-white/10 text-white shadow-lg shadow-white/5 border border-white/10'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Users className={`w-5 h-5 transition-colors ${isActive ? 'text-accent-gold' : 'text-gray-600 group-hover:text-gray-400'}`} />
                Users
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-gold"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        )}
      </nav>

      {/* Theme Toggle + Logout */}
      <div className="px-4 py-4 border-t border-white/5 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-white/5 hover:text-gray-300 w-full transition-all duration-200"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 w-full transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
