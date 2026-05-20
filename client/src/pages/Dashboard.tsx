import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PlusCircle, Briefcase, Gavel, Zap } from 'lucide-react'

const cards = [
  {
    label: 'New Auction',
    description: 'Create a new auction event',
    icon: PlusCircle,
    to: '/auctions/new',
    gradient: 'from-violet-600 to-indigo-600',
    shadow: 'shadow-violet-500/20',
    glow: 'rgba(139, 92, 246, 0.1)',
  },
  {
    label: 'My Auctions',
    description: 'View and manage your auctions',
    icon: Briefcase,
    to: '/auctions',
    gradient: 'from-cyan-600 to-blue-600',
    shadow: 'shadow-cyan-500/20',
    glow: 'rgba(6, 182, 212, 0.1)',
  },
  {
    label: 'Auction Panel',
    description: 'Go to live auction room',
    icon: Gavel,
    to: '/auction-panel',
    gradient: 'from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/20',
    glow: 'rgba(245, 158, 11, 0.1)',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="animate-fade-in relative">
      {/* Ambient */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-600">HOME</span>
      </nav>

      <div className="mb-10">
        <h1 className="font-display text-5xl tracking-wide text-white mb-2">DASHBOARD</h1>
        <p className="text-gray-500">Manage your cricket auctions from one place</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
        {cards.map(({ label, description, icon: Icon, to, gradient, shadow, glow }, i) => (
          <motion.button
            key={label}
            onClick={() => navigate(to)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            className={`glass-strong rounded-2xl p-8 flex flex-col items-center gap-5 cursor-pointer text-left group relative overflow-hidden transition-shadow duration-300 hover:${shadow}`}
            style={{ '--hover-glow': glow } as any}
          >
            {/* Gradient icon bg */}
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${shadow} group-hover:shadow-xl transition-shadow duration-300`}>
              <Icon className="w-8 h-8 text-white" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">{label}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>

            {/* Subtle shimmer */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer rounded-2xl pointer-events-none" />
          </motion.button>
        ))}
      </div>

      {/* Quick stats hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 glass rounded-xl p-5 max-w-3xl flex items-center gap-3"
      >
        <Zap className="w-5 h-5 text-accent-gold" />
        <p className="text-sm text-gray-400">
          Create an auction to get started. Add teams, players, configure bid slabs, and go live!
        </p>
      </motion.div>
    </div>
  )
}
