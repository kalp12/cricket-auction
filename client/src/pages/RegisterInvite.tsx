import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { registerWithInvite } from '../api'
import { Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await registerWithInvite(token, username, password)
      localStorage.setItem('token', data.access_token)
      toast.success('Account created! Welcome aboard.')
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl text-rose-400 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-500">No invite token found in URL.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4 relative overflow-hidden noise-bg">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary-700/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-accent-gold/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-10 shadow-2xl">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-2xl tracking-wide gradient-text">JOIN THE TEAM</h1>
            <p className="text-gray-500 text-sm mt-1">Create your admin account</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full px-4 py-3.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 outline-none"
                placeholder="Choose a username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-3.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 outline-none"
                placeholder="Choose a password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm Password</label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className="w-full px-4 py-3.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 outline-none"
                placeholder="Repeat your password"
              />
            </div>

            {error && (
              <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-accent-gold to-amber-500 hover:from-amber-500 hover:to-accent-gold disabled:from-gray-600 disabled:to-gray-600 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
