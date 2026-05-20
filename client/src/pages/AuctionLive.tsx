import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  ArrowLeft, Settings, Play, Pause, SkipForward, Check, X, Keyboard,
  Shuffle, Bell, BellOff, Gavel
} from 'lucide-react'
import { getAuction, getPlayers, getTeams, getSlabs, startAuctionById, nextPlayer, soldPlayer, unsoldPlayer, pauseAuction, resumeAuction } from '../api'
import { notify, areNotificationsEnabled, setNotificationsEnabled, requestNotificationPermission, isNotificationSupported } from '../notifications'

interface Team {
  id: number
  name: string
  short_name: string
  remaining_budget: number
  total_budget: number
}

interface Slab {
  min_price: number
  max_price: number
  increment: number
}

interface BidEvent {
  team_name: string
  team_short: string
  amount: number
  id: number
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const getNextBid = (currentBid: number, slabs: Slab[]): number => {
  for (const slab of slabs) {
    if (slab.min_price <= currentBid && currentBid < slab.max_price) {
      return currentBid + slab.increment
    }
  }
  return currentBid + (slabs[slabs.length - 1]?.increment || 1000000)
}

const getTeamKey = (team: Team): string => {
  if (team.short_name) return team.short_name[0].toUpperCase()
  return team.name[0].toUpperCase()
}

// Fire confetti burst
const fireConfetti = () => {
  const duration = 1500
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'],
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()

  // Big center burst
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'],
    startVelocity: 45,
  })
}

// Circular progress timer component
function TimerCircle({ seconds, maxSeconds }: { seconds: number; maxSeconds: number }) {
  const radius = 58
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 0
  const offset = circumference * (1 - progress)

  const color = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <motion.div
        key={seconds}
        initial={{ scale: 1.3, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`text-4xl font-mono font-bold ${seconds <= 5 ? 'text-red-400 animate-count-urgent' : seconds <= 10 ? 'text-yellow-400' : 'text-blue-400'}`}
      >
        {seconds}
      </motion.div>
    </div>
  )
}

