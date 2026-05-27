import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, QrCode, X, Gavel } from 'lucide-react'
import { getPublicAuction, WS_BASE, assetUrl } from '../api'
import { useSoundBoard } from '../hooks/useSoundBoard'
import toast from 'react-hot-toast'

interface PlayerData {
  id: number
  name: string
  role: string
  country: string
  base_price: number
  image_url?: string
}

interface TeamData {
  id: number
  name: string
  short_name?: string
  logo_url?: string
  budget_tier?: string
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const TIER_COLORS: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
  unknown: 'bg-gray-500',
}

function TimerCircle({ seconds, maxSeconds }: { seconds: number; maxSeconds: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 0
  const offset = circumference * (1 - progress)
  const color = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx="59" cy="59" r={radius} fill="none" stroke={color} strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
      </svg>
      <motion.div key={seconds} initial={{ scale: 1.05, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }} className={`text-3xl font-mono font-bold ${seconds <= 5 ? 'text-red-400' : seconds <= 10 ? 'text-yellow-400' : 'text-blue-400'}`}>
        {seconds}
      </motion.div>
    </div>
  )
}

const fireConfetti = () => {
  const duration = 1500
  const end = Date.now() + duration
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'] })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'] })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  confetti({ particleCount: 100, spread: 100, origin: { y: 0.6 }, colors: ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'], startVelocity: 45 })
}

export default function SpectatorWatch() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)

  const [auction, setAuction] = useState<any>(null)
  const [teams, setTeams] = useState<TeamData[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [currentTeam, setCurrentTeam] = useState<TeamData | null>(null)
  const [status, setStatus] = useState('waiting')
  const [soldOverlay, setSoldOverlay] = useState<'sold' | 'unsold' | null>(null)
  const [soldTeam, setSoldTeam] = useState<TeamData | null>(null)
  const [soldAmount, setSoldAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  // Timer
  const timerValue = useRef(0)
  const timerMax = useRef(30)
  const timerMode = useRef<string>('auto')
  const [, forceUpdate] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const soundBoard = useSoundBoard(auction)

  const setTimer = useCallback((seconds: number) => {
    timerValue.current = seconds
    timerMax.current = seconds
    forceUpdate(n => n + 1)
  }, [])

  const startCountdown = useCallback(() => {
    if (timerInterval.current) clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
      if (timerValue.current > 0) { timerValue.current -= 1; forceUpdate(n => n + 1) }
      else { if (timerInterval.current) clearInterval(timerInterval.current); timerInterval.current = null }
    }, 1000)
  }, [])

  const stopCountdown = useCallback(() => {
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null }
  }, [])

  useEffect(() => { return () => { stopCountdown() } }, [stopCountdown])

  // Fetch initial data
  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      try {
        const data = await getPublicAuction(Number(auctionId))
        setAuction(data)
        setTeams(data.teams || [])
        setCurrentBid(data.current_bid)
        setStatus(data.status)
        timerMode.current = data.timer_mode || 'auto'
        if (data.current_player) setCurrentPlayer(data.current_player)
        if (data.current_team) setCurrentTeam(data.current_team)
      } catch (e: any) {
        toast.error('Failed to load auction')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [auctionId])

  // WebSocket as spectator
  useEffect(() => {
    if (!auctionId) return
    const ws = new WebSocket(`${WS_BASE}/ws/auction/${auctionId}?mode=spectator`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'state') {
        setCurrentBid(msg.current_bid)
        setStatus(msg.status)
        if (msg.current_player) setCurrentPlayer(msg.current_player)
        if (msg.current_team) setCurrentTeam(msg.current_team)
        else setCurrentTeam(null)
        if (msg.timer_mode) timerMode.current = msg.timer_mode
        if (msg.timer_seconds && msg.status === 'live' && timerMode.current === 'auto') { setTimer(msg.timer_seconds); startCountdown() }
      } else if (msg.type === 'next_player') {
        setCurrentBid(msg.current_bid)
        setStatus(msg.status)
        if (msg.current_player) setCurrentPlayer(msg.current_player)
        setCurrentTeam(null)
        if (msg.timer_mode) timerMode.current = msg.timer_mode
        if (timerMode.current === 'auto') { setTimer(msg.timer_seconds); startCountdown() }
      } else if (msg.type === 'bid_update') {
        setCurrentBid(msg.amount)
        setCurrentTeam({ id: msg.team_id, name: msg.team_name, short_name: msg.team_short } as TeamData)
        if (timerMode.current === 'auto') { setTimer(msg.timer_seconds); startCountdown() }
      } else if (msg.type === 'sold') {
        setCurrentBid(msg.price || 0)
        setStatus(msg.status)
        setSoldAmount(msg.price || 0)
        setSoldTeam({ id: msg.team_id, name: msg.team_name, short_name: msg.team_short } as TeamData)
        setSoldOverlay('sold')
        fireConfetti()
        soundBoard.playSound('gavel')
        setTimeout(() => { setSoldOverlay(null); setSoldTeam(null) }, 3000)
        if (msg.current_player) {
          setCurrentPlayer(msg.current_player)
          setCurrentTeam(null)
          setCurrentBid(msg.current_bid)
          if (timerMode.current === 'auto') { setTimer(auction?.timer_seconds || 30); startCountdown() }
        }
      } else if (msg.type === 'unsold') {
        setStatus(msg.status)
        setSoldOverlay('unsold')
        soundBoard.playSound('unsold')
        setTimeout(() => setSoldOverlay(null), 2500)
        if (msg.current_player) {
          setCurrentPlayer(msg.current_player)
          setCurrentTeam(null)
          setCurrentBid(msg.current_bid)
          if (timerMode.current === 'auto') { setTimer(auction?.timer_seconds || 30); startCountdown() }
        }
      } else if (msg.type === 'play_sound') {
        soundBoard.playSound(msg.sound_key)
      }
    }

    return () => { ws.close(); stopCountdown() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, auction?.timer_seconds, setTimer, startCountdown, stopCountdown])

  // Timer auto-start
  useEffect(() => {
    if (status === 'live' && timerMode.current === 'auto' && timerValue.current > 0 && !timerInterval.current) startCountdown()
    if (status !== 'live') stopCountdown()
  }, [status, startCountdown, stopCountdown])

  const currentTimerValue = timerValue.current
  const currentTimerMax = timerMax.current
  const spectatorUrl = `${window.location.origin}/watch/${auctionId}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(spectatorUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
          <div className="text-gray-400 text-sm font-display tracking-wider">LOADING AUCTION...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 text-white relative overflow-hidden noise-bg">
      {/* Top bar — spectator mode indicator */}
      <div className="bg-surface-1/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-display text-lg md:text-2xl tracking-wide truncate">{auction?.name || 'AUCTION'}</h1>
          <motion.span
            key={status}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
              status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : status === 'rtm_pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}
          >
            {status}
          </motion.span>
          <span className="text-xs text-gray-600 bg-surface-2 px-2 py-1 rounded-lg font-medium">SPECTATOR</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors"
            title="Copy spectator link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            onClick={() => setShowQR(!showQR)}
            className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors"
            title="Show QR code"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">QR</span>
          </button>
        </div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-1 rounded-2xl p-8 flex flex-col items-center gap-4 border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between w-full">
                <h3 className="font-display text-lg tracking-wide">Share Spectator Link</h3>
                <button onClick={() => setShowQR(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG value={spectatorUrl} size={200} />
              </div>
              <p className="text-gray-400 text-sm text-center">{spectatorUrl}</p>
              <button onClick={handleCopyLink} className="bg-accent-gold text-black px-4 py-2 rounded-xl font-medium hover:bg-amber-400 transition-colors flex items-center gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOLD/UNSOLD Overlay */}
      <AnimatePresence>
        {soldOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-40 pointer-events-none flex items-center justify-center ${
              soldOverlay === 'sold' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}
          >
            {soldOverlay === 'sold' && (
              <>
                <motion.div initial={{ scale: 0.5, opacity: 0.8 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} className="absolute w-40 h-40 rounded-full border-2 border-green-400/40" />
                <motion.div initial={{ scale: 0.5, opacity: 0.6 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }} className="absolute w-40 h-40 rounded-full border border-green-400/20" />
              </>
            )}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col items-center"
            >
                  {soldOverlay === 'sold' && <Gavel className="w-16 h-16 text-amber-400 mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />}
              <span className={`font-display text-8xl tracking-wider ${
                soldOverlay === 'sold'
                  ? 'text-green-400 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]'
                  : 'text-red-400 drop-shadow-[0_0_60px_rgba(239,68,68,0.5)]'
              }`}>
                {soldOverlay === 'sold' ? 'SOLD!' : 'REMAINED UNSOLD'}
              </span>
              {soldOverlay === 'sold' && soldTeam && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl text-amber-400 font-medium mt-2"
                >
                  {soldTeam.short_name || soldTeam.name} — {formatPrice(soldAmount)}
                </motion.span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Center: Player + Bid */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {currentPlayer ? (
            <motion.div
              key={currentPlayer.id}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="text-center"
            >
              <div className="text-gray-400 text-sm mb-2 uppercase tracking-widest">
                {currentPlayer.role} — {currentPlayer.country}
              </div>
              <h2 className="font-display text-4xl md:text-6xl tracking-wide text-white mb-2">{currentPlayer.name}</h2>
              <div className="text-gray-500 text-sm mb-6">Base: {formatPrice(currentPlayer.base_price)}</div>

              <div className="glass-strong rounded-3xl px-14 py-8 inline-block">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
                <motion.div
                  key={currentBid}
                  initial={{ scale: 1.05, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
                  className="text-6xl font-bold gradient-text"
                >
                  {formatPrice(currentBid)}
                </motion.div>
                {currentTeam && (
                  <div className="mt-3 text-amber-400 font-semibold text-lg">
                    {currentTeam.name} {currentTeam.short_name ? `(${currentTeam.short_name})` : ''}
                  </div>
                )}
              </div>

              {/* Timer */}
              {timerMode.current !== 'off' && status === 'live' && (
                <div className="mt-8 flex justify-center">
                  <TimerCircle seconds={currentTimerValue} maxSeconds={currentTimerMax} />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="font-display text-4xl tracking-wider text-gray-500">
                {status === 'waiting' ? 'AUCTION STARTING SOON' : status === 'ended' ? 'AUCTION COMPLETE' : 'NEXT PLAYER'}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Sidebar: Team budgets (tier-based, no exact amounts) */}
        <div className="w-full lg:w-72 bg-surface-1/30 backdrop-blur-lg border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col overflow-hidden py-4 px-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Teams</h3>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {teams.map(team => {
              const isLeading = currentTeam?.id === team.id
              const tier = team.budget_tier || 'unknown'
              return (
                <div
                  key={team.id}
                  className={`rounded-xl p-2.5 border transition-all ${isLeading ? 'bg-amber-400/10 border-amber-400/30' : 'bg-surface-2/30 border-white/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-semibold text-sm ${isLeading ? 'text-amber-400' : 'text-gray-300'}`}>
                        {team.short_name || team.name}
                      </div>
                    </div>
                    {isLeading ? (
                      <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">
                        BIDDING
                      </span>
                    ) : (
                      <span className={`inline-block w-2 h-2 rounded-full ${TIER_COLORS[tier]}`} title={`Budget: ${tier}`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-white/5 p-3">
            <div className="text-xs text-gray-600">{auction?.sold_count || 0}/{auction?.total_players || 0} sold</div>
          </div>
        </div>
      </div>
    </div>
  )
}
