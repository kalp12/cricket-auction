import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  PlusCircle,
  Briefcase,
  Gavel,
  Users,
  User,
  Settings,
  BarChart3,
  Clock,
  ArrowRight,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  sublabel?: string
  icon: any
  action: () => void
  keywords: string[]
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { auctionId } = useParams()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const commands: CommandItem[] = [
    { id: 'dashboard', label: 'Dashboard', sublabel: 'Home overview', icon: LayoutDashboard, action: () => { navigate('/dashboard'); close() }, keywords: ['home', 'dashboard', 'overview'] },
    { id: 'new-auction', label: 'New Auction', sublabel: 'Create a new auction', icon: PlusCircle, action: () => { navigate('/auctions/new'); close() }, keywords: ['create', 'new', 'auction', 'add'] },
    { id: 'my-auctions', label: 'My Auctions', sublabel: 'View all auctions', icon: Briefcase, action: () => { navigate('/auctions'); close() }, keywords: ['auctions', 'list', 'my', 'view'] },
    { id: 'auction-panel', label: 'Auction Panel', sublabel: 'Live auction picker', icon: Gavel, action: () => { navigate('/auction-panel'); close() }, keywords: ['panel', 'live', 'bid', 'auction'] },
    { id: 'teams', label: 'Manage Teams', sublabel: 'Team management', icon: Users, action: () => { navigate(auctionId ? `/auctions/${auctionId}/teams` : '/auction-panel'); close() }, keywords: ['team', 'manage', 'players', 'roster'] },
    { id: 'players', label: 'Manage Players', sublabel: 'Player management', icon: User, action: () => { navigate(auctionId ? `/auctions/${auctionId}/players` : '/auction-panel'); close() }, keywords: ['player', 'manage', 'add', 'cricket'] },
    { id: 'settings', label: 'Settings', sublabel: 'Auction rules & configs', icon: Settings, action: () => { navigate(auctionId ? `/auctions/${auctionId}/settings` : '/auction-panel'); close() }, keywords: ['settings', 'config', 'rules', 'slabs', 'timer'] },
    { id: 'stats', label: 'Auction Stats', sublabel: 'Analytics & charts', icon: BarChart3, action: () => { navigate(auctionId ? `/auctions/${auctionId}/stats` : '/auction-panel'); close() }, keywords: ['stats', 'analytics', 'charts', 'data'] },
    { id: 'history', label: 'Auction History', sublabel: 'Past results', icon: Clock, action: () => { navigate(auctionId ? `/auctions/${auctionId}/history` : '/auction-panel'); close() }, keywords: ['history', 'results', 'past', 'sold'] },
  ]

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : commands

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        if (!open) {
          setTimeout(() => inputRef.current?.focus(), 50)
        }
      }
      if (e.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, close])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[90vw] max-w-lg z-[101]"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="glass-strong rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-gray-500 shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, actions..."
                  className="flex-1 bg-transparent text-white placeholder-gray-600 outline-none text-base"
                  aria-label="Search commands"
                />
                <kbd className="hidden sm:inline px-2 py-0.5 rounded-md bg-surface-3 text-xs text-gray-500 font-mono border border-white/5">ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto p-2 dark-scrollbar" role="listbox" aria-label="Command results">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-600 text-sm">No results found</div>
                ) : (
                  filtered.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        i === selectedIndex
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
                      }`}
                      role="option"
                      aria-selected={i === selectedIndex}
                    >
                      <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        {item.sublabel && <div className="text-xs text-gray-600 truncate">{item.sublabel}</div>}
                      </div>
                      {i === selectedIndex && <ArrowRight className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />}
                    </button>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-2.5 border-t border-white/5 flex items-center gap-4 text-xs text-gray-600" aria-hidden="true">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-3 font-mono text-[10px]">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-3 font-mono text-[10px]">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-3 font-mono text-[10px]">esc</kbd> close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
