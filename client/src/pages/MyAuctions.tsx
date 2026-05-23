import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, ArrowLeft, Trash2, Pencil, Calendar, Users, Gavel } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'
import { useConfirm } from '../hooks/useConfirm'
import { listAuctions, deleteAuction } from '../api'
import { SkeletonGrid, EmptyState } from '../components/ui'

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Waiting' },
  live:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Live' },
  paused:  { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Paused' },
  ended:   { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'Ended' },
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

export default function MyAuctions() {
  const navigate = useNavigate()
  const [auctions, setAuctions] = useState<any[]>([])
  const { confirmState, confirm, cancel } = useConfirm()
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAuctions() }, [])

  const fetchAuctions = async () => {
    try {
      const data = await listAuctions()
      setAuctions(data)
    } catch {
      /* auth issue */
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!(await confirm({ title: 'Delete Auction', message: 'This cannot be undone. All teams, players, and bid history will be removed.', confirmLabel: 'Delete', danger: true }))) return
    try {
      await deleteAuction(id); toast.success('Auction deleted')
      setAuctions(prev => prev.filter(a => a.id !== id))
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-gold/40 border-t-accent-gold rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading auctions...</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="animate-fade-in relative noise-bg">
      {/* Ambient blur orb */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-600 mb-6 flex items-center gap-2">
        <NavLink to="/" className="hover:text-gray-400 transition-colors">HOME</NavLink>
        <span className="text-gray-700">/</span>
        <span className="text-gray-400">MY AUCTIONS</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-xl glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="font-display text-3xl md:text-4xl tracking-wider gradient-text">MY AUCTIONS</h1>
            <p className="text-gray-500 text-sm mt-1">{auctions.length} auction{auctions.length !== 1 ? 's' : ''} created</p>
          </div>
        </div>
        <motion.button
          onClick={() => navigate('/auctions/new')}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-shadow duration-300"
        >
          <PlusCircle className="w-4 h-4" />
          New Auction
        </motion.button>
      </div>

      {/* Empty state */}
      {auctions.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No auctions yet"
          message="Create your first auction to start bidding!"
          action={{ label: 'Create Auction', onClick: () => navigate('/auctions/new') }}
        />
      ) : (
        /* Card grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {auctions.map((auction, i) => {
              const s = statusConfig[auction.status] || statusConfig.waiting
              const imageUrl = auction.image_url
                ? `http://localhost:8000${auction.image_url}`
                : null

              return (
                <motion.div
                  key={auction.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/auctions/${auction.id}`)}
                  className="glass-strong rounded-2xl p-6 cursor-pointer group relative overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-white/5"
                >
                  {/* Subtle shimmer on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer rounded-2xl pointer-events-none" />

                  {/* Top row: avatar + status + actions */}
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={auction.name}
                          className="w-11 h-11 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-600/30 flex items-center justify-center">
                          <span className="text-lg font-bold text-accent-gold">
                            {auction.name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-accent-gold transition-colors duration-300 leading-tight">
                          {auction.name}
                        </h3>
                        <p className="text-xs font-mono text-gray-600">A-{String(auction.id).padStart(3, '0')}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${s.bg} ${s.text} ${
                      auction.status === 'live' ? 'border-emerald-500/30' :
                      auction.status === 'paused' ? 'border-amber-500/30' :
                      auction.status === 'ended' ? 'border-rose-500/30' :
                      'border-gray-500/30'
                    }`}>
                      {s.label}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Budget</p>
                        <p className="text-sm font-semibold text-gray-300">{formatPrice(auction.budget_per_team)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Teams</p>
                        <p className="text-sm font-semibold text-gray-300">{auction.team_count ?? auction.teams_count ?? '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: actions + go button */}
                  <div className="mt-5 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/auctions/${auction.id}`) }}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDelete(e, auction.id)}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-rose-500/10 flex items-center justify-center text-gray-500 hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/auctions/${auction.id}`) }}
                      className="px-4 py-1.5 rounded-lg bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold text-sm font-semibold border border-accent-gold/20 hover:border-accent-gold/30 transition-colors duration-200"
                    >
                      Open →
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>

    <ConfirmModal
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      confirmLabel={confirmState.confirmLabel}
      danger={confirmState.danger}
      onConfirm={confirmState.onConfirm}
      onCancel={cancel}
    />
  </>
  )
}
