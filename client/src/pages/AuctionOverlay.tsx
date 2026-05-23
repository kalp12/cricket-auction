import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Gavel } from 'lucide-react'
import { useSoundBoard } from '../hooks/useSoundBoard'

interface PlayerData {
  id: number
  name: string
  role: string
  country: string
  base_price: number
  image_url?: string
  matches?: number
  runs?: number
  wickets?: number
  batting_avg?: number
  batting_sr?: number
  bowling_avg?: number
  bowling_econ?: number
}

interface TeamData {
  id: number
  name: string
  short_name?: string
  logo_url?: string
  remaining_budget?: number
  total_budget?: number
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
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

function TimerCircle({ seconds, maxSeconds }: { seconds: number; maxSeconds: number }) {
  const radius = 54
  const stroke = 5
  const circumference = 2 * Math.PI * radius
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 0
  const offset = circumference * (1 - progress)
  const color = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx="59" cy="59" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
      </svg>
      <motion.div key={seconds} initial={{ scale: 1.3, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }} className={`text-3xl font-mono font-bold ${seconds <= 5 ? 'text-red-400' : seconds <= 10 ? 'text-yellow-400' : 'text-blue-400'}`}>
        {seconds}
      </motion.div>
    </div>
  )
}

function SponsorSlot({ src, position }: { src?: string; position: string }) {
  const posClasses: Record<string, string> = {
    'top-left': 'top-6 left-6',
    'top-right': 'top-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-6 right-6',
  }
  if (!src) return null
  const url = src.startsWith('http') ? src : `http://localhost:8000${src}`
  return (
    <div className={`absolute ${posClasses[position]} z-10`}>
      <img src={url} alt="Sponsor" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ maxHeight: 60, maxWidth: 120 }} />
    </div>
  )
}

