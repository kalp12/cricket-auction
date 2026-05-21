import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Users, User, Tags, Pencil, Trash2,
  Link, Copy, Timer, TrendingUp, Palette, History, BarChart3
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'
import { useConfirm } from '../hooks/useConfirm'
import { getAuction, updateAuction, deleteAuction } from '../api'
import { SkeletonLine, SkeletonCircle, SkeletonCard, SkeletonGrid } from '../components/ui'

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const statusStyles: Record<string, string> = {
  live: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ended: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  waiting: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const { confirmState, confirm, cancel } = useConfirm()

  useEffect(() => { fetchAuction() }, [id])

  const fetchAuction = async () => {
    try {
      const data = await getAuction(Number(id))
      setAuction(data); setEditForm(data)
    } catch { navigate('/auctions') } finally { setLoading(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateAuction(Number(id), {
        name: editForm.name, timer_seconds: editForm.timer_seconds, timer_mode: editForm.timer_mode,
        base_bid: editForm.base_bid, budget_per_team: editForm.budget_per_team,
        min_players: editForm.min_players, max_players: editForm.max_players,
      })
      setAuction(updated); setEditMode(false); toast.success('Auction updated')
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Update failed') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!(await confirm({ title: 'Delete Auction', message: 'This cannot be undone. All teams, players, and bid history will be removed.', confirmLabel: 'Delete', danger: true }))) return
    try { await deleteAuction(Number(id)); toast.success('Auction deleted'); navigate('/auctions') } catch { toast.error('Delete failed') }
  }

  const handleDeactivate = async () => {
    const newStatus = auction.status === 'ended' ? 'waiting' : 'ended'
    try { const updated = await updateAuction(Number(id), { status: newStatus }); setAuction(updated); toast.success('Status updated') } catch { toast.error('Status update failed') }
  }

  const copyLink = (text: string) => { navigator.clipboard.writeText(text); toast.success('Link copied!') }

  if (loading) return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-6"><SkeletonCircle size="56px" /><div className="space-y-2"><SkeletonLine width="200px" height="36px" /><SkeletonLine width="120px" height="16px" /></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>
    </div>
    )
  if (!auction) return null

  const isActive = auction.status !== 'ended'

  return (
    <>
    <div className="animate-fade-in noise-bg relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <nav className="text-sm text-gray-600 mb-2">
        <span className="text-gray-600">HOME</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-400 font-medium">{auction.name?.toUpperCase()}</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/auctions')} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-5xl tracking-wide text-white">{auction.name}</h1>
      </div>

      {/* Summary Card */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-4">
            {auction.image_url ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10">
                <img src={`http://localhost:8000${auction.image_url}`} alt={auction.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 bg-gradient-to-br from-accent-gold to-amber-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-display text-white">{auction.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{auction.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono bg-surface-3 px-2 py-1 rounded text-gray-400">A-{String(auction.id).padStart(3, '0')}</span>
                <span className={`text-xs px-2 py-1 rounded-lg font-bold uppercase border ${statusStyles[auction.status] || statusStyles.waiting}`}>{auction.status}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/auctions/${id}/teams`)} title="Teams" className="p-2.5 hover:bg-white/5 rounded-xl transition-colors"><Users className="w-5 h-5 text-gray-500" /></button>
            <button onClick={() => navigate(`/auctions/${id}/players`)} title="Players" className="p-2.5 hover:bg-white/5 rounded-xl transition-colors"><User className="w-5 h-5 text-gray-500" /></button>
            <button onClick={() => navigate(`/auctions/${id}/history`)} title="History" className="p-2.5 hover:bg-white/5 rounded-xl transition-colors"><History className="w-5 h-5 text-gray-500" /></button>
            <button onClick={() => navigate(`/auctions/${id}/stats`)} title="Stats" className="p-2.5 hover:bg-white/5 rounded-xl transition-colors"><BarChart3 className="w-5 h-5 text-gray-500" /></button>
            <button title="Categories" className="p-2.5 hover:bg-white/5 rounded-xl transition-colors"><Tags className="w-5 h-5 text-gray-500" /></button>
            <button onClick={() => setEditMode(!editMode)} title="Edit" className="p-2.5 hover:bg-white/5 rounded-xl transition-colors"><Pencil className="w-5 h-5 text-gray-500" /></button>
            <button onClick={handleDelete} title="Delete" className="p-2.5 hover:bg-rose-500/10 rounded-xl transition-colors"><Trash2 className="w-5 h-5 text-rose-400" /></button>
            <button onClick={handleDeactivate} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-accent-gold' : 'bg-surface-4'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Mode */}
      {editMode && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl border border-accent-gold/20 p-6 mb-6">
          <h3 className="font-bold text-white mb-4">Edit Auction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Budget per Team</label>
              <input type="number" value={editForm.budget_per_team} onChange={e => setEditForm({ ...editForm, budget_per_team: Number(e.target.value) })}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Base Bid</label>
              <input type="number" value={editForm.base_bid} onChange={e => setEditForm({ ...editForm, base_bid: Number(e.target.value) })}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Timer (seconds)</label>
              <input type="number" value={editForm.timer_seconds} onChange={e => setEditForm({ ...editForm, timer_seconds: Number(e.target.value) })}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Min Players</label>
              <input type="number" value={editForm.min_players} onChange={e => setEditForm({ ...editForm, min_players: Number(e.target.value) })}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Max Players</label>
              <input type="number" value={editForm.max_players} onChange={e => setEditForm({ ...editForm, max_players: Number(e.target.value) })}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5">Cancel</button>
            <motion.button onClick={handleSave} disabled={saving} whileTap={{ scale: 0.97 }} className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-gold to-amber-500 text-black font-bold disabled:from-gray-600 disabled:to-gray-600">{saving ? 'Saving...' : 'Save'}</motion.button>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Budget per Team', value: formatPrice(auction.budget_per_team) },
          { label: 'Base Bid', value: formatPrice(auction.base_bid) },
          { label: 'Timer', value: (auction.timer_mode || 'auto') === 'off' ? 'Off' : `${auction.timer_seconds}s (${auction.timer_mode || 'auto'})` },
          { label: 'Players', value: `${auction.min_players}–${auction.max_players}` },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-strong rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Sharing Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Public View Link', url: `${window.location.origin}/auction/${id}` },
          { label: 'Overlay Link', url: `${window.location.origin}/overlay/${id}` },
        ].map((link) => (
          <div key={link.label} className="glass-strong rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-300">{link.label}</p>
              <button onClick={() => copyLink(link.url)} className="text-accent-gold hover:text-amber-300 transition-colors"><Copy className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-600 font-mono truncate">{link.url}</p>
          </div>
        ))}
      </div>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="font-bold text-white mb-4">Registration</h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Player Self Registration</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-surface-3 rounded-full peer peer-checked:bg-accent-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-6">
          <h3 className="font-bold text-white mb-4">Dynamic Rules</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Timer className="w-4 h-4 text-gray-500" /><p className="text-sm text-gray-400">Timer</p></div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium border ${(auction.timer_mode || 'auto') === 'off' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>{(auction.timer_mode || 'auto') === 'off' ? 'OFF' : `${(auction.timer_mode || 'auto').toUpperCase()} (${auction.timer_seconds}s)`}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-gray-500" /><p className="text-sm text-gray-400">Bid Increments</p></div>
              <button onClick={() => navigate(`/auctions/${id}/settings`)} className="text-xs text-accent-gold hover:text-amber-300">Configure</button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-700 to-indigo-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%20256%20256%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cfilter%20id%3D%27n%27%3E%3CfeTurbulence%20type%3D%27fractalNoise%27%20baseFrequency%3D%270.9%27%20numOctaves%3D%274%27%20stitchTiles%3D%27stitch%27%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20filter%3D%27url(%23n)%27%20opacity%3D%270.03%27%2F%3E%3C%2Fsvg%3E')] opacity-50 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3"><Palette className="w-6 h-6" /><h3 className="font-bold text-white">Customize your Auction Theme</h3></div>
            <p className="text-purple-200 text-sm mb-4">Choose colors, fonts, and branding for your live auction room.</p>
            <button className="bg-white text-purple-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-50 transition-colors">Customize Theme</button>
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-6">
          <h3 className="font-bold text-white mb-4">Data Transfer</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 rounded-xl border border-white/5 bg-surface-2/50 hover:bg-surface-3/50 transition-colors text-sm text-gray-400">Copy players from another auction</button>
            <button className="w-full text-left px-4 py-3 rounded-xl border border-white/5 bg-surface-2/50 hover:bg-surface-3/50 transition-colors text-sm text-gray-400">Copy teams from another auction</button>
          </div>
        </div>
      </div>

      {/* Go Live Button */}
      {(auction.status === 'waiting' || auction.status === 'paused') && (
        <div className="mt-6">
          <motion.button
            onClick={() => navigate(`/auctions/${id}/live`)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Link className="w-5 h-5" /> Go to Live Auction
          </motion.button>
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
