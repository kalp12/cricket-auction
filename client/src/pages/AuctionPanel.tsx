import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Gavel, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { listAuctions } from '../api'
import { SkeletonGrid, EmptyState } from '../components/ui'

const statusStyles: Record<string, string> = {
  live: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ended: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  waiting: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function AuctionPanel() {
  const navigate = useNavigate()
  const [auctions, setAuctions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAuctions = async () => {
      try { const data = await listAuctions(); setAuctions(data) }
      catch (e: any) { if (e?.response?.status === 401) { localStorage.removeItem('token'); navigate('/login') } else { toast.error('Failed to load auctions') } } finally { setLoading(false) }
    }
    fetchAuctions()
  }, [])

  if (loading) return <div className="animate-fade-in pt-4"><SkeletonGrid count={3} /></div>

  if (auctions.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="font-display text-5xl tracking-wide text-white mb-8">AUCTION PANEL</h1>
        <EmptyState
          icon={Gavel}
          title="No auctions yet"
          message="Create your first auction to start bidding!"
          action={{ label: 'Create Auction', onClick: () => navigate('/auctions/new') }}
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in relative noise-bg">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <h1 className="font-display text-3xl md:text-5xl tracking-wider gradient-text mb-2">AUCTION PANEL</h1>
      <p className="text-gray-500 mb-8">Select an auction to enter the live room</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctions.map((a, i) => (
          <motion.button
            key={a.id}
            onClick={() => navigate(`/auctions/${a.id}/live`)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="glass-strong rounded-2xl p-6 text-left group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border ${statusStyles[a.status] || statusStyles.waiting}`}>
                {a.status}
              </span>
              {a.status === 'live' && (
                <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
              )}
            </div>
            <h3 className="font-display text-2xl tracking-wide text-white">{a.name}</h3>
            <p className="text-sm text-gray-500 mt-1 group-hover:text-gray-400 transition-colors">Click to open live auction</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
