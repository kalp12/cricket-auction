import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Settings, Play, Pause, SkipForward, Check, X, Keyboard,
  Shuffle, Bell, BellOff, Gavel, ExternalLink, Volume2, VolumeX, Timer, TimerOff, TrendingUp
} from 'lucide-react'
import { getAuction, getPlayers, getTeams, getSlabs, startAuctionById, nextPlayer, soldPlayer, unsoldPlayer, pauseAuction, resumeAuction, triggerSound } from '../api'
import { useSoundBoard, type SoundKey } from '../hooks/useSoundBoard'
import { EmptyState } from '../components/ui'
import { notify, areNotificationsEnabled, setNotificationsEnabled, requestNotificationPermission, isNotificationSupported } from '../notifications'
import toast from 'react-hot-toast'

interface Team {
  id: number
  name: string
  short_name: string
  remaining_budget: number
  total_budget: number
  logo_url?: string
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

const SOUND_BUTTONS: { key: SoundKey; label: string; icon: string; color: string }[] = [
  { key: 'gavel', label: 'Gavel', icon: '🔨', color: 'from-amber-600 to-amber-500' },
  { key: 'celebration', label: 'Celebrate', icon: '🎉', color: 'from-purple-600 to-purple-500' },
  { key: 'unsold', label: 'Buzzer', icon: '🔇', color: 'from-rose-600 to-rose-500' },
  { key: 'timer', label: 'Alarm', icon: '⏰', color: 'from-blue-600 to-blue-500' },
]

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
  const [showSoundBoard, setShowSoundBoard] = useState(false)

  const currentPlayerRef = useRef(currentPlayer)
  currentPlayerRef.current = currentPlayer

  const toggleNotifications = async () => {
    if (!notificationsOn) {
      const perm = await requestNotificationPermission()
      if (perm === 'granted') { setNotificationsEnabled(true); setNotificationsOn(true) }
    } else { setNotificationsEnabled(false); setNotificationsOn(false) }
  }

