import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, RotateCcw, Save, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuction, updateAuction, getSlabs, bulkCreateSlabs, createDefaultSlabs, deleteSlab, uploadImage } from '../api'

interface Slab {
  id: number
  auction_id: number
  min_price: number
  max_price: number
  increment: number
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

  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      try {
        const [auctionData, slabsData] = await Promise.all([
          getAuction(Number(auctionId)),
          getSlabs(Number(auctionId)),
        ])
        setAuction(auctionData)
        setSlabs(slabsData)
        setEditSlabs(slabsData.length > 0
          ? slabsData.map((s: Slab) => ({ ...s }))
          : DEFAULT_SLABS.map(s => ({ ...s, auction_id: Number(auctionId) }))
        )
      } catch {
        navigate('/auctions')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [auctionId, navigate])

  const handleAuctionUpdate = async (field: string, value: any) => {
    if (!auctionId) return
    try {
      const updated = await updateAuction(Number(auctionId), { [field]: value })
      setAuction(updated)
      setSaved(true); toast.success('Setting updated')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('Update failed')
    }
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
        auction_id: Number(auctionId),
        min_price: s.min_price,
        max_price: s.max_price,
        increment: s.increment,
      }))
      const result = await bulkCreateSlabs(slabsToSave)
      setSlabs(result)
      setEditSlabs(result.map((s: Slab) => ({ ...s })))
      setSaved(true); toast.success('Slabs saved')
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save slabs')
    } finally {
      setSaving(false)
    }
  }

  const handleSponsorUpload = async (slotKey: string, file: File) => {
    if (!auctionId) return
    setUploadingSlot(slotKey)
    try {
      const imgRes = await uploadImage(file)
      const updated = await updateAuction(Number(auctionId), { [slotKey]: imgRes.url })
      setAuction(updated)
      setSaved(true); toast.success('Sponsor logo uploaded')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('Image upload failed')
    } finally {
      setUploadingSlot(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-white/40 font-display text-2xl tracking-wider">LOADING...</div>
  if (!auction) return null

  return (
    <div className="animate-fade-in noise-bg min-h-screen bg-surface-0 p-6 md:p-8">
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
        <button
          onClick={() => navigate(`/auctions/${auctionId}`)}
          className="text-white/30 hover:text-accent-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-4xl tracking-wider gradient-text">SETTINGS</h1>
        {saved && (
          <span className="ml-3 text-emerald-400 text-sm font-semibold tracking-wide animate-fade-in">
            ✓ Saved
          </span>
        )}
      </div>

      {/* Auction Rules */}
      <div className="glass-strong rounded-2xl p-6 mb-6 border border-white/[0.08]">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-5">AUCTION RULES</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">BUDGET PER TEAM</label>
            <input
              type="number"
              value={auction.budget_per_team}
              onChange={e => handleAuctionUpdate('budget_per_team', Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">BASE BID</label>
            <input
              type="number"
              value={auction.base_bid}
              onChange={e => handleAuctionUpdate('base_bid', Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">TIMER DURATION (SECONDS)</label>
            <input
              type="number"
              value={auction.timer_seconds}
              onChange={e => handleAuctionUpdate('timer_seconds', Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-4 pt-7">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={auction.timer_enabled === 1}
                onChange={e => handleAuctionUpdate('timer_enabled', e.target.checked ? 1 : 0)}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-white/10 rounded-full peer peer-checked:bg-accent-gold/80 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-6 after:shadow-md"></div>
            </label>
            <span className="text-sm text-white/50 font-display tracking-wider">ENABLE TIMER</span>
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">MIN PLAYERS PER TEAM</label>
            <input
              type="number"
              value={auction.min_players}
              onChange={e => handleAuctionUpdate('min_players', Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">MAX PLAYERS PER TEAM</label>
            <input
              type="number"
              value={auction.max_players}
              onChange={e => handleAuctionUpdate('max_players', Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Bid Increment Slabs */}
      <div className="glass-strong rounded-2xl p-6 mb-6 border border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xl tracking-wider text-accent-gold">BID INCREMENT SLABS</h2>
          <button
            onClick={resetToDefaults}
            className="text-xs tracking-wider text-white/40 hover:text-accent-gold font-display flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> RESET TO IPL DEFAULTS
          </button>
        </div>

        <p className="text-sm text-white/30 mb-5">
          When the current bid falls within a price range, the increment is added to calculate the next valid bid.
        </p>

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
                    <input
                      type="text"
                      value={formatPrice(slab.min_price)}
                      onChange={e => updateEditSlab(index, 'min_price', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={formatPrice(slab.max_price)}
                      onChange={e => updateEditSlab(index, 'max_price', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={formatPrice(slab.increment)}
                      onChange={e => updateEditSlab(index, 'increment', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all"
                    />
                  </td>
                  <td className="py-2 px-3 text-white/25 text-xs whitespace-nowrap">
                    {formatPrice(slab.min_price)} — {formatPrice(slab.max_price)}: +{formatPrice(slab.increment)}
                  </td>
                  <td className="py-2 px-3">
                    {editSlabs.length > 1 && (
                      <button
                        onClick={() => removeSlab(index)}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={addSlab}
            className="text-xs tracking-wider text-white/40 hover:text-accent-gold font-display flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> ADD SLAB
          </button>

          <button
            onClick={saveSlabs}
            disabled={saving}
            className="bg-gradient-to-r from-accent-gold to-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-accent-gold/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Slabs'}
          </button>
        </div>
      </div>

      {/* Sponsor Corner Logos */}
      <div className="glass-strong rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-2">SPONSOR CORNER LOGOS</h2>
        <p className="text-sm text-white/30 mb-6">
          Upload sponsor logos to display in the four corners of the live auction screen.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SPONSOR_SLOTS.map(({ key, label }) => {
            const imageUrl = auction[key] ? `http://localhost:8000${auction[key]}` : null
            const isUploading = uploadingSlot === key

            return (
              <div key={key} className="relative group">
                <label className="text-xs tracking-wider text-white/40 font-display mb-2 block text-center">
                  {label.replace('-', ' ‑ ').toUpperCase()}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={el => { fileRefs.current[key] = el }}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleSponsorUpload(key, file)
                  }}
                />
                <button
                  onClick={() => fileRefs.current[key]?.click()}
                  disabled={isUploading}
                  className="w-full aspect-square rounded-xl bg-surface-2 border border-white/5 hover:border-accent-gold/30 flex flex-col items-center justify-center gap-2 transition-all overflow-hidden disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${label} sponsor`}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-white/20 group-hover:text-accent-gold/50 transition-colors" />
                      <span className="text-[10px] text-white/20 font-display tracking-wider">UPLOAD</span>
                    </>
                  )}
                </button>
                {imageUrl && !isUploading && (
                  <button
                    onClick={() => fileRefs.current[key]?.click()}
                    className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white/40 hover:text-accent-gold rounded-lg p-1.5 transition-all"
                    title="Replace image"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