// Gavel component
function GavelAnimation({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
        >
          <motion.div
            animate={{
              rotate: [0, -30, 0, -15, 0, -8, 0],
              y: [0, 8, 0, 4, 0, 2, 0],
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-9xl"
          >
            <Gavel className="w-32 h-32 text-accent-gold drop-shadow-[0_0_40px_rgba(251,191,36,0.5)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Sponsor corner slot
function SponsorSlot({ src, position }: { src?: string; position: string }) {
  const posClasses: Record<string, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  if (!src) return null

  return (
    <div className={`absolute ${posClasses[position]} sponsor-slot z-10`}>
      <img
        src={src.startsWith('http') ? src : `http://localhost:8000${src}`}
        alt="Sponsor"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}

export default function AuctionLive() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)

  const [auction, setAuction] = useState<any>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [slabs, setSlabs] = useState<Slab[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [bidEvents, setBidEvents] = useState<BidEvent[]>([])
  const [currentBid, setCurrentBid] = useState(0)
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<any>(null)
  const [status, setStatus] = useState('waiting')
  const [error, setError] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(true)
  const [notificationsOn, setNotificationsOn] = useState(areNotificationsEnabled())

  // Animation state
  const [soldOverlay, setSoldOverlay] = useState<'sold' | 'unsold' | null>(null)
  const [showGavel, setShowGavel] = useState(false)
  const bidIdCounter = useRef(0)

  const currentPlayerRef = useRef(currentPlayer)
  currentPlayerRef.current = currentPlayer

  const toggleNotifications = async () => {
    if (!notificationsOn) {
      const perm = await requestNotificationPermission()
      if (perm === 'granted') {
        setNotificationsEnabled(true)
        setNotificationsOn(true)
      }
    } else {
      setNotificationsEnabled(false)
      setNotificationsOn(false)
    }
  }

  // Timer state
  const timerValue = useRef(0)
  const timerMax = useRef(30)
  const [, forceUpdate] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)

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
      } else {
        if (timerInterval.current) clearInterval(timerInterval.current)
        timerInterval.current = null
        notify('Timer Expired', `${currentPlayerRef.current?.name || 'Player'} — no more bids`, 'timer-expired')
      }
    }, 1000)
  }, [])

  const stopCountdown = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
  }, [])

  useEffect(() => { return () => { stopCountdown() } }, [stopCountdown])

  // Build shortcut key map
  const keyMap = useRef<Record<string, Team>>({})

  const buildKeyMap = useCallback((teamsList: Team[]) => {
    const map: Record<string, Team> = {}
    const usedKeys = new Set<string>()
    for (const team of teamsList) {
      let key = getTeamKey(team)
      if (usedKeys.has(key)) {
        for (const ch of team.name.toUpperCase()) {
          if (!usedKeys.has(ch) && /[A-Z]/.test(ch)) { key = ch; break }
        }
      }
      usedKeys.add(key)
      map[key] = team
    }
    keyMap.current = map
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!auctionId) return
    try {
      const [auctionData, teamsData, slabsData, playersData] = await Promise.all([
        getAuction(Number(auctionId)),
        getTeams(Number(auctionId)),
        getSlabs(Number(auctionId)),
        getPlayers(Number(auctionId)),
      ])
      setAuction(auctionData)
      setTeams(teamsData)
      setSlabs(slabsData)
      setAllPlayers(playersData.players || playersData)
      setCurrentBid(auctionData.current_bid)
      setCurrentTeamId(auctionData.current_team_id)
      setStatus(auctionData.status)

      if (auctionData.current_player_id) {
        const p = (playersData.players || playersData).find((pl: any) => pl.id === auctionData.current_player_id)
        setCurrentPlayer(p || null)
      }

      buildKeyMap(teamsData)
    } catch (e) { console.error(e) }
  }, [auctionId, buildKeyMap])

  const triggerSoldEffect = (eventType: 'sold' | 'unsold') => {
    setSoldOverlay(eventType)
    if (eventType === 'sold') {
      fireConfetti()
      setShowGavel(true)
      setTimeout(() => setShowGavel(false), 2000)
    }
    setTimeout(() => setSoldOverlay(null), eventType === 'sold' ? 2500 : 1500)
  }

  // WebSocket connection
  useEffect(() => {
    if (!auctionId) return
    fetchData()

    const ws = new WebSocket(`ws://localhost:8000/ws/auction/${auctionId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'bid_update') {
        setCurrentBid(msg.amount)
        setCurrentTeamId(msg.team_id)
        const newTimer = msg.timer_seconds || 30
        setTimer(newTimer)
        startCountdown()
        bidIdCounter.current += 1
        setBidEvents(prev => [{
          team_name: msg.team_name,
          team_short: msg.team_name?.substring(0, 3).toUpperCase() || '',
          amount: msg.amount,
          id: bidIdCounter.current,
        }, ...prev].slice(0, 10))
      } else if (msg.type === 'sold') {
        setBidEvents([])
        setCurrentBid(msg.current_bid || 0)
        setStatus(msg.status || 'live')
        triggerSoldEffect('sold')
        notify('SOLD!', `${currentPlayerRef.current?.name || 'Player'} sold to ${msg.team_name || 'team'} for ${formatPrice(msg.amount || currentBid)}`, `sold-${currentPlayerRef.current?.id || Date.now()}`)
        if (msg.status === 'live' && msg.current_player_id) {
          const newTimer = auction?.timer_seconds || 30
          setTimer(newTimer); startCountdown()
        } else { stopCountdown(); timerValue.current = 0 }
        fetchData()
      } else if (msg.type === 'unsold') {
        setBidEvents([])
        setCurrentBid(msg.current_bid || 0)
        setStatus(msg.status || 'live')
        triggerSoldEffect('unsold')
        notify('UNSOLD', `${currentPlayerRef.current?.name || 'Player'} goes unsold`, `unsold-${currentPlayerRef.current?.id || Date.now()}`)
        if (msg.status === 'live' && msg.current_player_id) {
          const newTimer = auction?.timer_seconds || 30
          setTimer(newTimer); startCountdown()
        } else { stopCountdown(); timerValue.current = 0 }
        fetchData()
      } else if (msg.type === 'state') {
        setCurrentBid(msg.current_bid)
        setCurrentTeamId(msg.current_team_id)
        setStatus(msg.status)
        if (msg.timer_seconds && msg.status === 'live') { setTimer(msg.timer_seconds) }
        fetchData()
      }
    }

    return () => { ws.close(); stopCountdown() }
  }, [auctionId, fetchData, setTimer, startCountdown, stopCountdown, auction?.timer_seconds, currentBid])

  // Start countdown when auction goes live
  useEffect(() => {
    if (status === 'live' && auction?.timer_enabled && timerValue.current > 0 && !timerInterval.current) startCountdown()
    if (status !== 'live') stopCountdown()
  }, [status, auction?.timer_enabled, startCountdown, stopCountdown])

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      const key = e.key.toUpperCase()
      const team = keyMap.current[key]
      if (team && status === 'live' && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'bid', team_id: team.id, auto: true }))
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status])

  // Actions
  const handleStart = async () => {
    if (!auctionId) return
    try { await startAuctionById(Number(auctionId)); await fetchData() }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed to start') }
  }

  const handleNextPlayer = async () => {
    if (!auctionId) return
    try {
      await nextPlayer(Number(auctionId))
      setBidEvents([])
      const newTimer = auction?.timer_seconds || 30
      setTimer(newTimer); startCountdown()
      await fetchData()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleSold = async () => {
    if (!auctionId) return
    try {
      const res = await soldPlayer(Number(auctionId))
      setBidEvents([])
      setCurrentBid(res.current_bid || 0)
      setStatus(res.status || 'live')
      triggerSoldEffect('sold')
      notify('SOLD!', `${currentPlayer?.name || 'Player'} sold for ${formatPrice(currentBid)}`, `sold-${currentPlayer?.id || Date.now()}`)
      if (res.status === 'live') { const t = auction?.timer_seconds || 30; setTimer(t); startCountdown() }
      else { stopCountdown(); timerValue.current = 0 }
      await fetchData()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleUnsold = async () => {
    if (!auctionId) return
    try {
      const res = await unsoldPlayer(Number(auctionId))
      setBidEvents([])
      setCurrentBid(res.current_bid || 0)
      setStatus(res.status || 'live')
      triggerSoldEffect('unsold')
      notify('UNSOLD', `${currentPlayer?.name || 'Player'} goes unsold`, `unsold-${currentPlayer?.id || Date.now()}`)
      if (res.status === 'live') { const t = auction?.timer_seconds || 30; setTimer(t); startCountdown() }
      else { stopCountdown(); timerValue.current = 0 }
      await fetchData()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handlePause = async () => {
    if (!auctionId) return
    try { await pauseAuction(Number(auctionId)); stopCountdown(); setStatus('paused') }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleResume = async () => {
    if (!auctionId) return
    try {
      await resumeAuction(Number(auctionId)); setStatus('live')
      if (auction?.timer_enabled && timerValue.current > 0) startCountdown()
      else { const t = auction?.timer_seconds || 30; setTimer(t); startCountdown() }
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const unsoldPlayers = allPlayers.filter(p => p.status === 'unsold')
  const soldCount = allPlayers.filter(p => p.status === 'sold').length
  const leadingTeam = teams.find(t => t.id === currentTeamId)
  const nextBidAmount = currentBid > 0 ? getNextBid(currentBid, slabs) : (currentPlayer?.base_price || auction?.base_bid || 0)
  const currentTimerValue = timerValue.current
  const currentTimerMax = timerMax.current

  return (
    <div className="min-h-screen bg-surface-0 text-white relative overflow-hidden noise-bg">
      {/* Sold/Unsold overlay */}
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
                <motion.div
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="absolute w-40 h-40 rounded-full border-2 border-green-400/40"
                />
                <motion.div
                  initial={{ scale: 0.5, opacity: 0.6 }}
                  animate={{ scale: 4, opacity: 0 }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
                  className="absolute w-40 h-40 rounded-full border border-green-400/20"
                />
              </>
            )}

            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col items-center"
            >
              {soldOverlay === 'sold' && (
                <Gavel className="w-16 h-16 text-accent-gold mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
              )}
              <span className={`font-display text-8xl tracking-wider ${
                soldOverlay === 'sold'
                  ? 'text-green-400 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]'
                  : 'text-red-400 drop-shadow-[0_0_60px_rgba(239,68,68,0.5)]'
              }`}>
                {soldOverlay === 'sold' ? 'SOLD!' : 'UNSOLD'}
              </span>
              {soldOverlay === 'sold' && leadingTeam && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl text-accent-gold font-medium mt-2"
                >
                  {leadingTeam.short_name || leadingTeam.name} — {formatPrice(currentBid)}
                </motion.span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gavel overlay */}
      <GavelAnimation show={showGavel} />

      {/* Sponsor corners */}
      {auction && (
        <>
          <SponsorSlot src={auction.sponsor_tl} position="top-left" />
          <SponsorSlot src={auction.sponsor_tr} position="top-right" />
          <SponsorSlot src={auction.sponsor_bl} position="bottom-left" />
          <SponsorSlot src={auction.sponsor_br} position="bottom-right" />
        </>
      )}

      {/* Top Bar */}
      <div className="bg-surface-1/80 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/auctions/${auctionId}`)} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-2xl tracking-wide">{auction?.name || 'AUCTION'}</h1>
          <motion.span
            key={status}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
              status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}
          >
            {status}
          </motion.span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors">
            <Keyboard className="w-4 h-4" /> Shortcuts
          </button>
          {isNotificationSupported() && (
            <button onClick={toggleNotifications} className={notificationsOn ? 'text-accent-gold hover:text-amber-300 flex items-center gap-1 text-sm' : 'text-gray-600 hover:text-gray-400 flex items-center gap-1 text-sm'}>
              {notificationsOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          )}
          <button onClick={() => navigate(`/auctions/${auctionId}/settings`)} className="text-gray-500 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 px-4 py-2 text-sm text-center"
        >
          {error} <button onClick={() => setError('')} className="ml-2 text-rose-400 font-bold">×</button>
        </motion.div>
      )}

      <div className="flex h-[calc(100vh-56px)]">
        {/* Main Auction Area */}
        <div className="flex-1 flex flex-col relative">
          {/* Current Player / Bid Display */}
          <div className="flex-1 flex items-center justify-center">
            {currentPlayer ? (
              <motion.div
                key={currentPlayer.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="text-center"
              >
                <div className="text-gray-500 text-sm mb-2 uppercase tracking-widest">
                  {currentPlayer.role} — {currentPlayer.country}
                </div>
                <h2 className="font-display text-7xl tracking-wide text-white mb-2">{currentPlayer.name}</h2>
                <div className="text-gray-600 text-sm mb-6">
                  Base Price: {formatPrice(currentPlayer.base_price)}
                </div>

                {/* Bid card */}
                <motion.div
                  layout
                  className="glass-strong rounded-3xl px-14 py-8 inline-block"
                >
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
                  {leadingTeam && (
                    <motion.div
                      key={leadingTeam.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 text-accent-gold font-semibold text-lg"
                    >
                      {leadingTeam.name} ({leadingTeam.short_name})
                    </motion.div>
                  )}
                  <div className="mt-2 text-gray-600 text-sm">
                    Next bid: {formatPrice(nextBidAmount)}
                  </div>
                </motion.div>

                {/* Timer */}
                {auction?.timer_enabled && status === 'live' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 flex justify-center"
                  >
                    <TimerCircle seconds={currentTimerValue} maxSeconds={currentTimerMax} />
                  </motion.div>
                )}
              </motion.div>
            ) : status === 'live' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="text-gray-600 text-xl mb-4">No player selected</div>
                <motion.button
                  onClick={handleNextPlayer}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto shadow-lg shadow-primary-600/20"
                >
                  <Shuffle className="w-5 h-5" /> Random Player
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="text-gray-600 text-xl mb-4">Auction not started</div>
                <motion.button
                  onClick={handleStart}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto shadow-lg shadow-emerald-600/20"
                >
                  <Play className="w-5 h-5" /> Start Auction
                </motion.button>
              </motion.div>
            )}
          </div>

          {/* Control Bar */}
          {status === 'live' && currentPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-1/60 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex items-center justify-center gap-4"
            >
              <motion.button
                onClick={handleNextPlayer}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-surface-3 hover:bg-surface-4 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-colors border border-white/5"
              >
                <Shuffle className="w-4 h-4" /> Next
              </motion.button>
              <motion.button
                onClick={handleSold}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Gavel className="w-4 h-4" /> SOLD
              </motion.button>
              <motion.button
                onClick={handleUnsold}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20"
              >
                <X className="w-4 h-4" /> UNSOLD
              </motion.button>
              <motion.button
                onClick={handlePause}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-amber-600/80 hover:bg-amber-600 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-colors"
              >
                <Pause className="w-4 h-4" /> Pause
              </motion.button>
            </motion.div>
          )}
          {status === 'paused' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-surface-1/60 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex items-center justify-center gap-3"
            >
              <motion.button
                onClick={handleResume}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-4 h-4" /> Resume
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-surface-1/40 backdrop-blur-lg border-l border-white/5 flex flex-col overflow-hidden">
          {/* Team Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 dark-scrollbar">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Teams</h3>
              <span className="text-xs text-gray-600">{soldCount}/{allPlayers.length} sold</span>
            </div>
            {teams.map(team => {
              const key = Object.entries(keyMap.current).find(([_, t]) => t.id === team.id)?.[0]
              const isLeading = team.id === currentTeamId
              const budgetPct = team.total_budget > 0 ? Math.round((team.remaining_budget / team.total_budget) * 100) : 0
              return (
                <motion.div
                  key={team.id}
                  layout
                  animate={isLeading ? { scale: 1.02 } : { scale: 1 }}
                  className={`rounded-xl p-3 border transition-all duration-300 ${
                    isLeading
                      ? 'bg-accent-gold/10 border-accent-gold/30 glow-gold'
                      : 'bg-surface-2/50 border-white/5 hover:bg-surface-3/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {showShortcuts && key && (
                        <kbd className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border ${
                          isLeading ? 'bg-accent-gold/20 border-accent-gold/40 text-accent-gold' : 'bg-surface-3 border-white/10 text-gray-400'
                        }`}>
                          {key}
                        </kbd>
                      )}
                      <div>
                        <div className={`font-semibold text-sm ${isLeading ? 'text-accent-gold' : 'text-gray-300'}`}>
                          {team.short_name || team.name}
                        </div>
                        <div className="text-xs text-gray-600">{formatPrice(team.remaining_budget)}</div>
                      </div>
                    </div>
                    {isLeading && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-xs bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-lg font-semibold"
                      >
                        LEADING
                      </motion.span>
                    )}
                  </div>
                  {/* Budget bar */}
                  <div className="mt-2 h-1 bg-surface-4 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isLeading ? 'bg-accent-gold' : 'bg-primary-500'}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Bid History */}
          <div className="border-t border-white/5 p-4 max-h-48 overflow-y-auto dark-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Bid History</h3>
            {bidEvents.length === 0 ? (
              <p className="text-gray-700 text-xs">No bids yet</p>
            ) : (
              <div className="space-y-1.5">
                {bidEvents.map((evt, i) => (
                  <motion.div
                    key={evt.id}
                    initial={i === 0 ? { opacity: 0, x: 20 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center justify-between text-xs ${i === 0 ? 'text-white' : 'text-gray-500'}`}
                  >
                    <span className={i === 0 ? 'font-semibold' : ''}>{evt.team_short || evt.team_name}</span>
                    <span className={`font-mono ${i === 0 ? 'font-bold text-accent-gold' : ''}`}>{formatPrice(evt.amount)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Unsold count */}
          <div className="border-t border-white/5 p-4">
            <div className="text-xs text-gray-600">
              {unsoldPlayers.length} unsold players remaining
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
