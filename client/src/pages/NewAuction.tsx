import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createAuction, uploadImage } from '../api'

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
    timer_mode: 'auto',
    base_bid: 1000000,
    budget_per_team: 100000000,
    min_players: 5,
    max_players: 18,
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploading(true)
    try {
      const res = await uploadImage(file)
      setImageUrl(res.url)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Image upload failed')
      setImagePreview('')
    } finally { setUploading(false) }
  }

  const removeImage = () => {
    setImageUrl(''); setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Auction name is required'); return }
    setLoading(true); setError('')
    try {
      const auction = await createAuction({
        name: form.name,
        timer_seconds: form.timer_seconds,
        timer_mode: form.timer_mode,
        base_bid: form.base_bid,
        budget_per_team: form.budget_per_team,
        min_players: form.min_players,
        max_players: form.max_players,
        image_url: imageUrl || undefined,
      })
      navigate(`/auctions/${auction.id}`); toast.success('Auction created!')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create auction')
    } finally { setLoading(false) }
  }

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  const inputCls = 'w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all'

  return (
    <div className="animate-fade-in noise-bg">
      <nav className="text-sm text-gray-600 mb-2">
        <span className="text-gray-600">HOME</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-500">DASHBOARD</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-400">NEW AUCTION</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-3xl md:text-5xl tracking-wide gradient-text">NEW AUCTION</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="glass-strong rounded-2xl p-8 space-y-6">
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl">
              {error}
            </motion.div>
          )}

          {/* Auction Logo */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-400 pt-2">Auction Logo</label>
            <div className="flex-1">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {imagePreview ? (
                <div className="relative w-32 h-32 group">
                  <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-white/10" />
                  <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-32 h-32 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-gold/30 hover:bg-white/5 transition-all">
                  <Upload className="w-8 h-8 text-gray-600 mb-1" />
                  <span className="text-xs text-gray-600">{uploading ? 'Uploading...' : 'Upload'}</span>
                </button>
              )}
              <p className="text-xs text-gray-600 mt-2">PNG, JPG, GIF up to 5MB</p>
            </div>
          </div>

          {/* Name */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-400 pt-2">Auction Name *</label>
            <div className="flex-1">
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. IPL 2026 Mega Auction" className={inputCls} />
            </div>
          </div>

          {/* Budget */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-400 pt-2">Budget per Team</label>
            <div className="flex-1">
              <input type="number" value={form.budget_per_team} onChange={e => set('budget_per_team', Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-600 mt-1">In rupees (e.g. 100000000 = ₹10 Cr)</p>
            </div>
          </div>

          {/* Base Bid */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-400 pt-2">Base Bid</label>
            <div className="flex-1">
              <input type="number" value={form.base_bid} onChange={e => set('base_bid', Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-600 mt-1">In rupees (e.g. 1000000 = ₹10 L)</p>
            </div>
          </div>

          {/* Min / Max Players */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-400 pt-2">Players per Team</label>
            <div className="flex-1 flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-600 mb-1 block">Min</label>
                <input type="number" value={form.min_players} onChange={e => set('min_players', Number(e.target.value))} className={inputCls} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-600 mb-1 block">Max</label>
                <input type="number" value={form.max_players} onChange={e => set('max_players', Number(e.target.value))} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-start gap-6">
            <label className="w-40 text-sm font-medium text-gray-400 pt-2">Timer</label>
            <div className="flex-1 flex items-center gap-4">
              <select value={form.timer_mode} onChange={e => set('timer_mode', e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none">
                <option value="auto">Auto — starts on each player</option>
                <option value="manual">Manual — operator starts</option>
                <option value="off">Off — no timer</option>
              </select>
              {form.timer_mode !== 'off' && (
                <input type="number" value={form.timer_seconds} onChange={e => set('timer_seconds', Number(e.target.value))}
                  className="w-24 px-3 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white text-center focus:ring-2 focus:ring-accent-gold/50 outline-none" />
              )}
              {form.timer_mode !== 'off' && <span className="text-sm text-gray-500">seconds</span>}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 font-medium hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <motion.button type="submit" disabled={loading || uploading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="px-6 py-2.5 bg-gradient-to-r from-accent-gold to-amber-500 text-black font-bold rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-400 shadow-lg shadow-amber-500/20 disabled:shadow-none transition-all">
              {loading ? 'Creating...' : 'Create Auction'}
            </motion.button>
          </div>
        </div>
      </form>
    </div>
  )
}
