import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User, Plus, Pencil, Trash2, X, Search, Filter, UserCheck, UserX, Clock, ArrowLeft
} from 'lucide-react'
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from '../api'

const roles = ['all', 'batsman', 'bowler', 'allrounder', 'wicketkeeper']
const statuses = ['all', 'unsold', 'sold', 'pending']

const roleColors: Record<string, string> = {
  batsman: 'bg-blue-100 text-blue-700',
  bowler: 'bg-red-100 text-red-700',
  allrounder: 'bg-purple-100 text-purple-700',
  wicketkeeper: 'bg-green-100 text-green-700',
}

const statusColors: Record<string, string> = {
  unsold: 'bg-gray-100 text-gray-600',
  sold: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const StatusIcon: Record<string, any> = {
  unsold: UserX,
  sold: UserCheck,
  pending: Clock,
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
  const [form, setForm] = useState({ name: '', role: 'batsman', country: 'India', base_price: 1000000, image_url: '', matches: 0, runs: 0, wickets: 0, batting_avg: 0, batting_sr: 0, bowling_avg: 0, bowling_econ: 0 })
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
    setForm({ name: player.name, role: player.role, country: player.country, base_price: player.base_price, image_url: player.image_url || '', matches: player.matches || 0, runs: player.runs || 0, wickets: player.wickets || 0, batting_avg: player.batting_avg || 0, batting_sr: player.batting_sr || 0, bowling_avg: player.bowling_avg || 0, bowling_econ: player.bowling_econ || 0 })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this player?')) return
    try { await deletePlayer(id); fetchPlayers() } catch { alert('Delete failed') }
  }

  const handleCancel = () => {
    setShowForm(false); setEditId(null); setError('')
    setForm({ name: '', role: 'batsman', country: 'India', base_price: 1000000, image_url: '', matches: 0, runs: 0, wickets: 0, batting_avg: 0, batting_sr: 0, bowling_avg: 0, bowling_econ: 0 })
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

  if (loading) return <div className="p-12 text-gray-400 text-center">Loading players...</div>

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">PLAYERS</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/auctions/${aid}`)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Player Management</h1>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', role: 'batsman', country: 'India', base_price: 1000000, image_url: '', matches: 0, runs: 0, wickets: 0, batting_avg: 0, batting_sr: 0, bowling_avg: 0, bowling_econ: 0 }) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Player
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{editId ? 'Edit Player' : 'Add Player'}</h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Virat Kohli"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
                {roles.filter(r => r !== 'all').map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Country</label>
              <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. India"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Base Price (₹)</label>
              <input type="number" value={form.base_price} onChange={e => setForm({ ...form, base_price: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
              <p className="text-xs text-gray-400 mt-1">{formatPrice(form.base_price)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Image URL</label>
              <input type="text" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" disabled={saving}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 font-medium">
                {saving ? 'Saving...' : editId ? 'Update' : 'Add Player'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or country..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              {roles.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <span className="text-sm text-gray-500">{filtered.length} players</span>
        </div>
      </div>

      {/* Player Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No players found. Add some or adjust filters.</p>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            Add Player
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Player</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Country</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Base Price</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(player => {
                const SIcon = StatusIcon[player.status] || User
                return (
                  <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                          {player.name[0]}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{player.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[player.role] || 'bg-gray-100 text-gray-600'}`}>
                        {player.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{player.country}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-700">{formatPrice(player.base_price)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 w-fit ${statusColors[player.status] || 'bg-gray-100 text-gray-500'}`}>
                        <SIcon className="w-3 h-3" />
                        {player.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleEdit(player)} className="p-1.5 hover:bg-gray-100 rounded-lg mr-1">
                        <Pencil className="w-4 h-4 text-gray-400" />
                      </button>
                      <button onClick={() => handleDelete(player.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
