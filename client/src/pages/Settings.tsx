import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, RotateCcw, Save } from 'lucide-react'
import { getAuction, updateAuction, getSlabs, bulkCreateSlabs, createDefaultSlabs, deleteSlab } from '../api'

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

export default function Settings() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<any>(null)
  const [slabs, setSlabs] = useState<Slab[]>([])
  const [editSlabs, setEditSlabs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert('Update failed')
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to save slabs')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400 p-12 text-center">Loading...</div>
  if (!auction) return null

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => navigate(`/auctions/${auctionId}`)}>{auction.name?.toUpperCase()}</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">SETTINGS</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/auctions/${auctionId}`)} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
      </div>

      {/* Auction Rules */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Auction Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Budget per Team</label>
            <input
              type="number"
              value={auction.budget_per_team}
              onChange={e => handleAuctionUpdate('budget_per_team', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Base Bid</label>
            <input
              type="number"
              value={auction.base_bid}
              onChange={e => handleAuctionUpdate('base_bid', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Timer Duration (seconds)</label>
            <input
              type="number"
              value={auction.timer_seconds}
              onChange={e => handleAuctionUpdate('timer_seconds', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={auction.timer_enabled === 1}
                onChange={e => handleAuctionUpdate('timer_enabled', e.target.checked ? 1 : 0)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
            <span className="text-sm text-gray-600">Enable Timer</span>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Min Players per Team</label>
            <input
              type="number"
              value={auction.min_players}
              onChange={e => handleAuctionUpdate('min_players', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Max Players per Team</label>
            <input
              type="number"
              value={auction.max_players}
              onChange={e => handleAuctionUpdate('max_players', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bid Increment Slabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Bid Increment Slabs</h2>
          <button onClick={resetToDefaults} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <RotateCcw className="w-4 h-4" /> Reset to IPL Defaults
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          When the current bid falls within a price range, the increment is added to calculate the next valid bid.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Min Price</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Max Price</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Increment</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Preview</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {editSlabs.map((slab, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={formatPrice(slab.min_price)}
                      onChange={e => updateEditSlab(index, 'min_price', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={formatPrice(slab.max_price)}
                      onChange={e => updateEditSlab(index, 'max_price', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={formatPrice(slab.increment)}
                      onChange={e => updateEditSlab(index, 'increment', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </td>
                  <td className="py-2 px-3 text-gray-500">
                    {formatPrice(slab.min_price)} — {formatPrice(slab.max_price)}: +{formatPrice(slab.increment)}
                  </td>
                  <td className="py-2 px-3">
                    {editSlabs.length > 1 && (
                      <button onClick={() => removeSlab(index)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button onClick={addSlab} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Slab
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={saveSlabs}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:bg-blue-400 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Slabs'}
          </button>
        </div>
      </div>
    </div>
  )
}
