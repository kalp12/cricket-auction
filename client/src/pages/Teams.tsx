import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  const [form, setForm] = useState({ name: '', short_name: '', total_budget: 100000000, max_players: 18 })
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
        await updateTeam(editId, { name: form.name, short_name: form.short_name, total_budget: form.total_budget, max_players: form.max_players })
      } else {
        await createTeam({ auction_id: aid, name: form.name, short_name: form.short_name, total_budget: form.total_budget, max_players: form.max_players })
      }
      handleCancel()
      fetchTeams()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleEdit = (team: any) => {
    setEditId(team.id)
    setForm({ name: team.name, short_name: team.short_name || '', total_budget: team.total_budget, max_players: team.max_players })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this team?')) return
    try { await deleteTeam(id); fetchTeams() } catch { alert('Delete failed') }
  }

  const handleCancel = () => {
    setShowForm(false); setEditId(null); setError('')
    setForm({ name: '', short_name: '', total_budget: 100000000, max_players: 18 })
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

  if (loading) return <div className="p-12 text-gray-400 text-center">Loading teams...</div>

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">TEAMS</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/auctions/${aid}`)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Team Management</h1>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', short_name: '', total_budget: 100000000, max_players: 18 }) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{editId ? 'Edit Team' : 'Add Team'}</h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Team Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mumbai Indians"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Short Name</label>
              <input type="text" value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value.toUpperCase() })}
                placeholder="e.g. MI" maxLength={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Total Budget (₹)</label>
              <input type="number" value={form.total_budget} onChange={e => setForm({ ...form, total_budget: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
              <p className="text-xs text-gray-400 mt-1">{formatPrice(form.total_budget)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Max Players</label>
              <input type="number" value={form.max_players} onChange={e => setForm({ ...form, max_players: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </form>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={handleCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400">
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Team'}
            </button>
          </div>
        </div>
      )}

      {/* Team Cards */}
      {teams.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No teams yet. Add your first team to get started.</p>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            Add Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map(team => {
            const pct = budgetPct(team)
            const isExpanded = expandedId === team.id
            const roster = teamRosters[team.id] || []
            const spent = team.total_budget - team.remaining_budget

            return (
              <div key={team.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-blue-600 text-sm">{team.short_name || team.name[0]}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{team.name}</h3>
                        <p className="text-xs text-gray-400">{roster.length} players</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(team)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <Pencil className="w-4 h-4 text-gray-400" />
                      </button>
                      <button onClick={() => handleDelete(team.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                      <button onClick={() => toggleExpand(team.id)} className="p-1.5 hover:bg-gray-100 rounded-lg ml-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Spent: ₹{formatPrice(spent)}</span>
                      <span className="text-gray-500">Remaining: ₹{formatPrice(team.remaining_budget)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Budget: ₹{formatPrice(team.total_budget)}</span>
                    <span>Max: {team.max_players} players</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Roster</h4>
                    {roster.length === 0 ? (
                      <p className="text-xs text-gray-400">No players bought yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {roster.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm py-1 px-2 bg-white rounded">
                            <span className="text-gray-700">{p.name}</span>
                            <span className="text-gray-500">{p.role} · ₹{formatPrice(p.bought_price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
