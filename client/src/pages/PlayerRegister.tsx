import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, Check, AlertCircle } from 'lucide-react'
import { submitRegistration, getRegistrationStatus } from '../api'

const ROLES = ['batsman', 'bowler', 'allrounder', 'wicketkeeper']

export default function PlayerRegister() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const aid = Number(auctionId)

  const [auctionName, setAuctionName] = useState('')
  const [isOpen, setIsOpen] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    role: 'batsman',
    country: '',
    base_price: '',
    matches: '',
    runs: '',
    wickets: '',
    batting_avg: '',
    batting_sr: '',
    bowling_avg: '',
    bowling_econ: '',
  })

  useEffect(() => {
    getRegistrationStatus(aid).then(data => {
      setAuctionName(data.auction_name)
      setIsOpen(data.open)
    }).catch(() => setIsOpen(false))
  }, [aid])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await submitRegistration(aid, {
        name: form.name,
        role: form.role,
        country: form.country,
        base_price: parseFloat(form.base_price) || 0,
        matches: parseInt(form.matches) || 0,
        runs: parseInt(form.runs) || 0,
        wickets: parseInt(form.wickets) || 0,
        batting_avg: parseFloat(form.batting_avg) || 0,
        batting_sr: parseFloat(form.batting_sr) || 0,
        bowling_avg: parseFloat(form.bowling_avg) || 0,
        bowling_econ: parseFloat(form.bowling_econ) || 0,
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const inputClass = "w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all"

  if (isOpen === null) {
    return <div className="min-h-screen bg-surface-0 flex items-center justify-center"><div className="w-8 h-8 border-2 border-accent-gold/40 border-t-accent-gold rounded-full animate-spin" /></div>
  }

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="glass-strong rounded-2xl p-10 text-center max-w-md">
          <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-white mb-2">Registration Closed</h1>
          <p className="text-gray-500">Player registration is not currently open for this auction.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-2xl p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="font-display text-2xl text-white mb-2">Registration Submitted!</h1>
          <p className="text-gray-500">Your registration is pending admin approval. You'll be added to the player pool once approved.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4 noise-bg relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-primary-700/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-accent-gold/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-lg">
        <div className="glass-strong rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-3xl tracking-wide gradient-text">PLAYER REGISTRATION</h1>
            <p className="text-gray-500 text-sm mt-1">{auctionName}</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Required fields */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="Enter your name" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Role *</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} className={inputClass}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Country *</label>
                <input value={form.country} onChange={e => set('country', e.target.value)} className={inputClass} placeholder="e.g. India" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Base Price (₹) *</label>
              <input type="number" value={form.base_price} onChange={e => set('base_price', e.target.value)} className={inputClass} placeholder="e.g. 2000000" required />
            </div>

            {/* Stats (optional) */}
            <div className="border-t border-white/5 pt-4 mt-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-display">Cricket Stats (Optional)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Matches</label>
                  <input type="number" value={form.matches} onChange={e => set('matches', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Runs</label>
                  <input type="number" value={form.runs} onChange={e => set('runs', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Wickets</label>
                  <input type="number" value={form.wickets} onChange={e => set('wickets', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Batting Avg</label>
                  <input type="number" step="0.1" value={form.batting_avg} onChange={e => set('batting_avg', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Batting SR</label>
                  <input type="number" step="0.1" value={form.batting_sr} onChange={e => set('batting_sr', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bowl Avg</label>
                  <input type="number" step="0.1" value={form.bowling_avg} onChange={e => set('bowling_avg', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bowl Econ</label>
                  <input type="number" step="0.1" value={form.bowling_econ} onChange={e => set('bowling_econ', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" />
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-accent-gold to-amber-500 hover:from-amber-500 hover:to-accent-gold disabled:from-gray-600 disabled:to-gray-600 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none mt-2"
            >
              {loading ? 'Submitting...' : 'Submit Registration'}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">Powered by Cricket Auction</p>
      </motion.div>
    </div>
  )
}
