import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, RotateCcw, Save, Upload, Volume2, Image, Clock, ToggleLeft, ToggleRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuction, updateAuction, getSlabs, bulkCreateSlabs, createDefaultSlabs, uploadImage, uploadAudio, setRegistrationDeadline, updateRegistrationFormConfig, toggleRegistration, reauctionPlayers, assetUrl } from '../api'
import { SkeletonCard, SkeletonLine } from '../components/ui'

interface Slab {
  id: number
  auction_id: number
  min_price: number
  max_price: number
  increment: number
}

interface FieldConfig {
  visible: boolean
  required: boolean
}

interface FormConfig {
  [key: string]: FieldConfig
}

const DEFAULT_FORM_CONFIG: FormConfig = {
  name: { visible: true, required: true },
  role: { visible: true, required: true },
  country: { visible: true, required: true },
  base_price: { visible: true, required: true },
  image: { visible: true, required: false },
  email: { visible: true, required: false },
  matches: { visible: true, required: false },
  runs: { visible: true, required: false },
  wickets: { visible: true, required: false },
  batting_avg: { visible: true, required: false },
  batting_sr: { visible: true, required: false },
  bowling_avg: { visible: true, required: false },
  bowling_econ: { visible: true, required: false },
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Full Name',
  role: 'Role',
  country: 'Country',
  base_price: 'Base Price',
  image: 'Photo Upload',
  email: 'Email (for notifications)',
  matches: 'Matches',
  runs: 'Runs',
  wickets: 'Wickets',
  batting_avg: 'Batting Average',
  batting_sr: 'Batting Strike Rate',
  bowling_avg: 'Bowling Average',
  bowling_econ: 'Bowling Economy',
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const parsePrice = (val: string): number => {
  val = val.replace(/[^0-9.]/g, '').trim()
  return Number(val) || 0
}

const DEFAULT_SLABS = [
  { min_price: 0, max_price: 5000000, increment: 1000000 },
  { min_price: 5000000, max_price: 10000000, increment: 2500000 },
  { min_price: 10000000, max_price: 50000000, increment: 2500000 },
  { min_price: 50000000, max_price: 100000000, increment: 5000000 },
  { min_price: 100000000, max_price: 999999999, increment: 10000000 },
]

const SPONSOR_SLOTS = [
  { key: 'sponsor_tl', label: 'Top-Left' },
  { key: 'sponsor_tr', label: 'Top-Right' },
  { key: 'sponsor_bl', label: 'Bottom-Left' },
  { key: 'sponsor_br', label: 'Bottom-Right' },
  { key: 'sponsor_title', label: 'Title Sponsor' },
  { key: 'sponsor_player', label: 'Player Card' },
] as const

const OVERLAY_ASSET_SLOTS = [
  { key: 'overlay_bg', label: 'Background', accept: 'image/*' },
  { key: 'sold_stamp', label: 'SOLD Stamp', accept: 'image/*' },
  { key: 'unsold_stamp', label: 'UNSOLD Stamp', accept: 'image/*' },
  { key: 'lower_third_banner', label: 'Lower-Third Banner', accept: 'image/*' },
] as const

const SOUND_SLOTS = [
  { key: 'sound_gavel', label: 'Gavel Strike' },
  { key: 'sound_unsold', label: 'Unsold Buzzer' },
  { key: 'sound_timer', label: 'Timer Alarm' },
  { key: 'sound_celebration', label: 'Celebration' },
] as const

export default function Settings() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<any>(null)
  const [slabs, setSlabs] = useState<Slab[]>([])
  const [editSlabs, setEditSlabs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Registration settings
  const [regOpen, setRegOpen] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [formConfig, setFormConfig] = useState<FormConfig>({ ...DEFAULT_FORM_CONFIG })
  const [savingReg, setSavingReg] = useState(false)

  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      try {
        const [auctionData, slabsData] = await Promise.all([
          getAuction(Number(auctionId)), getSlabs(Number(auctionId)),
        ])
        setAuction(auctionData); setSlabs(slabsData)
        setEditSlabs(slabsData.length > 0
          ? slabsData.map((s: Slab) => ({ ...s }))
          : DEFAULT_SLABS.map(s => ({ ...s, auction_id: Number(auctionId) }))
        )
        // Load registration settings
        setRegOpen(!!auctionData.registration_open)
        if (auctionData.registration_deadline) {
          const d = new Date(auctionData.registration_deadline)
          // Format for datetime-local input
          const pad = (n: number) => String(n).padStart(2, '0')
          setDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
        }
        if (auctionData.registration_form_config) {
          try {
            const parsed = typeof auctionData.registration_form_config === 'string'
              ? JSON.parse(auctionData.registration_form_config)
              : auctionData.registration_form_config
            setFormConfig({ ...DEFAULT_FORM_CONFIG, ...parsed })
          } catch { /* use defaults */ }
        }
      } catch { navigate('/auctions') }
      finally { setLoading(false) }
    }
    fetchData()
  }, [auctionId, navigate])

  const handleAuctionUpdate = async (field: string, value: any) => {
    if (!auctionId) return
    try {
      const updated = await updateAuction(Number(auctionId), { [field]: value })
      setAuction(updated); setSaved(true); toast.success('Setting updated')
      setTimeout(() => setSaved(false), 2000)
    } catch { toast.error('Update failed') }
  }

  const updateEditSlab = (index: number, field: string, value: string) => {
    const updated = [...editSlabs]
    updated[index] = { ...updated[index], [field]: parsePrice(value) }
    setEditSlabs(updated)
  }

  const addSlab = () => {
    const lastSlab = editSlabs[editSlabs.length - 1]
    setEditSlabs([...editSlabs, {
      auction_id: Number(auctionId),
      min_price: lastSlab?.max_price || 0,
      max_price: (lastSlab?.max_price || 0) + 10000000,
      increment: 5000000,
    }])
  }

  const removeSlab = (index: number) => {
    setEditSlabs(editSlabs.filter((_, i) => i !== index))
  }

  const resetToDefaults = () => {
    setEditSlabs(DEFAULT_SLABS.map(s => ({ ...s, auction_id: Number(auctionId) })))
  }

  const saveSlabs = async () => {
    if (!auctionId) return
    setSaving(true)
    try {
      const slabsToSave = editSlabs.map(s => ({
        auction_id: Number(auctionId), min_price: s.min_price, max_price: s.max_price, increment: s.increment,
      }))
      const result = await bulkCreateSlabs(slabsToSave)
      setSlabs(result); setEditSlabs(result.map((s: Slab) => ({ ...s })))
      setSaved(true); toast.success('Slabs saved'); setTimeout(() => setSaved(false), 2000)
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save slabs') }
    finally { setSaving(false) }
  }

  const handleImageUpload = async (slotKey: string, file: File) => {
    if (!auctionId) return
    setUploadingSlot(slotKey)
    try {
      const imgRes = await uploadImage(file)
      const updated = await updateAuction(Number(auctionId), { [slotKey]: imgRes.url })
      setAuction(updated); setSaved(true); toast.success('Image uploaded')
      setTimeout(() => setSaved(false), 2000)
    } catch { toast.error('Image upload failed') }
    finally { setUploadingSlot(null) }
  }

  const handleAudioUpload = async (slotKey: string, file: File) => {
    if (!auctionId) return
    setUploadingSlot(slotKey)
    try {
      const audioRes = await uploadAudio(file)
      const updated = await updateAuction(Number(auctionId), { [slotKey]: audioRes.url })
      setAuction(updated); setSaved(true); toast.success('Sound uploaded')
      setTimeout(() => setSaved(false), 2000)
    } catch { toast.error('Audio upload failed') }
    finally { setUploadingSlot(null) }
  }

const handleRemoveAsset = async (slotKey: string) => {
if (!auctionId) return
try {
const updated = await updateAuction(Number(auctionId), { [slotKey]: '' })
setAuction(updated); toast.success('Image removed')
} catch { toast.error('Failed to remove image') }
}

  // ── Registration handlers ──
  const handleToggleReg = async () => {
    try {
      const data = await toggleRegistration(Number(auctionId))
      setRegOpen(data.registration_open)
      toast.success(data.registration_open ? 'Registration opened' : 'Registration closed')
    } catch { toast.error('Failed to toggle') }
  }

  const handleSaveDeadline = async () => {
    if (!auctionId) return
    setSavingReg(true)
    try {
      const deadlineIso = deadline ? new Date(deadline).toISOString() : null
      await setRegistrationDeadline(Number(auctionId), deadlineIso)
      toast.success(deadline ? 'Deadline set' : 'Deadline removed')
    } catch { toast.error('Failed to set deadline') }
    finally { setSavingReg(false) }
  }

  const toggleField = (key: string, prop: 'visible' | 'required') => {
    setFormConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], [prop]: !prev[key]?.[prop] },
    }))
  }

  const handleSaveFormConfig = async () => {
    if (!auctionId) return
    setSavingReg(true)
    try {
      await updateRegistrationFormConfig(Number(auctionId), formConfig)
      toast.success('Form configuration saved')
    } catch { toast.error('Failed to save form config') }
    finally { setSavingReg(false) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-white/40 font-display text-2xl tracking-wider">LOADING...</div>
  if (!auction) return null

  // assetUrl imported from api.ts

  return (
    <div className="animate-fade-in noise-bg min-h-screen bg-surface-0 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-xs tracking-widest font-display mb-6 text-white/30">
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/dashboard')}>HOME</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate(`/auctions/${auctionId}`)}>{auction.name?.toUpperCase()}</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-accent-gold font-semibold">SETTINGS</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(`/auctions/${auctionId}`)} className="text-white/30 hover:text-accent-gold transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-3xl md:text-4xl tracking-wider gradient-text">SETTINGS</h1>
        {saved && <span className="ml-3 text-emerald-400 text-sm font-semibold tracking-wide animate-fade-in">✓ Saved</span>}
      </div>

      {/* ── Player Registration ── */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">PLAYER REGISTRATION</h2>
        <p className="text-sm text-white/30 mb-6">Allow players to self-register via a public link. Configure which fields appear and set a deadline.</p>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl bg-surface-2/50 border border-white/5">
          <div className="flex items-center gap-3">
            {regOpen ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
            <span className="text-sm text-gray-300">Registration is <span className={`font-semibold ${regOpen ? 'text-emerald-400' : 'text-gray-500'}`}>{regOpen ? 'OPEN' : 'CLOSED'}</span></span>
          </div>
          <button onClick={handleToggleReg} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${regOpen ? 'bg-accent-gold' : 'bg-surface-4'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${regOpen ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Registration link */}
        {regOpen && (
          <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2 border border-white/5 text-sm text-gray-400 mb-5">
            <span className="text-xs text-gray-500 font-display tracking-wider">LINK</span>
            <span className="truncate font-mono text-xs">{window.location.origin}/register/{auctionId}</span>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register/${auctionId}`); toast.success('Link copied!') }}
              className="ml-auto shrink-0 text-accent-gold hover:text-amber-400 transition-colors text-xs font-medium">Copy</button>
          </div>
        )}

        {/* Deadline */}
        <div className="mb-5">
          <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">REGISTRATION DEADLINE</label>
          <div className="flex items-center gap-3">
            <input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all text-sm"
            />
            {deadline && (
              <button onClick={() => setDeadline('')} className="text-xs text-gray-500 hover:text-rose-400 transition-colors whitespace-nowrap">Clear</button>
            )}
            <button onClick={handleSaveDeadline} disabled={savingReg} className="bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold border border-accent-gold/20 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
              {savingReg ? '...' : 'Save'}
            </button>
          </div>
          {deadline && (
            <p className="text-xs text-amber-400/60 mt-2 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Registration will auto-close at {new Date(deadline).toLocaleString()}</p>
          )}
        </div>

        {/* Form field configuration */}
        <div>
          <label className="text-xs tracking-wider text-white/40 font-display mb-3 block">FORM FIELD CONFIGURATION</label>
          <p className="text-xs text-white/20 mb-3">Toggle which fields appear on the public registration form and mark them as required.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {Object.keys(DEFAULT_FORM_CONFIG).map(key => {
              const fc = formConfig[key] || { visible: true, required: false }
              const isAlwaysOn = key === 'name' // name can't be hidden
              return (
                <div key={key} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${fc.visible ? 'bg-surface-2/80 border-white/5' : 'bg-surface-1/50 border-white/[0.03] opacity-50'}`}>
                  <span className="text-sm text-gray-300">{FIELD_LABELS[key]}</span>
                  <div className="flex items-center gap-3">
                    {!isAlwaysOn && (
                      <button onClick={() => toggleField(key, 'visible')} title="Toggle visibility" className={`text-xs px-2 py-1 rounded-md transition-all ${fc.visible ? 'bg-accent-gold/15 text-accent-gold' : 'bg-surface-3 text-gray-600'}`}>
                        {fc.visible ? 'Visible' : 'Hidden'}
                      </button>
                    )}
                    {fc.visible && (
                      <button onClick={() => toggleField(key, 'required')} title="Toggle required" className={`text-xs px-2 py-1 rounded-md transition-all ${fc.required ? 'bg-rose-500/15 text-rose-400' : 'bg-surface-3 text-gray-500'}`}>
                        {fc.required ? 'Required' : 'Optional'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={handleSaveFormConfig} disabled={savingReg} className="bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold border border-accent-gold/20 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
            {savingReg ? '...' : 'Save Form Config'}
          </button>
        </div>
      </div>

      {/* RTM Settings */}
<div className="glass-strong rounded-2xl p-6 mb-6">
  <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">RIGHT TO MATCH (RTM)</h2>
  <p className="text-sm text-white/30 mb-6">IPL-style RTM allows a player's previous team to match the final bid and retain the player at the same price. Set <code className="text-white/50">previous_team_id</code> on players to enable RTM for them.</p>
  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-2/50 border border-white/5">
    <div className="flex items-center gap-3">
      {auction.rtm_enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
      <span className="text-sm text-gray-300">RTM is <span className={`font-semibold ${auction.rtm_enabled ? 'text-emerald-400' : 'text-gray-500'}`}>{auction.rtm_enabled ? 'ENABLED' : 'DISABLED'}</span></span>
    </div>
    <button
      onClick={() => handleAuctionUpdate('rtm_enabled', auction.rtm_enabled ? 0 : 1)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${auction.rtm_enabled ? 'bg-accent-gold' : 'bg-surface-4'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${auction.rtm_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
</div>

{/* Re-Auction */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">RE-AUCTION</h2>
        <p className="text-sm text-white/30 mb-6">Put all passed/unsold players back into the auction pool. Use this when you want to give unsold players another chance.</p>
        <button
          onClick={async () => {
            if (!window.confirm('Put all passed players back for re-auction?')) return
            try {
              const res = await reauctionPlayers(Number(auctionId))
              toast.success(`${res.count} players back for re-auction!`)
            } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed') }
          }}
          className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Re-Auction Passed Players
        </button>
      </div>

      {/* Auction Rules */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-5">AUCTION RULES</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">BUDGET PER TEAM</label>
            <input type="number" value={auction.budget_per_team} onChange={e => handleAuctionUpdate('budget_per_team', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all" />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">BASE BID</label>
            <input type="number" value={auction.base_bid} onChange={e => handleAuctionUpdate('base_bid', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all" />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">TIMER DURATION (SECONDS)</label>
            <input type="number" value={auction.timer_seconds} onChange={e => handleAuctionUpdate('timer_seconds', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all" />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">TIMER MODE</label>
            <select
              value={auction.timer_mode || 'auto'}
              onChange={e => handleAuctionUpdate('timer_mode', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all"
            >
              <option value="auto">Auto — starts on each player</option>
              <option value="manual">Manual — operator starts timer</option>
              <option value="off">Off — no timer</option>
            </select>
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">MIN PLAYERS PER TEAM</label>
            <input type="number" value={auction.min_players} onChange={e => handleAuctionUpdate('min_players', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all" />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">MAX PLAYERS PER TEAM</label>
            <input type="number" value={auction.max_players} onChange={e => handleAuctionUpdate('max_players', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all" />
          </div>
        </div>
      </div>

      {/* Bid Increment Slabs */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xl tracking-wider text-accent-gold">BID INCREMENT SLABS</h2>
          <button onClick={resetToDefaults} className="text-xs tracking-wider text-white/40 hover:text-accent-gold font-display flex items-center gap-1.5 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> RESET TO IPL DEFAULTS
          </button>
        </div>
        <p className="text-sm text-white/30 mb-5">When the current bid falls within a price range, the increment is added to calculate the next valid bid.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-3 text-white/30 font-display tracking-wider text-xs">MIN PRICE</th>
                <th className="text-left py-3 px-3 text-white/30 font-display tracking-wider text-xs">MAX PRICE</th>
                <th className="text-left py-3 px-3 text-white/30 font-display tracking-wider text-xs">INCREMENT</th>
                <th className="text-left py-3 px-3 text-white/30 font-display tracking-wider text-xs">PREVIEW</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {editSlabs.map((slab, index) => (
                <tr key={index} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-2 px-3">
                    <input type="text" value={formatPrice(slab.min_price)} onChange={e => updateEditSlab(index, 'min_price', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="text" value={formatPrice(slab.max_price)} onChange={e => updateEditSlab(index, 'max_price', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="text" value={formatPrice(slab.increment)} onChange={e => updateEditSlab(index, 'increment', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all" />
                  </td>
                  <td className="py-2 px-3 text-white/25 text-xs whitespace-nowrap">
                    {formatPrice(slab.min_price)} — {formatPrice(slab.max_price)}: +{formatPrice(slab.increment)}
                  </td>
                  <td className="py-2 px-3">
                    {editSlabs.length > 1 && (
                      <button onClick={() => removeSlab(index)} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-5">
          <button onClick={addSlab} className="text-xs tracking-wider text-white/40 hover:text-accent-gold font-display flex items-center gap-1.5 transition-colors">
            <Plus className="w-3.5 h-3.5" /> ADD SLAB
          </button>
          <button onClick={saveSlabs} disabled={saving} className="bg-gradient-to-r from-accent-gold to-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-accent-gold/20">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Slabs'}
          </button>
        </div>
      </div>

      {/* Sponsor Corner Logos */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">SPONSOR CORNER LOGOS</h2>
        <p className="text-sm text-white/30 mb-6">Upload sponsor logos to display in the four corners of the live auction screen and broadcast overlay.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SPONSOR_SLOTS.map(({ key, label }) => {
            const imageUrl = assetUrl(auction[key])
            const isUploading = uploadingSlot === key
            return (
              <div key={key} className="relative group">
                <label className="text-xs tracking-wider text-white/40 font-display mb-2 block text-center">{label.replace('-', ' ‑ ').toUpperCase()}</label>
                <input type="file" accept="image/*" ref={el => { fileRefs.current[key] = el }} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleImageUpload(key, file) }} />
                <button onClick={() => fileRefs.current[key]?.click()} disabled={isUploading} className="w-full aspect-square rounded-xl bg-surface-2 border border-white/5 hover:border-accent-gold/30 flex flex-col items-center justify-center gap-2 transition-all overflow-hidden disabled:opacity-50">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt={`${label} sponsor`} className="w-full h-full object-contain p-2" />
                  ) : (
                    <><Upload className="w-6 h-6 text-white/20 group-hover:text-accent-gold/50 transition-colors" /><span className="text-[10px] text-white/20 font-display tracking-wider">UPLOAD</span></>
                  )}
                </button>
                {imageUrl && !isUploading && (<>
                  <button onClick={() => fileRefs.current[key]?.click()} className="absolute bottom-2 right-8 bg-black/60 hover:bg-black/80 text-white/40 hover:text-accent-gold rounded-lg p-1.5 transition-all" title="Replace image"><Upload className="w-3 h-3" /></button>
<button onClick={() => handleRemoveAsset(key)} className="absolute bottom-2 right-2 bg-black/60 hover:bg-rose-500/80 text-white/40 hover:text-rose-400 rounded-lg p-1.5 transition-all" title="Remove image"><X className="w-3 h-3" /></button>
                </>)}
              </div>
            )
          })}
        </div>
      </div>

      {/* Broadcast Overlay Assets */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">BROADCAST OVERLAY</h2>
        <p className="text-sm text-white/30 mb-6">Upload custom graphics for the broadcast overlay page (used as OBS Browser Source). Leave empty for defaults.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {OVERLAY_ASSET_SLOTS.map(({ key, label, accept }) => {
            const imageUrl = assetUrl(auction[key])
            const isUploading = uploadingSlot === key
            return (
              <div key={key} className="relative group">
                <label className="text-xs tracking-wider text-white/40 font-display mb-2 block text-center">{label.toUpperCase()}</label>
                <input type="file" accept={accept} ref={el => { fileRefs.current[key] = el }} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleImageUpload(key, file) }} />
                <button onClick={() => fileRefs.current[key]?.click()} disabled={isUploading} className="w-full aspect-video rounded-xl bg-surface-2 border border-white/5 hover:border-accent-gold/30 flex flex-col items-center justify-center gap-2 transition-all overflow-hidden disabled:opacity-50">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt={label} className="w-full h-full object-cover p-1 rounded-lg" />
                  ) : (
                    <><Image className="w-6 h-6 text-white/20 group-hover:text-accent-gold/50 transition-colors" /><span className="text-[10px] text-white/20 font-display tracking-wider">UPLOAD</span></>
                  )}
                </button>
                {imageUrl && !isUploading && (<>
                  <button onClick={() => fileRefs.current[key]?.click()} className="absolute bottom-2 right-8 bg-black/60 hover:bg-black/80 text-white/40 hover:text-accent-gold rounded-lg p-1.5 transition-all" title="Replace"><Upload className="w-3 h-3" /></button>
<button onClick={() => handleRemoveAsset(key)} className="absolute bottom-2 right-2 bg-black/60 hover:bg-rose-500/80 text-white/40 hover:text-rose-400 rounded-lg p-1.5 transition-all" title="Remove"><X className="w-3 h-3" /></button>
                </>)}
              </div>
            )
          })}
        </div>
        {/* Overlay link */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
          <span className="text-xs text-white/40 font-display tracking-wider">OVERLAY URL:</span>
          <code className="text-xs text-accent-gold bg-surface-2 px-3 py-1.5 rounded-lg border border-white/5">
            {window.location.origin}/overlay/{auctionId}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/overlay/${auctionId}`)}
            className="text-xs text-white/40 hover:text-accent-gold font-display tracking-wider transition-colors"
          >
            COPY
          </button>
        </div>
      </div>

      {/* Sound Effects */}
      <div className="glass-strong rounded-2xl p-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">SOUND EFFECTS</h2>
        <p className="text-sm text-white/30 mb-6">Upload custom audio clips for auction events. Leave empty for default sounds.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SOUND_SLOTS.map(({ key, label }) => {
            const hasFile = !!auction[key]
            const isUploading = uploadingSlot === key
            return (
              <div key={key} className="relative group">
                <label className="text-xs tracking-wider text-white/40 font-display mb-2 block text-center">{label.toUpperCase()}</label>
                <input type="file" accept="audio/*" ref={el => { fileRefs.current[key] = el }} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleAudioUpload(key, file) }} />
                <button onClick={() => fileRefs.current[key]?.click()} disabled={isUploading} className="w-full aspect-square rounded-xl bg-surface-2 border border-white/5 hover:border-accent-gold/30 flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                  ) : hasFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <Volume2 className="w-8 h-8 text-accent-gold" />
                      <span className="text-[10px] text-white/40 font-display tracking-wider">UPLOADED</span>
                      {auction[key] && (
                        <audio controls src={assetUrl(auction[key])!} className="w-full px-2 mt-1" style={{ height: 28 }} />
                      )}
                    </div>
                  ) : (
                    <><Volume2 className="w-6 h-6 text-white/20 group-hover:text-accent-gold/50 transition-colors" /><span className="text-[10px] text-white/20 font-display tracking-wider">UPLOAD MP3</span></>
                  )}
                </button>
                {hasFile && !isUploading && (<>
                  <button onClick={() => fileRefs.current[key]?.click()} className="absolute bottom-2 right-8 bg-black/60 hover:bg-black/80 text-white/40 hover:text-accent-gold rounded-lg p-1.5 transition-all" title="Replace"><Upload className="w-3 h-3" /></button>
<button onClick={() => handleRemoveAsset(key)} className="absolute bottom-2 right-2 bg-black/60 hover:bg-rose-500/80 text-white/40 hover:text-rose-400 rounded-lg p-1.5 transition-all" title="Remove"><X className="w-3 h-3" /></button>
                </>)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