  // Timer state
  const timerValue = useRef(0)
  const timerMax = useRef(30)
  const [, forceUpdate] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)

  const setTimer = useCallback((seconds: number) => {
    timerValue.current = seconds; timerMax.current = seconds; forceUpdate(n => n + 1)
  }, [])

  const startCountdown = useCallback(() => {
    if (timerInterval.current) clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
      if (timerValue.current > 0) { timerValue.current -= 1; forceUpdate(n => n + 1) }
      else { if (timerInterval.current) clearInterval(timerInterval.current); timerInterval.current = null; notify('Timer Expired', `${currentPlayerRef.current?.name || 'Player'} — no more bids`, 'timer-expired') }
    }, 1000)
  }, [])

  const stopCountdown = useCallback(() => {
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null }
  }, [])

  useEffect(() => { return () => { stopCountdown() } }, [stopCountdown])

  // Build shortcut key map
  const keyMap = useRef<Record<string, Team>>({})

  const buildKeyMap = useCallback((teamsList: Team[]) => {
    const map: Record<string, Team> = {}
    const usedKeys = new Set<string>()
    for (const team of teamsList) {
      let key = getTeamKey(team)
      if (usedKeys.has(key)) { for (const ch of team.name.toUpperCase()) { if (!usedKeys.has(ch) && /[A-Z]/.test(ch)) { key = ch; break } } }
      usedKeys.add(key); map[key] = team
    }
    keyMap.current = map
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!auctionId) return
    try {
      const [auctionData, teamsData, slabsData, playersData] = await Promise.all([
        getAuction(Number(auctionId)), getTeams(Number(auctionId)), getSlabs(Number(auctionId)), getPlayers(Number(auctionId)),
      ])
      setAuction(auctionData); setTeams(teamsData); setSlabs(slabsData)
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

  // WebSocket connection
  useEffect(() => {
    if (!auctionId) return
    fetchData()

    const ws = new WebSocket(`ws://localhost:8000/ws/auction/${auctionId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'bid_update') {
        setCurrentBid(msg.amount); setCurrentTeamId(msg.team_id)
        const timerMode = auction?.timer_mode || 'auto'
        if (timerMode === 'auto') { const newTimer = msg.timer_seconds || 30; setTimer(newTimer); startCountdown() }
        bidIdCounter.current += 1
        setBidEvents(prev => [{
          team_name: msg.team_name, team_short: msg.team_short || msg.team_name?.substring(0, 3).toUpperCase() || '',
          amount: msg.amount, id: bidIdCounter.current,
        }, ...prev].slice(0, 10))
      } else if (msg.type === 'sold') {
        setBidEvents([]); setCurrentBid(msg.price || 0); setStatus(msg.status || 'live')
        notify('SOLD!', `${currentPlayerRef.current?.name || 'Player'} sold to ${msg.team_name || 'team'} for ${formatPrice(msg.price || currentBid)}`, `sold-${currentPlayerRef.current?.id || Date.now()}`)
        fetchData()
      } else if (msg.type === 'unsold') {
        setBidEvents([]); setCurrentBid(msg.current_bid || 0); setStatus(msg.status || 'live')
        notify('UNSOLD', `${currentPlayerRef.current?.name || 'Player'} goes unsold`, `unsold-${currentPlayerRef.current?.id || Date.now()}`)
        fetchData()
      } else if (msg.type === 'next_player') {
        setBidEvents([]); setCurrentBid(msg.current_bid); setCurrentTeamId(null)
        setStatus(msg.status)
        if (msg.current_player) { setCurrentPlayer(msg.current_player) }
        if (msg.timer_mode === 'auto') { const newTimer = msg.timer_seconds || auction?.timer_seconds || 30; setTimer(newTimer); startCountdown() }
      } else if (msg.type === 'state') {
        setCurrentBid(msg.current_bid); setCurrentTeamId(msg.current_team_id); setStatus(msg.status)
        if (msg.current_player) setCurrentPlayer(msg.current_player)
        if (msg.timer_mode) { /* timer_mode from state */ }
        if (msg.timer_seconds && msg.status === 'live' && (auction?.timer_mode || 'auto') === 'auto') { setTimer(msg.timer_seconds); startCountdown() }
        fetchData()
      }
    }

    return () => { ws.close(); stopCountdown() }
  }, [auctionId, fetchData, setTimer, startCountdown, stopCountdown, auction?.timer_seconds, currentBid, auction?.timer_mode])

  // Start countdown when auction goes live (auto mode)
  useEffect(() => {
    const timerMode = auction?.timer_mode || 'auto'
    if (status === 'live' && timerMode === 'auto' && timerValue.current > 0 && !timerInterval.current) startCountdown()
    if (status !== 'live') stopCountdown()
  }, [status, auction?.timer_mode, startCountdown, stopCountdown])

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
    try { await startAuctionById(Number(auctionId)); await fetchData(); toast.success('Auction started') }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed to start') }
  }

  const handleNextPlayer = async () => {
    if (!auctionId) return
    try {
      await nextPlayer(Number(auctionId))
      setBidEvents([])
      const timerMode = auction?.timer_mode || 'auto'
      if (timerMode === 'auto') { const newTimer = auction?.timer_seconds || 30; setTimer(newTimer); startCountdown() }
      await fetchData()
      toast.success('Next player selected')
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleSold = async () => {
    if (!auctionId) return
    try {
      const res = await soldPlayer(Number(auctionId))
      setBidEvents([]); setCurrentBid(res.current_bid || 0); setStatus(res.status || 'live')
      notify('SOLD!', `${currentPlayer?.name || 'Player'} sold for ${formatPrice(currentBid)}`, `sold-${currentPlayer?.id || Date.now()}`)
      const timerMode = auction?.timer_mode || 'auto'
      if (res.status === 'live' && timerMode === 'auto') { const t = auction?.timer_seconds || 30; setTimer(t); startCountdown() }
      else { stopCountdown(); timerValue.current = 0 }
      await fetchData()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleUnsold = async () => {
    if (!auctionId) return
    try {
      const res = await unsoldPlayer(Number(auctionId))
      setBidEvents([]); setCurrentBid(res.current_bid || 0); setStatus(res.status || 'live')
      notify('UNSOLD', `${currentPlayer?.name || 'Player'} goes unsold`, `unsold-${currentPlayer?.id || Date.now()}`)
      const timerMode = auction?.timer_mode || 'auto'
      if (res.status === 'live' && timerMode === 'auto') { const t = auction?.timer_seconds || 30; setTimer(t); startCountdown() }
      else { stopCountdown(); timerValue.current = 0 }
      await fetchData()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handlePause = async () => {
    if (!auctionId) return
    try { await pauseAuction(Number(auctionId)); stopCountdown(); setStatus('paused'); toast('Auction paused', { icon: '⏸️' }) }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleResume = async () => {
    if (!auctionId) return
    try {
      await resumeAuction(Number(auctionId)); setStatus('live')
      const timerMode = auction?.timer_mode || 'auto'
      if (timerMode === 'auto' && timerValue.current > 0) startCountdown()
      else if (timerMode === 'auto') { const t = auction?.timer_seconds || 30; setTimer(t); startCountdown() }
      toast.success('Auction resumed')
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  // Manual timer controls
  const handleStartTimer = () => {
    const t = auction?.timer_seconds || 30
    if (timerValue.current <= 0) setTimer(t)
    startCountdown()
  }

  const handleResetTimer = () => {
    stopCountdown()
    const t = auction?.timer_seconds || 30
    setTimer(t)
  }

  // Sound board
  const soundBoard = useSoundBoard(auction)
  const handleTriggerSound = async (key: SoundKey) => {
    soundBoard.playSound(key)
    if (auctionId) {
      try { await triggerSound(Number(auctionId), key) } catch { /* overlay will get it via WS */ }
    }
  }

  const unsoldPlayers = allPlayers.filter(p => p.status === 'unsold')
  const soldCount = allPlayers.filter(p => p.status === 'sold').length
  const leadingTeam = teams.find(t => t.id === currentTeamId)
  const nextBidAmount = currentBid > 0 ? getNextBid(currentBid, slabs) : (currentPlayer?.base_price || auction?.base_bid || 0)
  const currentTimerValue = timerValue.current
  const timerMode = auction?.timer_mode || 'auto'

  const bidIdCounter = useRef(0)

  return (
    <div className="min-h-screen bg-surface-0 text-white relative overflow-hidden noise-bg">
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
          <span className="text-sm text-gray-500">{soldCount}/{allPlayers.length} sold</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Open Overlay button */}
          <button
            onClick={() => window.open(`/overlay/${auctionId}`, '_blank', 'width=1920,height=1080')}
            className="text-gray-500 hover:text-accent-gold flex items-center gap-1 text-sm transition-colors"
            title="Open Broadcast Overlay"
          >
            <ExternalLink className="w-4 h-4" /> Overlay
          </button>
          <button
            onClick={() => setShowSoundBoard(!showSoundBoard)}
            className={showSoundBoard ? 'text-accent-gold hover:text-amber-300 flex items-center gap-1 text-sm' : 'text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors'}
          >
            <Volume2 className="w-4 h-4" /> Sounds
          </button>
          <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors">
            <Keyboard className="w-4 h-4" /> Keys
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

      {/* Error bar */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 px-4 py-2 text-sm text-center">
          {error} <button onClick={() => setError('')} className="ml-2 text-rose-400 font-bold">×</button>
        </motion.div>
      )}

      {/* Sound Board Panel */}
      <AnimatePresence>
        {showSoundBoard && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-surface-1/60 backdrop-blur-xl border-b border-white/5 overflow-hidden"
          >
            <div className="px-6 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-500 font-display tracking-widest mr-2">SOUND BOARD</span>
              {SOUND_BUTTONS.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => handleTriggerSound(btn.key)}
                  className={`bg-gradient-to-r ${btn.color} hover:brightness-110 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg transition-all`}
                >
                  <span>{btn.icon}</span> {btn.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Main: Current player + controls */}
        <div className="flex-1 flex flex-col">
          {/* Player info area */}
          <div className="flex-1 flex items-center justify-center">
            {currentPlayer ? (
              <motion.div
                key={currentPlayer.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="text-center"
              >
                <div className="text-gray-500 text-sm mb-1 uppercase tracking-widest">
                  {currentPlayer.role} — {currentPlayer.country}
                </div>
                <h2 className="font-display text-5xl tracking-wide text-white mb-1">{currentPlayer.name}</h2>
                <div className="text-gray-600 text-sm mb-4">Base: {formatPrice(currentPlayer.base_price)}</div>

                {/* Bid display */}
                <div className="glass-strong rounded-2xl px-10 py-6 inline-block">
                  <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
                  <motion.div
                    key={currentBid}
                    initial={{ scale: 1.3, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
                    className="text-5xl font-bold gradient-text"
                  >
                    {formatPrice(currentBid)}
                  </motion.div>
                  {leadingTeam && (
                    <div className="mt-2 text-accent-gold font-semibold">{leadingTeam.name} ({leadingTeam.short_name})</div>
                  )}
                  <div className="mt-1 text-gray-600 text-sm">Next: {formatPrice(nextBidAmount)}</div>
                </div>

                {/* Timer display */}
                {timerMode !== 'off' && status === 'live' && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
                        <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                        <circle
                          cx="64" cy="64" r="54" fill="none"
                          stroke={currentTimerValue <= 5 ? '#ef4444' : currentTimerValue <= 10 ? '#f59e0b' : '#3b82f6'}
                          strokeWidth="5"
                          strokeDasharray={2 * Math.PI * 54}
                          strokeDashoffset={2 * Math.PI * 54 * (1 - (timerMax.current > 0 ? currentTimerValue / timerMax.current : 0))}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-linear"
                        />
                      </svg>
                      <span className={`text-xl font-mono font-bold ${currentTimerValue <= 5 ? 'text-red-400' : currentTimerValue <= 10 ? 'text-yellow-400' : 'text-blue-400'}`}>
                        {currentTimerValue}
                      </span>
                    </div>
                    {/* Manual timer controls */}
                    {timerMode === 'manual' && (
                      <div className="flex flex-col gap-1">
                        <button onClick={handleStartTimer} className="text-xs bg-emerald-600/80 hover:bg-emerald-600 px-2 py-1 rounded-lg flex items-center gap-1"><Play className="w-3 h-3" /> Start</button>
                        <button onClick={handleResetTimer} className="text-xs bg-surface-3 hover:bg-surface-4 px-2 py-1 rounded-lg flex items-center gap-1"><TimerOff className="w-3 h-3" /> Reset</button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : status === 'live' ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="text-gray-600 text-xl mb-4">No player selected</div>
                <motion.button onClick={handleNextPlayer} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto shadow-lg shadow-primary-600/20">
                  <Shuffle className="w-5 h-5" /> Random Player
                </motion.button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="text-gray-600 text-xl mb-4">Auction not started</div>
                <motion.button onClick={handleStart} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto shadow-lg shadow-emerald-600/20">
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
              <motion.button onClick={handleNextPlayer} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-surface-3 hover:bg-surface-4 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-colors border border-white/5">
                <Shuffle className="w-4 h-4" /> Next
              </motion.button>
              <motion.button onClick={handleSold} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                <Gavel className="w-4 h-4" /> SOLD
              </motion.button>
              <motion.button onClick={handleUnsold} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20">
                <X className="w-4 h-4" /> UNSOLD
              </motion.button>
              <motion.button onClick={handlePause} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-amber-600/80 hover:bg-amber-600 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-colors">
                <Pause className="w-4 h-4" /> Pause
              </motion.button>
            </motion.div>
          )}
          {status === 'paused' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface-1/60 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex items-center justify-center gap-3">
              <motion.button onClick={handleResume} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                <Play className="w-4 h-4" /> Resume
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Sidebar: Teams + Bid History */}
        <div className="w-80 bg-surface-1/40 backdrop-blur-lg border-l border-white/5 flex flex-col overflow-hidden">
          {/* Team cards — clickable for bidding */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 dark-scrollbar">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Teams — Click to Bid</h3>
            </div>
            {teams.map(team => {
              const key = Object.entries(keyMap.current).find(([_, t]) => t.id === team.id)?.[0]
              const isLeading = team.id === currentTeamId
              const budgetPct = team.total_budget > 0 ? Math.round((team.remaining_budget / team.total_budget) * 100) : 0
              return (
                <motion.button
                  key={team.id}
                  layout
                  onClick={() => {
                    if (status === 'live' && wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'bid', team_id: team.id, auto: true }))
                    }
                  }}
                  disabled={status !== 'live'}
                  animate={isLeading ? { scale: 1.02 } : { scale: 1 }}
                  className={`w-full rounded-xl p-3 border text-left transition-all duration-300 ${
                    isLeading
                      ? 'bg-accent-gold/10 border-accent-gold/30 glow-gold'
                      : 'bg-surface-2/50 border-white/5 hover:bg-surface-3/50 hover:border-white/10'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {showShortcuts && key && (
                        <kbd className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border ${
                          isLeading ? 'bg-accent-gold/20 border-accent-gold/40 text-accent-gold' : 'bg-surface-3 border-white/10 text-gray-400'
                        }`}>{key}</kbd>
                      )}
                      <div>
                        <div className={`font-semibold text-sm ${isLeading ? 'text-accent-gold' : 'text-gray-300'}`}>
                          {team.short_name || team.name}
                        </div>
                        <div className="text-xs text-gray-600">{formatPrice(team.remaining_budget)}</div>
                      </div>
                    </div>
                    {isLeading && (
                      <span className="text-xs bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-lg font-semibold">LEADING</span>
                    )}
                  </div>
                  <div className="mt-2 h-1 bg-surface-4 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isLeading ? 'bg-accent-gold' : 'bg-primary-500'}`} style={{ width: `${budgetPct}%` }} />
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Bid History */}
          <div className="border-t border-white/5 p-3 max-h-40 overflow-y-auto dark-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bid History</h3>
            {bidEvents.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No bids yet" message="Waiting for the first bid..." className="py-2" />
            ) : (
              <div className="space-y-1">
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
          <div className="border-t border-white/5 p-3">
            <div className="text-xs text-gray-600">{unsoldPlayers.length} unsold players remaining</div>
          </div>
        </div>
      </div>
    </div>
  )
}