export default function AuctionOverlay() {
  const { auctionId } = useParams<{ auctionId: string }>()
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
  const [fetchError, setFetchError] = useState('')

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
      if (timerValue.current > 0) {
        timerValue.current -= 1
        forceUpdate(n => n + 1)
        // Play timer alarm sound when < 5s
        if (timerValue.current <= 5 && timerValue.current > 0) {
          soundBoard.playSound('timer')
        }
      } else {
        if (timerInterval.current) clearInterval(timerInterval.current)
        timerInterval.current = null
      }
    }, 1000)
  }, [soundBoard])

  const stopCountdown = useCallback(() => {
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null }
  }, [])

  useEffect(() => { return () => { stopCountdown() } }, [stopCountdown])

  // Fetch initial data (only once, then rely on WebSocket)
  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      setLoading(true)
      setFetchError('')
      try {
        const token = localStorage.getItem('token')
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const [auctionRes, teamsRes] = await Promise.all([
          fetch(`http://localhost:8000/api/auctions/${auctionId}`, { headers }),
          fetch(`http://localhost:8000/api/teams?auction_id=${auctionId}`, { headers }),
        ])
        const auctionData = await auctionRes.json()
        const teamsData = await teamsRes.json()
        setAuction(auctionData)
        setTeams(teamsData)
        setCurrentBid(auctionData.current_bid)
        setStatus(auctionData.status)
        timerMode.current = auctionData.timer_mode || 'auto'

        if (auctionData.current_player_id) {
          const pRes = await fetch(`http://localhost:8000/api/auction/state?auction_id=${auctionId}`, { headers })
          const state = await pRes.json()
          if (state.current_player) setCurrentPlayer(state.current_player)
          if (auctionData.current_team_id) {
            const t = teamsData.find((tm: TeamData) => tm.id === auctionData.current_team_id)
            setCurrentTeam(t || null)
          }
        }
      } catch (e: any) {
        console.error('Overlay fetch error:', e)
        setFetchError(e?.message || 'Failed to load auction data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [auctionId])

  // WebSocket
  useEffect(() => {
    if (!auctionId) return

    const ws = new WebSocket(`ws://localhost:8000/ws/auction/${auctionId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'state') {
        setCurrentBid(msg.current_bid)
        setStatus(msg.status)
        if (msg.timer_mode) timerMode.current = msg.timer_mode
        if (msg.current_player) setCurrentPlayer(msg.current_player)
        if (msg.current_team) setCurrentTeam(msg.current_team)
        else setCurrentTeam(null)
        if (msg.timer_seconds && msg.status === 'live' && timerMode.current === 'auto') {
          setTimer(msg.timer_seconds)
          startCountdown()
        }
      }

      else if (msg.type === 'next_player') {
        setCurrentBid(msg.current_bid)
        setStatus(msg.status)
        setCurrentPlayer(msg.current_player)
        setCurrentTeam(null)
        if (msg.timer_mode) timerMode.current = msg.timer_mode
        if (timerMode.current === 'auto') {
          setTimer(msg.timer_seconds)
          startCountdown()
        }
      }

      else if (msg.type === 'bid_update') {
        setCurrentBid(msg.amount)
        const t = teams.find(tm => tm.id === msg.team_id)
        setCurrentTeam({ id: msg.team_id, name: msg.team_name, short_name: msg.team_short } as TeamData)
        if (timerMode.current === 'auto') {
          setTimer(msg.timer_seconds)
          startCountdown()
        }
      }

      else if (msg.type === 'sold') {
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
          if (timerMode.current === 'auto') {
            setTimer(auction?.timer_seconds || 30)
            startCountdown()
          }
        }
      }

      else if (msg.type === 'unsold') {
        setStatus(msg.status)
        setSoldOverlay('unsold')
        soundBoard.playSound('unsold')
        setTimeout(() => setSoldOverlay(null), 2500)

        if (msg.current_player) {
          setCurrentPlayer(msg.current_player)
          setCurrentTeam(null)
          setCurrentBid(msg.current_bid)
          if (timerMode.current === 'auto') {
            setTimer(auction?.timer_seconds || 30)
            startCountdown()
          }
        }
      }

      else if (msg.type === 'play_sound') {
        soundBoard.playSound(msg.sound_key)
      }
    }

    return () => { ws.close(); stopCountdown() }
  }, [auctionId, teams, auction?.timer_seconds, setTimer, startCountdown, stopCountdown, soundBoard])

  // Timer auto-start on live
  useEffect(() => {
    if (status === 'live' && timerMode.current === 'auto' && timerValue.current > 0 && !timerInterval.current) startCountdown()
    if (status !== 'live') stopCountdown()
  }, [status, startCountdown, stopCountdown])

  const currentTimerValue = timerValue.current
  const currentTimerMax = timerMax.current
  const overlayBgUrl = auction?.overlay_bg ? (auction.overlay_bg.startsWith('http') ? auction.overlay_bg : `http://localhost:8000${auction.overlay_bg}`) : null

  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
          <div className="text-gray-400 text-sm font-display tracking-wider">LOADING AUCTION...</div>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="fixed inset-0 bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl font-display tracking-wider mb-2">AUCTION LOAD FAILED</div>
          <div className="text-gray-500 text-sm">{fetchError}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-surface-0 text-white overflow-hidden"
      style={overlayBgUrl ? { backgroundImage: `url(${overlayBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* Background noise overlay */}
      {!overlayBgUrl && <div className="absolute inset-0 noise-bg opacity-30" />}

      {/* Sponsor corners */}
      <SponsorSlot src={auction?.sponsor_tl} position="top-left" />
      <SponsorSlot src={auction?.sponsor_tr} position="top-right" />
      <SponsorSlot src={auction?.sponsor_bl} position="bottom-left" />
      <SponsorSlot src={auction?.sponsor_br} position="bottom-right" />

      {/* SOLD/UNSOLD Overlay */}
      <AnimatePresence>
        {soldOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 z-40 pointer-events-none flex items-center justify-center ${
              soldOverlay === 'sold' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}
          >
            {/* Pulse rings */}
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
              {/* Custom stamp image or text */}
              {soldOverlay === 'sold' && auction?.sold_stamp ? (
                <motion.img
                  initial={{ rotate: -12, scale: 0.5 }}
                  animate={{ rotate: -8, scale: 1 }}
                  src={auction.sold_stamp.startsWith('http') ? auction.sold_stamp : `http://localhost:8000${auction.sold_stamp}`}
                  alt="SOLD"
                  className="max-w-md max-h-48 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]"
                />
              ) : soldOverlay === 'unsold' && auction?.unsold_stamp ? (
                <motion.img
                  initial={{ rotate: -8, scale: 0.5 }}
                  animate={{ rotate: -5, scale: 1 }}
                  src={auction.unsold_stamp.startsWith('http') ? auction.unsold_stamp : `http://localhost:8000${auction.unsold_stamp}`}
                  alt="UNSOLD"
                  className="max-w-md max-h-48 drop-shadow-[0_0_60px_rgba(239,68,68,0.5)]"
                />
              ) : (
                <>
                  {soldOverlay === 'sold' && <Gavel className="w-16 h-16 text-amber-400 mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />}
                  <span className={`font-display text-8xl tracking-wider ${
                    soldOverlay === 'sold'
                      ? 'text-green-400 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]'
                      : 'text-red-400 drop-shadow-[0_0_60px_rgba(239,68,68,0.5)]'
                  }`}>
                    {soldOverlay === 'sold' ? 'SOLD!' : 'REMAINED UNSOLD'}
                  </span>
                </>
              )}
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
      <div className="relative z-10 h-full flex">
        {/* Center: Player Card + Bid Display */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {currentPlayer ? (
            <motion.div
              key={currentPlayer.id}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="text-center"
            >
              {/* Player info */}
              <div className="text-gray-400 text-sm mb-2 uppercase tracking-widest">
                {currentPlayer.role} — {currentPlayer.country}
              </div>
              <h2 className="font-display text-4xl md:text-7xl tracking-wide text-white mb-2 break-words">{currentPlayer.name}</h2>
              <div className="text-gray-500 text-sm mb-6">
                Base Price: {formatPrice(currentPlayer.base_price)}
              </div>

              {/* Bid card */}
              <motion.div layout className="glass-strong rounded-3xl px-14 py-8 inline-block">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
                <motion.div
                  key={currentBid}
                  initial={{ scale: 1.3, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
                  className="text-6xl font-bold gradient-text"
                >
                  {formatPrice(currentBid)}
                </motion.div>
                {currentTeam && (
                  <motion.div
                    key={currentTeam.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-amber-400 font-semibold text-lg"
                  >
                    {currentTeam.name} ({currentTeam.short_name})
                  </motion.div>
                )}
              </motion.div>

              {/* Timer */}
              {timerMode.current !== 'off' && status === 'live' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex justify-center"
                >
                  <TimerCircle seconds={currentTimerValue} maxSeconds={currentTimerMax} />
                </motion.div>
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

        {/* Right Sidebar: Team Budgets */}
        <div className="w-56 md:w-72 bg-surface-1/30 backdrop-blur-lg border-l border-white/5 flex flex-col overflow-hidden py-4 px-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Teams</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {teams.map(team => {
              const isLeading = currentTeam?.id === team.id
              const budgetPct = team.total_budget && team.total_budget > 0
                ? Math.round(((team.remaining_budget ?? 0) / team.total_budget) * 100) : 0
              return (
                <motion.div
                  key={team.id}
                  layout
                  animate={isLeading ? { scale: 1.02 } : { scale: 1 }}
                  className={`rounded-xl p-2.5 border transition-all duration-300 ${
                    isLeading
                      ? 'bg-amber-400/10 border-amber-400/30 glow-gold'
                      : 'bg-surface-2/30 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-semibold text-sm ${isLeading ? 'text-amber-400' : 'text-gray-300'}`}>
                        {team.short_name || team.name}
                      </div>
                      <div className="text-xs text-gray-600">{formatPrice(team.remaining_budget ?? 0)}</div>
                    </div>
                    {isLeading && (
                      <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">
                        BIDDING
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-0.5 bg-surface-4 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isLeading ? 'bg-amber-400' : 'bg-blue-500'}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Lower third banner */}
          {auction?.lower_third_banner && (
            <div className="mt-3 px-1">
              <img
                src={auction.lower_third_banner.startsWith('http') ? auction.lower_third_banner : `http://localhost:8000${auction.lower_third_banner}`}
                alt="Banner"
                className="w-full rounded-lg opacity-80"
                style={{ maxHeight: 50, objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
