import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  ArrowLeft, X
} from 'lucide-react'
import { getTeams, getTeam, createTeam, updateTeam, deleteTeam } from '../api'

export default function Teams() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', short_name: '', total_budget: 100000000, max_players: 18, logo_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [teamRosters, setTeamRosters] = useState<Record<number, any[]>>({})

  const aid = Number(auctionId)

  useEffect(() => { fetchTeams() }, [auctionId])

  const fetchTeams = async () => {
    try { const data = await getTeams(aid); setTeams(data) } catch { /* */ }
    setLoading(false)
  }

  const loadRoster = async (teamId: number) => {
    if (teamRosters[teamId]) return
    try {
      const data = await getTeam(teamId)
      setTeamRosters(prev => ({ ...prev, [teamId]: data.players || [] }))
    } catch { /* */ }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Team name is required'); return }
    setSaving(true); setError('')
    try {
      if (editId) {
        await updateTeam(editId, { name: form.name, short_name: form.short_name, total_budget: form.total_budget, max_players: form.max_players, logo_url: form.logo_url })
      } else {
        await createTeam({ auction_id: aid, name: form.name, short_name: form.short_name, total_budget: form.total_budget, max_players: form.max_players, logo_url: form.logo_url })
      }
      handleCancel()
      fetchTeams()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleEdit = (team: any) => {
    setEditId(team.id)
    setForm({ name: team.name, short_name: team.short_name || '', total_budget: team.total_budget, max_players: team.max_players, logo_url: team.logo_url || '' })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this team?')) return
    try { await deleteTeam(id); fetchTeams() } catch { alert('Delete failed') }
  }

  const handleCancel = () => {
    setShowForm(false); setEditId(null); setError('')
    setForm({ name: '', short_name: '', total_budget: 100000000, max_players: 18, logo_url: '' })
  }

  const toggleExpand = (teamId: number) => {
    if (expandedId === teamId) { setExpandedId(null) }
    else { setExpandedId(teamId); loadRoster(teamId) }
  }

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(1)} Cr`
    if (val >= 100000) return `${(val / 100000).toFixed(1)} L`
    return val.toLocaleString()
  }

  const budgetPct = (team: any) =>
    team.total_budget > 0 ? Math.round(((team.total_budget - team.remaining_budget) / team.total_budget) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="animate-fade-in relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent-gold/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-2 relative z-10">
        <span className="text-gray-500">HOME</span>
        <span className="mx-2 text-gray-600">›</span>
        <span
          className="text-gray-400 cursor-pointer hover:text-accent-gold transition-colors"
          onClick={() => navigate('/auctions')}
        >
          AUCTIONS
        </span>
        <span className="mx-2 text-gray-600">›</span>
        <span className="text-accent-gold font-medium">TEAMS</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => navigate(`/auctions/${aid}`)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-xl glass-strong flex items-center justify-center text-gray-400 hover:text-accent-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <h1 className="font-display text-4xl tracking-wide gradient-text">TEAM MANAGEMENT</h1>
        </div>
        <motion.button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', short_name: '', total_budget: 100000000, max_players: 18, logo_url: '' }) }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </motion.button>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            className="glass-strong rounded-2xl p-6 mb-8 border-white/5 relative z-10"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-2xl tracking-wide text-white">
                {editId ? 'EDIT TEAM' : 'NEW TEAM'}
              </h3>
              <button
                onClick={handleCancel}
                className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-400 hover:text-accent-rose transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent-rose/10 border border-accent-rose/20 text-accent-rose p-3 rounded-xl text-sm mb-5"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block font-medium">Team Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mumbai Indians"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block font-medium">Short Name</label>
                <input
                  type="text"
                  value={form.short_name}
                  onChange={e => setForm({ ...form, short_name: e.target.value.toUpperCase() })}
                  placeholder="e.g. MI"
                  maxLength={5}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block font-medium">Total Budget</label>
                <input
                  type="number"
                  value={form.total_budget}
                  onChange={e => setForm({ ...form, total_budget: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 outline-none transition-all"
                />
                <p className="text-xs text-accent-gold mt-1.5 font-medium">{formatPrice(form.total_budget)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block font-medium">Max Players</label>
                <input
                  type="number"
                  value={form.max_players}
                  onChange={e => setForm({ ...form, max_players: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block font-medium">Logo URL</label>
                <input
                  type="text"
                  value={form.logo_url}
                  onChange={e => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 outline-none transition-all"
                />
              </div>
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-xl glass text-gray-400 hover:text-white transition-colors font-medium"
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {saving ? 'Saving...' : editId ? 'Update' : 'Add Team'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team Cards */}
      {teams.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-16 text-center border-white/5"
        >
          <div className="w-16 h-16 rounded-2xl bg-surface-3 flex items-center justify-center mx-auto mb-5">
            <Users className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 mb-6 text-lg">No teams yet. Add your first team to get started.</p>
          <motion.button
            onClick={() => setShowForm(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Team
          </motion.button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {teams.map((team, index) => {
            const pct = budgetPct(team)
            const isExpanded = expandedId === team.id
            const roster = teamRosters[team.id] || []
            const spent = team.total_budget - team.remaining_budget
            const hasLogo = team.logo_url && team.logo_url.trim() !== ''

            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                className="glass-strong rounded-2xl border-white/5 overflow-hidden group"
              >
                <div className="p-6">
                  {/* Team header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      {hasLogo ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                              ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                          <div className="hidden w-full h-full bg-gradient-to-br from-accent-gold/30 to-primary-600/30 flex items-center justify-center">
                            <span className="font-display text-lg text-accent-gold">
                              {(team.short_name || team.name)[0]}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-gold/20 to-primary-600/20 border border-accent-gold/20 flex items-center justify-center shadow-lg">
                          <span className="font-display text-xl text-accent-gold">
                            {(team.short_name || team.name)[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{team.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {team.short_name && (
                            <span className="text-xs font-mono text-accent-gold/80 bg-accent-gold/10 px-1.5 py-0.5 rounded">
                              {team.short_name}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{roster.length} players</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => handleEdit(team)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-500 hover:text-primary-400 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(team.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-500 hover:text-accent-rose transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        onClick={() => toggleExpand(team.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-500 hover:text-accent-gold transition-colors ml-1"
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.div>
                      </motion.button>
                    </div>
                  </div>

                  {/* Budget bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-400">
                        Spent: <span className="text-accent-gold font-medium">{formatPrice(spent)}</span>
                      </span>
                      <span className="text-gray-500">
                        Remaining: <span className="text-emerald-400 font-medium">{formatPrice(team.remaining_budget)}</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-surface-4 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1], delay: index * 0.06 + 0.2 }}
                        className={`h-full rounded-full ${
                          pct > 90
                            ? 'bg-gradient-to-r from-rose-600 to-rose-500'
                            : pct > 70
                            ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                            : 'bg-gradient-to-r from-accent-gold to-emerald-400'
                        }`}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-gray-600">Budget: {formatPrice(team.total_budget)}</span>
                      <span className={`text-[10px] font-mono font-semibold ${
                        pct > 90 ? 'text-rose-400' : pct > 70 ? 'text-amber-400' : 'text-accent-gold'
                      }`}>
                        {pct}% used
                      </span>
                    </div>
                  </div>

                  {/* Footer stats */}
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Max: {team.max_players} players</span>
                    <span>{roster.length}/{team.max_players} roster</span>
                  </div>
                </div>

                {/* Roster expand */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 bg-surface-1/50 p-5">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" />
                          Roster
                        </h4>
                        {roster.length === 0 ? (
                          <p className="text-xs text-gray-600 py-2">No players bought yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {roster.map((p: any, i: number) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-2/60 border border-white/[0.03] group/row hover:border-accent-gold/10 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-600/30 to-primary-500/20 flex items-center justify-center border border-primary-500/20">
                                    <span className="text-xs font-bold text-primary-400">
                                      {p.name[0]}
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-300 font-medium">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {p.role && (
                                    <span className="text-xs text-gray-500 bg-surface-3 px-2 py-0.5 rounded-md">
                                      {p.role}
                                    </span>
                                  )}
                                  <span className="text-sm text-accent-gold font-semibold font-mono">
                                    {formatPrice(p.bought_price)}
                                  </span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
