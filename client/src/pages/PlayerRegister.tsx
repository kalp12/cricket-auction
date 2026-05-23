import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, Check, AlertCircle, Camera, Upload, Clock, Mail } from 'lucide-react'
import { submitRegistration, getRegistrationStatus, uploadRegistrationImage } from '../api'

const ROLES = ['batsman', 'bowler', 'allrounder', 'wicketkeeper']

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

export default function PlayerRegister() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const aid = Number(auctionId)

  const [auctionName, setAuctionName] = useState('')
  const [isOpen, setIsOpen] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [formConfig, setFormConfig] = useState<FormConfig>(DEFAULT_FORM_CONFIG)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    role: 'batsman',
    country: '',
    base_price: '',
    email: '',
    matches: '',
    runs: '',
    wickets: '',
    batting_avg: '',
    batting_sr: '',
    bowling_avg: '',
    bowling_econ: '',
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getRegistrationStatus(aid).then(data => {
      setAuctionName(data.auction_name)
      setIsOpen(data.open)
      if (data.form_config) setFormConfig(data.form_config)
      if (data.deadline) setDeadline(data.deadline)
    }).catch(() => setIsOpen(false))
  }, [aid])

  // Deadline countdown
  useEffect(() => {
    if (!deadline) return
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) {
        setIsOpen(false)
        setTimeLeft('Deadline passed')
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h}h ${m}m ${s}s remaining`)
    }
    update()
    timerRef.current = setInterval(update, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [deadline])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let imageUrl: string | undefined
      if (imageFile && formConfig.image?.visible) {
        try {
          const imgRes = await uploadRegistrationImage(aid, imageFile)
          imageUrl = imgRes.url
        } catch {
          setError('Image upload failed. Please try again.')
          setLoading(false)
          return
        }
      }
      await submitRegistration(aid, {
        name: form.name,
        role: form.role,
        country: form.country,
        base_price: parseFloat(form.base_price) || 0,
        image_url: imageUrl,
        email: form.email || undefined,
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
  const fc = (key: string) => formConfig[key] || { visible: true, required: false }

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
          <p className="text-gray-500">{timeLeft === 'Deadline passed' ? 'The registration deadline has passed.' : 'Player registration is not currently open for this auction.'}</p>
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
          <p className="text-gray-500">Your registration is pending admin approval. {form.email ? "You'll receive a confirmation email shortly." : "You'll be added to the player pool once approved."}</p>
        </motion.div>
      </div>
    )
  }

  const hasStatsFields = fc('matches').visible || fc('runs').visible || fc('wickets').visible || fc('batting_avg').visible || fc('batting_sr').visible || fc('bowling_avg').visible || fc('bowling_econ').visible

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
            {deadline && timeLeft && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                <Clock className="w-3.5 h-3.5" /> {timeLeft}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            {fc('name').visible && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name {fc('name').required && '*'}</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="Enter your name" required={fc('name').required} />
              </div>
            )}

            {/* Email */}
            {fc('email').visible && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
                  Email {fc('email').required && '*'}
                </label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputClass} placeholder="you@example.com" required={fc('email').required} />
                {!fc('email').required && <p className="text-[11px] text-gray-600 mt-1">Optional — receive confirmation when your registration is approved</p>}
              </div>
            )}

            {/* Role & Country */}
            {(fc('role').visible || fc('country').visible) && (
              <div className="grid grid-cols-2 gap-4">
                {fc('role').visible && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Role {fc('role').required && '*'}</label>
                    <select value={form.role} onChange={e => set('role', e.target.value)} className={inputClass} required={fc('role').required}>
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                )}
                {fc('country').visible && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Country {fc('country').required && '*'}</label>
                    <input value={form.country} onChange={e => set('country', e.target.value)} className={inputClass} placeholder="e.g. India" required={fc('country').required} />
                  </div>
                )}
              </div>
            )}

            {/* Base Price */}
            {fc('base_price').visible && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Base Price (₹) {fc('base_price').required && '*'}</label>
                <input type="number" value={form.base_price} onChange={e => set('base_price', e.target.value)} className={inputClass} placeholder="e.g. 2000000" required={fc('base_price').required} />
              </div>
            )}

            {/* Photo Upload */}
            {fc('image').visible && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Photo {fc('image').required && '*'}</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-surface-2 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/10 hover:border-accent-gold/30 bg-surface-2/50 cursor-pointer transition-all ${imagePreview ? 'text-emerald-400 border-emerald-500/20' : 'text-gray-500'}`}>
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">{imageFile ? imageFile.name : 'Choose photo'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setImageFile(file)
                        setImagePreview(URL.createObjectURL(file))
                      }
                    }} />
                  </label>
                  {imageFile && (
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }} className="text-gray-500 hover:text-rose-400 transition-colors text-sm">Remove</button>
                  )}
                </div>
              </div>
            )}

            {/* Stats (optional) */}
            {hasStatsFields && (
              <div className="border-t border-white/5 pt-4 mt-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-display">Cricket Stats (Optional)</p>
                <div className="grid grid-cols-3 gap-3">
                  {fc('matches').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Matches</label>
                      <input type="number" value={form.matches} onChange={e => set('matches', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('matches').required} />
                    </div>
                  )}
                  {fc('runs').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Runs</label>
                      <input type="number" value={form.runs} onChange={e => set('runs', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('runs').required} />
                    </div>
                  )}
                  {fc('wickets').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Wickets</label>
                      <input type="number" value={form.wickets} onChange={e => set('wickets', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('wickets').required} />
                    </div>
                  )}
                  {fc('batting_avg').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Batting Avg</label>
                      <input type="number" step="0.1" value={form.batting_avg} onChange={e => set('batting_avg', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('batting_avg').required} />
                    </div>
                  )}
                  {fc('batting_sr').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Batting SR</label>
                      <input type="number" step="0.1" value={form.batting_sr} onChange={e => set('batting_sr', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('batting_sr').required} />
                    </div>
                  )}
                  {fc('bowling_avg').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Bowl Avg</label>
                      <input type="number" step="0.1" value={form.bowling_avg} onChange={e => set('bowling_avg', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('bowling_avg').required} />
                    </div>
                  )}
                  {fc('bowling_econ').visible && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Bowl Econ</label>
                      <input type="number" step="0.1" value={form.bowling_econ} onChange={e => set('bowling_econ', e.target.value)} className={inputClass + ' text-sm py-2'} placeholder="0" required={fc('bowling_econ').required} />
                    </div>
                  )}
                </div>
              </div>
            )}

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
