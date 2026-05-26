import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { login } from '../api'
import { Trophy } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await login(username, password)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', data.role || 'viewer')
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4 relative overflow-hidden noise-bg">
      {/* Ambient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary-700/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-accent-gold/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="glass-strong rounded-3xl p-10 shadow-2xl">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex flex-col items-center mb-8"
          >
            <motion.div
              animate={{ rotate: [0, -5, 5, -3, 0] }}
              transition={{ duration: 2, delay: 1, repeat: Infinity, repeatDelay: 4 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20"
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="font-display text-4xl tracking-wide gradient-text">CRICKET AUCTION</h1>
            <p className="text-gray-500 text-sm mt-1">Admin Control Panel</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all"
                placeholder="Enter username"
                autoComplete="username"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all"
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-accent-gold to-amber-500 hover:from-amber-500 hover:to-accent-gold disabled:from-gray-600 disabled:to-gray-600 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </motion.button>
          </form>
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-gray-600 text-xs mt-6"
        >
          Built for the love of cricket
        </motion.p>
      </motion.div>
    </div>
  )
}
