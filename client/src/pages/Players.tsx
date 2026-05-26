import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Plus, Pencil, Trash2, X, Search, Filter, UserCheck, UserX, Clock, ArrowLeft, FileSpreadsheet, ClipboardList, TrendingUp, Check, XCircle, QrCode, Link, Mail
} from 'lucide-react'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import ConfirmModal from '../components/ConfirmModal'
import { useConfirm } from '../hooks/useConfirm'
import { Button, Card, Input, RoleBadge, StatusBadge, EmptyState, ExportMenu, SkeletonTable } from '../components/ui'
import { getPlayers, createPlayer, updatePlayer, deletePlayer, listRegistrations, approveRegistration, rejectRegistration, toggleRegistration, getAuction, exportPlayers } from '../api'

const roles = ['all', 'batsman', 'bowler', 'allrounder', 'wicketkeeper']
const statuses = ['all', 'unsold', 'sold', 'pending']

const StatusIcon: Record<string, any> = {
  unsold: UserX,
  sold: UserCheck,
  pending: Clock,
}

const emptyForm = {
  name: '', role: 'batsman', country: 'India', base_price: 1000000, image_url: '',
  matches: 0, runs: 0, wickets: 0, batting_avg: 0, batting_sr: 0, bowling_avg: 0, bowling_econ: 0,
  previous_team_id: '' as string | number
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
  const { confirmState, confirm, cancel } = useConfirm()
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'players' | 'registrations'>('players')
  const [registrations, setRegistrations] = useState<any[]>([])
  const [regOpen, setRegOpen] = useState(false)
  const [showQR, setShowQR] = useState(false)

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
    } catch (e: any) {
      if (e?.response?.status === 401) { localStorage.removeItem('token'); navigate('/login') }
      else { toast.error('Failed to load players') }
    }
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
      handleCancel(); toast.success(editId ? 'Player updated' : 'Player added')
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
      bowling_avg: player.bowling_avg || 0, bowling_econ: player.bowling_econ || 0,
    previous_team_id: player.previous_team_id || ""
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!(await confirm({ title: 'Delete Player', message: 'This player will be permanently removed.', confirmLabel: 'Delete', danger: true }))) return
    try { await deletePlayer(id); toast.success('Player deleted'); fetchPlayers() } catch { toast.error('Delete failed') }
  }

  const handleCancel = () => {
    setShowForm(false); setEditId(null); setError('')
    setForm({ ...emptyForm })
  }

  // ── Registration handlers ──
  const fetchRegistrations = async () => {
    try {
      const data = await listRegistrations(aid)
      setRegistrations(data)
    } catch (e: any) {
      if (e?.response?.status === 401) { localStorage.removeItem('token'); navigate('/login') }
      else { toast.error('Failed to load registrations') }
    }
  }

  const fetchRegStatus = async () => {
    try {
      const auction = await getAuction(aid)
      setRegOpen(!!auction.registration_open)
    } catch (e: any) {
      if (e?.response?.status === 401) { localStorage.removeItem('token'); navigate('/login') }
      else { toast.error('Failed to load registration status') }
    }
  }

  useEffect(() => { if (tab === 'registrations') { fetchRegistrations(); fetchRegStatus() } }, [tab])

  const handleToggleReg = async () => {
    try {
      const data = await toggleRegistration(aid)
      setRegOpen(data.registration_open)
      toast.success(data.registration_open ? 'Registration opened' : 'Registration closed')
    } catch { toast.error('Failed to toggle') }
  }

  const handleApprove = async (id: number) => {
    try {
      await approveRegistration(id)
      toast.success('Registration approved')
      fetchRegistrations()
      fetchPlayers()
    } catch { toast.error('Approval failed') }
  }

  const handleReject = async (id: number) => {
    try {
      await rejectRegistration(id)
      toast.success('Registration rejected')
      fetchRegistrations()
    } catch { toast.error('Rejection failed') }
  }

  const regLink = `${window.location.origin}/register/${aid}`

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
    <div className="p-6 space-y-6 animate-fade-in"><SkeletonTable rows={6} cols={6} /></div>
  )

  const selectCls = 'w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all text-sm appearance-none cursor-pointer'

  return (
    <>
    <div className="animate-fade-in relative noise-bg">
    <div className="relative z-10">
      <nav className="text-xs mb-6 flex items-center gap-2 tracking-wider">
        <span className="text-gray-500 hover:text-gray-300 cursor-pointer transition-colors" onClick={() => navigate('/auctions')}>HOME</span>
        <span className="text-gray-600">›</span>
        <span className="text-gray-500 hover:text-gray-300 cursor-pointer transition-colors" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="text-gray-600">›</span>
        <span className="text-accent-gold font-medium">PLAYERS</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="md" icon={<ArrowLeft className="w-5 h-5" />} onClick={() => navigate(`/auctions/${aid}`)} className="w-10 h-10 !px-0 !py-0" />
          <div>
            <h1 className="text-3xl md:text-4xl font-display gradient-text tracking-wide">PLAYER MANAGEMENT</h1>
            <p className="text-sm text-gray-500 mt-1">{filtered.length} players in this auction</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="gold" icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => navigate("/auctions/" + aid + "/players/import")}
            className="bg-surface-3 hover:bg-surface-4 text-white/60 !shadow-none border border-white/5">Import</Button>
                  <Button variant="gold" icon={<TrendingUp className="w-4 h-4" />} onClick={() => navigate("/auctions/" + aid + "/players/stats-import")}
                    className="bg-surface-3 hover:bg-surface-4 text-white/60 !shadow-none border border-white/5">Stats Import</Button>
                  <ExportMenu
                    options={[
                      { label: 'Players', onClick: async (format) => { const blob = await exportPlayers(aid, format); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `players.${format}`; a.click(); window.URL.revokeObjectURL(url) } },
                    ]}
                  />
          {tab === 'players' && (
            <Button variant="gold" icon={<Plus className="w-4 h-4" />} onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...emptyForm }) }}
              className="bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold !shadow-none border border-accent-gold/20">Add Player</Button>
          )}
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setTab('players')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'players' ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/20' : 'bg-surface-2 text-gray-400 border border-white/5 hover:bg-surface-3'}`}>
          <User className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />Players
        </button>
        <button onClick={() => setTab('registrations')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all relative ${tab === 'registrations' ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/20' : 'bg-surface-2 text-gray-400 border border-white/5 hover:bg-surface-3'}`}>
          <ClipboardList className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />Registrations
          {registrations.filter(r => r.status === 'pending').length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {registrations.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {tab === 'registrations' ? (
        /* ── Registrations Panel ── */
        <div className="space-y-6">
          <Card padding="sm" className="flex flex-wrap items-center gap-4">
            <Button
              variant="gold"
              onClick={handleToggleReg}
              className={`${regOpen ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border-rose-500/20'} !shadow-none border`}
              icon={regOpen ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            >
              {regOpen ? 'Open' : 'Closed'}
            </Button>

            <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2 border border-white/5 text-sm text-gray-400 flex-1 min-w-[200px]">
              <Link className="w-4 h-4 shrink-0" />
              <span className="truncate font-mono text-xs">{regLink}</span>
              <button onClick={() => { navigator.clipboard.writeText(regLink); toast.success('Link copied!') }}
                className="ml-auto shrink-0 text-accent-gold hover:text-amber-400 transition-colors text-xs font-medium">Copy</button>
            </div>

            <Button variant="ghost" size="sm" icon={<QrCode className="w-4 h-4" />} onClick={() => setShowQR(!showQR)}
              className="text-gray-400 hover:text-accent-gold">QR</Button>
          </Card>

          {showQR && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="flex flex-col items-center py-8">
                <QRCodeSVG value={regLink} size={180} bgColor="transparent" fgColor="#fbbf24" level="H" />
                <p className="text-xs text-gray-500 mt-3 font-mono">{regLink}</p>
              </Card>
            </motion.div>
          )}

          {registrations.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No registrations yet" message="Share the registration link to let players sign up." />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Name</th>
                      <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Role</th>
                      <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Country</th>
                      <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Base Price</th>
<th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Email</th>
                      <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Status</th>
                      <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-widest px-5 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg: any) => (
                      <tr key={reg.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3.5 text-sm text-white font-medium">{reg.name}</td>
                        <td className="px-5 py-3.5"><RoleBadge role={reg.role} /></td>
                        <td className="px-5 py-3.5 text-sm text-gray-400">{reg.country}</td>
                        <td className="px-5 py-3.5 text-sm font-mono text-white">{formatPrice(reg.base_price)}</td>
<td className="px-5 py-3.5 text-sm text-gray-400">{reg.email ? <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-gray-600" />{reg.email}</span> : <span className="text-gray-600">—</span>}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                            reg.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                            reg.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                            'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          }`}>
                            {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {reg.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" icon={<Check className="w-4 h-4" />} onClick={() => handleApprove(reg.id)}
                                className="w-8 h-8 !px-0 !py-0 hover:!text-emerald-400 hover:!bg-emerald-500/10" />
                              <Button variant="ghost" size="sm" icon={<XCircle className="w-4 h-4" />} onClick={() => handleReject(reg.id)}
                                className="w-8 h-8 !px-0 !py-0 hover:!text-rose-400 hover:!bg-rose-500/10" />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <>
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <Card>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-display text-xl gradient-text tracking-wide">
                      {editId ? 'EDIT PLAYER' : 'NEW PLAYER'}
                    </h3>
                    <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-5">{error}</motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Input label="Name *" placeholder="e.g. Virat Kohli" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                      <div>
                        <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Role</label>
                        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={selectCls}>
                          {roles.filter(r => r !== 'all').map(r => (
                            <option key={r} value={r} className="bg-surface-2 text-white">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <Input label="Country" placeholder="e.g. India" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                      <Input label="Base Price" type="number" value={form.base_price} onChange={e => setForm({ ...form, base_price: Number(e.target.value) })} hint={formatPrice(form.base_price)} />
                    </div>

                    <Input label="Image URL" placeholder="https://..." value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />

                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-8 h-px bg-white/10" /> Cricket Stats <span className="flex-1 h-px bg-white/5" />
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <Input label="Matches" labelClassName="text-[10px] text-gray-500" type="number" value={form.matches} onChange={e => setForm({ ...form, matches: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                        <Input label="Runs" labelClassName="text-[10px] text-gray-500" type="number" value={form.runs} onChange={e => setForm({ ...form, runs: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                        <Input label="Wickets" labelClassName="text-[10px] text-gray-500" type="number" value={form.wickets} onChange={e => setForm({ ...form, wickets: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                        <Input label="Bat Avg" labelClassName="text-[10px] text-gray-500" type="number" step="0.1" value={form.batting_avg} onChange={e => setForm({ ...form, batting_avg: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                        <Input label="Bat SR" labelClassName="text-[10px] text-gray-500" type="number" step="0.1" value={form.batting_sr} onChange={e => setForm({ ...form, batting_sr: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                        <Input label="Bowl Avg" labelClassName="text-[10px] text-gray-500" type="number" step="0.1" value={form.bowling_avg} onChange={e => setForm({ ...form, bowling_avg: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                        <Input label="Econ" labelClassName="text-[10px] text-gray-500" type="number" step="0.1" value={form.bowling_econ} onChange={e => setForm({ ...form, bowling_econ: Number(e.target.value) })} className="!px-3 !py-2 !rounded-lg" />
                      </div>
                    </div>

                    <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-8 h-px bg-white/10" /> RTM (Right to Match) <span className="flex-1 h-px bg-white/5" />
        </p>
        <Input label="Previous Team ID" labelClassName="text-[10px] text-gray-500" type="number" placeholder="Leave blank if none" value={form.previous_team_id} onChange={e => setForm({ ...form, previous_team_id: e.target.value ? Number(e.target.value) : '' })} className="!px-3 !py-2 !rounded-lg" />
        <p className="text-[10px] text-gray-600 mt-1">Set to the team ID that previously owned this player (for RTM eligibility).</p>
      </div>

      <div className="flex items-center gap-3 pt-2">
                      <Button variant="gold" type="submit" disabled={saving}
                        className="bg-accent-gold/20 hover:bg-accent-gold/30 !text-accent-gold border border-accent-gold/20 !shadow-none">
                        {saving ? 'Saving...' : editId ? 'Update Player' : 'Add Player'}
                      </Button>
                      <Button variant="ghost" type="button" onClick={handleCancel}>Cancel</Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Card padding="sm" className="mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[220px]">
                <Input icon={<Search className="w-4 h-4" />} placeholder="Search by name or country..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={selectCls}>
                  {roles.map(r => (
                    <option key={r} value={r} className="bg-surface-2 text-white">{r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                {statuses.map(s => (
                  <option key={s} value={s} className="bg-surface-2 text-white">{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500 font-mono bg-surface-2/80 px-3 py-1.5 rounded-lg border border-white/5">{filtered.length} players</span>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState
              icon={User}
              title="No players found"
              message="Add some players or adjust your filters."
              action={{ label: 'Add Player', onClick: () => setShowForm(true) }}
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
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
                                  {player.image_url && <span className="block text-[10px] text-gray-600 mt-0.5">Has image</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5"><RoleBadge role={player.role} /></td>
                            <td className="px-5 py-3.5 text-sm text-gray-400">{player.country}</td>
                            <td className="px-5 py-3.5"><span className="text-sm font-mono text-white">{formatPrice(player.base_price)}</span></td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                                <span>{player.matches || 0}M</span>
                                <span>{player.runs || 0}R</span>
                                <span>{player.wickets || 0}W</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusBadge status={player.status} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" icon={<Pencil className="w-4 h-4" />} onClick={() => handleEdit(player)} aria-label={`Edit ${player.name}`} className="w-8 h-8 !px-0 !py-0" />
                                <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(player.id)} aria-label={`Delete ${player.name}`} className="w-8 h-8 !px-0 !py-0 hover:!text-rose-400 hover:!bg-rose-500/10" />
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
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
