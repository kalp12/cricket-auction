import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X, Image } from 'lucide-react'
import { createAuction, uploadImage } from '../api'

const BASE_URL = 'http://localhost:8000'

export default function NewAuction() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    timer_seconds: 60,
    timer_enabled: 1,
    base_bid: 1000000,
    budget_per_team: 100000000,
    min_players: 5,
    max_players: 18,
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to server
    setUploading(true)
    try {
      const res = await uploadImage(file)
      setImageUrl(res.url)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Image upload failed')
      setImagePreview('')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    setImageUrl('')
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Auction name is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const auction = await createAuction({
        name: form.name,
        timer_seconds: form.timer_seconds,
        timer_enabled: form.timer_enabled,
        base_bid: form.base_bid,
        budget_per_team: form.budget_per_team,
        min_players: form.min_players,
        max_players: form.max_players,
        image_url: imageUrl || undefined,
      })
      navigate(`/auctions/${auction.id}`)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create auction')
    } finally {
      setLoading(false)
    }
  }

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400">DASHBOARD</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">NEW AUCTION</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">New Auction</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Auction Logo */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-700 pt-2">Auction Logo</label>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative w-32 h-32 group">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-400">
                    {uploading ? 'Uploading...' : 'Upload'}
                  </span>
                </button>
              )}
              <p className="text-xs text-gray-400 mt-2">PNG, JPG, GIF up to 5MB</p>
            </div>
          </div>

          {/* Auction Name */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-700 pt-2">Auction Name *</label>
            <div className="flex-1">
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. IPL 2026 Mega Auction"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
          </div>

          {/* Budget per Team */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-700 pt-2">Budget per Team</label>
            <div className="flex-1">
              <input
                type="number"
                value={form.budget_per_team}
                onChange={e => set('budget_per_team', Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-1">In rupees (e.g. 100000000 = 10 Crore)</p>
            </div>
          </div>

          {/* Base Bid */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-700 pt-2">Base Bid</label>
            <div className="flex-1">
              <input
                type="number"
                value={form.base_bid}
                onChange={e => set('base_bid', Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-1">In rupees (e.g. 1000000 = 10 Lakh)</p>
            </div>
          </div>

          {/* Min / Max Players */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-700 pt-2">Players per Team</label>
            <div className="flex-1 flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Min</label>
                <input
                  type="number"
                  value={form.min_players}
                  onChange={e => set('min_players', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Max</label>
                <input
                  type="number"
                  value={form.max_players}
                  onChange={e => set('max_players', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-700 pt-2">Timer</label>
            <div className="flex-1 flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.timer_enabled === 1}
                  onChange={e => set('timer_enabled', e.target.checked ? 1 : 0)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              {form.timer_enabled === 1 && (
                <input
                  type="number"
                  value={form.timer_seconds}
                  onChange={e => set('timer_seconds', Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-center"
                />
              )}
              <span className="text-sm text-gray-500">{form.timer_enabled ? 'seconds' : 'Off'}</span>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 mr-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Auction'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
