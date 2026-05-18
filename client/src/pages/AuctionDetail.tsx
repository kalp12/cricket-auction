import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Users, User, Tags, Pencil, Trash2,
  Link, Copy, Timer, TrendingUp, Palette
} from 'lucide-react'
import { getAuction, updateAuction, deleteAuction } from '../api'

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAuction()
  }, [id])

  const fetchAuction = async () => {
    try {
      const data = await getAuction(Number(id))
      setAuction(data)
      setEditForm(data)
    } catch {
      navigate('/auctions')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateAuction(Number(id), {
        name: editForm.name,
        timer_seconds: editForm.timer_seconds,
        timer_enabled: editForm.timer_enabled,
        base_bid: editForm.base_bid,
        budget_per_team: editForm.budget_per_team,
        min_players: editForm.min_players,
        max_players: editForm.max_players,
      })
      setAuction(updated)
      setEditMode(false)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this auction? This cannot be undone.')) return
    try {
      await deleteAuction(Number(id))
      navigate('/auctions')
    } catch {
      alert('Delete failed')
    }
  }

  const handleDeactivate = async () => {
    const newStatus = auction.status === 'ended' ? 'waiting' : 'ended'
    try {
      const updated = await updateAuction(Number(id), { status: newStatus })
      setAuction(updated)
    } catch {
      alert('Status update failed')
    }
  }

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
    return `₹${val.toLocaleString()}`
  }

  if (loading) return <div className="text-gray-400 p-12 text-center">Loading...</div>
  if (!auction) return null

  const isActive = auction.status !== 'ended'

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400">AUCTIONS</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">{auction.name?.toUpperCase()}</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/auctions')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">{auction.name}</h1>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600">{auction.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{auction.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
                  A-{String(auction.id).padStart(3, '0')}
                </span>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  auction.status === 'live' ? 'bg-green-100 text-green-700' :
                  auction.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                  auction.status === 'ended' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {auction.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Action icons */}
            <button onClick={() => navigate(`/auctions/${id}/teams`)} title="Manage Teams" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Users className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={() => navigate(`/auctions/${id}/players`)} title="Manage Players" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <User className="w-5 h-5 text-gray-500" />
            </button>
            <button title="Categories" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Tags className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={() => setEditMode(!editMode)} title="Edit" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Pencil className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={handleDelete} title="Delete" className="p-2 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5 text-red-400" />
            </button>

            {/* Deactivate toggle */}
            <button
              onClick={handleDeactivate}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Mode */}
      {editMode && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">Edit Auction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Budget per Team</label>
              <input
                type="number"
                value={editForm.budget_per_team}
                onChange={e => setEditForm({ ...editForm, budget_per_team: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Base Bid</label>
              <input
                type="number"
                value={editForm.base_bid}
                onChange={e => setEditForm({ ...editForm, base_bid: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Timer (seconds)</label>
              <input
                type="number"
                value={editForm.timer_seconds}
                onChange={e => setEditForm({ ...editForm, timer_seconds: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Min Players</label>
              <input
                type="number"
                value={editForm.min_players}
                onChange={e => setEditForm({ ...editForm, min_players: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Max Players</label>
              <input
                type="number"
                value={editForm.max_players}
                onChange={e => setEditForm({ ...editForm, max_players: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase mb-1">Budget per Team</p>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(auction.budget_per_team)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase mb-1">Base Bid</p>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(auction.base_bid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase mb-1">Timer</p>
          <p className="text-2xl font-bold text-gray-800">{auction.timer_enabled ? `${auction.timer_seconds}s` : 'Off'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase mb-1">Players</p>
          <p className="text-2xl font-bold text-gray-800">{auction.min_players}–{auction.max_players}</p>
        </div>
      </div>

      {/* Sharing Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Public View Link</p>
            <button onClick={() => copyLink(`${window.location.origin}/auction/${id}`)} className="text-blue-500 hover:text-blue-700">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 font-mono truncate">{window.location.origin}/auction/{id}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Overlay Link</p>
            <button onClick={() => copyLink(`${window.location.origin}/overlay/${id}`)} className="text-blue-500 hover:text-blue-700">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 font-mono truncate">{window.location.origin}/overlay/{id}</p>
        </div>
      </div>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Registration</h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Player Self Registration</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>

        {/* Dynamic Rules */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Dynamic Rules</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-600">Timer</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                auction.timer_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {auction.timer_enabled ? `ON (${auction.timer_seconds}s)` : 'OFF'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-600">Bid Increments</p>
              </div>
              <span className="text-xs text-gray-400">Configure in Settings</span>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Palette className="w-6 h-6" />
            <h3 className="font-bold">Customize your Auction Theme</h3>
          </div>
          <p className="text-purple-200 text-sm mb-4">Choose colors, fonts, and branding for your live auction room.</p>
          <button className="bg-white text-purple-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors">
            Customize Theme
          </button>
        </div>

        {/* Data Transfer */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Data Transfer</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600">
              Copy players from another auction
            </button>
            <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600">
              Copy teams from another auction
            </button>
          </div>
        </div>
      </div>

      {/* Go Live Button */}
      {(auction.status === 'waiting' || auction.status === 'paused') && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(`/auction-panel?auction=${id}`)}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <Link className="w-5 h-5" />
            Go to Auction Panel
          </button>
        </div>
      )}
    </div>
  )
}
