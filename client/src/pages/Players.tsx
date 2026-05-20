import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Plus, Pencil, Trash2, X, Search, Filter, UserCheck, UserX, Clock, ArrowLeft
} from 'lucide-react'
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from '../api'

const roles = ['all', 'batsman', 'bowler', 'allrounder', 'wicketkeeper']
const statuses = ['all', 'unsold', 'sold', 'pending']

const roleBadge: Record<string, string> = {
  batsman: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bowler: 'bg-red-500/20 text-red-400 border-red-500/30',
  allrounder: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  wicketkeeper: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const statusBadge: Record<string, string> = {
  sold: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  unsold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const StatusIcon: Record<string, any> = {
  unsold: UserX,
  sold: UserCheck,
  pending: Clock,
}

const roleLabel = (r: string) => {
  const map: Record<string, string> = { batsman: 'BAT', bowler: 'BOWL', allrounder: 'AR', wicketkeeper: 'WK' }
  return map[r] || r.toUpperCase()
}

const emptyForm = {
  name: '', role: 'batsman', country: 'India', base_price: 1000000, image_url: '',
  matches: 0, runs: 0, wickets: 0, batting_avg: 0, batting_sr: 0, bowling_avg: 0, bowling_econ: 0
}

export default function Players() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const aid = Number(auctionId)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPlayers() }, [auctionId, roleFilter, statusFilter])

  const fetchPlayers = async () => {
    try {
      const params: any = {}
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await getPlayers(aid, params)
      setPlayers(data.players || data)
    } catch { /* */ }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Player name is required'); return }
    setSaving(true); setError('')
    try {
      if (editId) {
        await updatePlayer(editId, form)
      } else {
        await createPlayer({ auction_id: aid, ...form })
      }
      handleCancel()
      fetchPlayers()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleEdit = (player: any) => {
    setEditId(player.id)
    setForm({
      name: player.name, role: player.role, country: player.country,
      base_price: player.base_price, image_url: player.image_url || '',
      matches: player.matches || 0, runs: player.runs || 0, wickets: player.wickets || 0,
      batting_avg: player.batting_avg || 0, batting_sr: player.batting_sr || 0,
      bowling_avg: player.bowling_avg || 0, bowling_econ: player.bowling_econ || 0
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this player?')) return
    try { await deletePlayer(id); fetchPlayers() } catch { alert('Delete failed') }
  }

  const handleCancel = () => {
    setShowForm(false); setEditId(null); setError('')
    setForm({ ...emptyForm })
  }

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
    return `₹${val.toLocaleString()}`
  }

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.country.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="p-12 text-gray-500 text-center animate-fade-in">Loading players...</div>
  )

  return (
    <div className="animate-fade-in relative noise-bg">
      <div className="relative z-10">
        {/* Breadcrumb */}
        <nav className="text-xs mb-6 flex items-center gap-2 tracking-wider">
          <span
            className="text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
            onClick={() => navigate('/auctions')}
          >
            HOME
          </span>
          <span className="text-gray-600">›</span>
          <span
            className="text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
            onClick={() => navigate('/auctions')}
          >
            AUCTIONS
          </span>
          <span className="text-gray-600">›</span>
          <span className="text-accent-gold font-medium">PLAYERS</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/auctions/${aid}`)}
              className="p-2 rounded-lg bg-surface-2/80 border border-white/5 text-gray-400 hover:text-white hover:border-white/15 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-display gradient-text tracking-wide">PLAYER MANAGEMENT</h1>
              <p className="text-sm text-gray-500 mt-1">{filtered.length} players in this auction</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...emptyForm }) }}
            className="flex items-center gap-2 bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold px-5 py-2.5 rounded-xl font-medium transition-colors border border-accent-gold/20"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </motion.button>
        </div>

        {/* Add/Edit Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="glass-strong rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display text-xl gradient-text tracking-wide">
                    {editId ? 'EDIT PLAYER' : 'NEW PLAYER'}
                  </h3>
                  <button
                    onClick={handleCancel}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-5"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Basic Info Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Virat Kohli"
                        className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Role</label>
                      <select
                        value={form.role}
                        onChange={e => setForm({ ...form, role: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm appearance-none cursor-pointer"
                      >
                        {roles.filter(r => r !== 'all').map(r => (
                          <option key={r} value={r} className="bg-surface-2 text-white">
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Country</label>
                      <input
                        type="text"
                        value={form.country}
                        onChange={e => setForm({ ...form, country: e.target.value })}
                        placeholder="e.g. India"
                        className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Base Price</label>
                      <input
                        type="number"
                        value={form.base_price}
                        onChange={e => setForm({ ...form, base_price: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm"
                      />
                      <p className="text-xs text-accent-gold/70 mt-1 font-mono">{formatPrice(form.base_price)}</p>
                    </div>
                  </div>

                  {/* Image URL */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Image URL</label>
                    <input
                      type="text"
                      value={form.image_url}
                      onChange={e => setForm({ ...form, image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm"
                    />
                  </div>

                  {/* Cricket Stats */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-8 h-px bg-white/10" />
                      Cricket Stats
                      <span className="flex-1 h-px bg-white/5" />
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Matches</label>
                        <input type="number" value={form.matches} onChange={e => setForm({ ...form, matches: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Runs</label>
                        <input type="number" value={form.runs} onChange={e => setForm({ ...form, runs: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Wickets</label>
                        <input type="number" value={form.wickets} onChange={e => setForm({ ...form, wickets: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Bat Avg</label>
                        <input type="number" step="0.1" value={form.batting_avg} onChange={e => setForm({ ...form, batting_avg: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Bat SR</label>
                        <input type="number" step="0.1" value={form.batting_sr} onChange={e => setForm({ ...form, batting_sr: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Bowl Avg</label>
                        <input type="number" step="0.1" value={form.bowling_avg} onChange={e => setForm({ ...form, bowling_avg: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Econ</label>
                        <input type="number" step="0.1" value={form.bowling_econ} onChange={e => setForm({ ...form, bowling_econ: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={saving}
                      className="px-8 py-2.5 rounded-xl bg-accent-gold/20 hover:bg-accent-gold/30 text-accent-gold font-medium border border-accent-gold/20 disabled:opacity-40 transition-all"
                    >
                      {saving ? 'Saving...' : editId ? 'Update Player' : 'Add Player'}
                    </motion.button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 font-medium transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="glass-strong rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or country..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all appearance-none cursor-pointer"
              >
                {roles.map(r => (
                  <option key={r} value={r} className="bg-surface-2 text-white">
                    {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white text-sm focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all appearance-none cursor-pointer"
            >
              {statuses.map(s => (
                <option key={s} value={s} className="bg-surface-2 text-white">
                  {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 font-mono bg-surface-2/80 px-3 py-1.5 rounded-lg border border-white/5">
              {filtered.length} players
            </span>
          </div>
        </div>

        {/* Player Table */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-5">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 mb-5">No players found. Add some or adjust filters.</p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm(true)}
              className="bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold px-6 py-2.5 rounded-xl font-medium transition-colors border border-accent-gold/20"
            >
              Add Player
            </motion.button>
          </motion.div>
        ) : (
          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Player</th>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Role</th>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Country</th>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Base Price</th>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Stats</th>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Status</th>
                    <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((player, i) => {
                      const SIcon = StatusIcon[player.status] || User
                      return (
                        <motion.tr
                          key={player.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.25, delay: i * 0.03 }}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center text-sm font-bold text-accent-gold/80 border border-white/5 shrink-0">
                                {player.name[0]}
                              </div>
                              <div>
                                <span className="font-medium text-white text-sm">{player.name}</span>
                                {player.image_url && (
                                  <span className="block text-[10px] text-gray-600 mt-0.5">Has image</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border ${roleBadge[player.role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                              {roleLabel(player.role)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-400">{player.country}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-mono text-white">{formatPrice(player.base_price)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                              <span>{player.matches || 0}M</span>
                              <span>{player.runs || 0}R</span>
                              <span>{player.wickets || 0}W</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1.5 w-fit ${statusBadge[player.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                              <SIcon className="w-3 h-3" />
                              {player.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEdit(player)}
                                className="p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-accent-gold transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDelete(player.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
