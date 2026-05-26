import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, Gauge, Trophy } from 'lucide-react'
import { getAuctionReplay, getAuction } from '../api'

interface ReplayEvent {
  id: number
  event_type: string
  data: Record<string, any>
  snapshot: Record<string, any> | null
  timestamp: string
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const SPEEDS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
]

const EVENT_LABELS: Record<string, string> = {
  start: 'Auction Started',
  bid: 'Bid Placed',
  sold: 'SOLD!',
  unsold: 'UNSOLD',
  pause: 'Paused',
  resume: 'Resumed',
  next_player: 'Next Player',
  end: 'Auction Ended',
}

const EVENT_COLORS: Record<string, string> = {
  start: 'text-blue-400',
  bid: 'text-amber-400',
  sold: 'text-green-400',
  unsold: 'text-red-400',
  pause: 'text-yellow-400',
  resume: 'text-blue-400',
  next_player: 'text-purple-400',
  end: 'text-gray-400',
}

export default function AuctionReplay() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<any>(null)
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(true)
  const playbackRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!auctionId) return
    const loadData = async () => {
      try {
        const [auctionData, replayData] = await Promise.all([
          getAuction(Number(auctionId)),
          getAuctionReplay(Number(auctionId)),
        ])
        setAuction(auctionData)
        setEvents(replayData)
      } catch (e) {
        console.error('Failed to load replay', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [auctionId])

  const currentEvent = events[currentIndex] || null
  const snapshot = currentEvent?.snapshot || null

  // Playback logic
  useEffect(() => {
    if (!playing || events.length === 0) return

    const getTimeToNext = () => {
      if (currentIndex >= events.length - 1) {
        setPlaying(false)
        return 3000 // stop after last
      }
      const cur = new Date(events[currentIndex].timestamp).getTime()
      const next = new Date(events[currentIndex + 1].timestamp).getTime()
      const delta = Math.max(next - cur, 200) // min 200ms between events
      return delta / speed
    }

    const delay = getTimeToNext()
    playbackRef.current = setTimeout(() => {
      if (currentIndex < events.length - 1) {
        setCurrentIndex(i => i + 1)
      } else {
        setPlaying(false)
      }
    }, Math.min(delay, 5000)) // cap at 5s

    return () => {
      if (playbackRef.current) clearTimeout(playbackRef.current)
    }
  }, [playing, currentIndex, events, speed])

  const handlePlay = () => {
    if (currentIndex >= events.length - 1) setCurrentIndex(0)
    setPlaying(true)
  }
  const handlePause = () => setPlaying(false)
  const handleStep = (delta: number) => {
    setPlaying(false)
    setCurrentIndex(i => Math.max(0, Math.min(events.length - 1, i + delta)))
  }
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false)
    setCurrentIndex(Number(e.target.value))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen bg-surface-0 text-white flex flex-col items-center justify-center gap-4">
        <Trophy className="w-12 h-12 text-gray-600" />
        <h1 className="font-display text-2xl tracking-wide text-gray-500">NO REPLAY DATA</h1>
        <p className="text-gray-600 text-sm">Events will be recorded when the auction runs live.</p>
        <button onClick={() => navigate(-1)} className="text-accent-gold hover:underline text-sm">Go Back</button>
      </div>
    )
  }

  const player = snapshot?.current_player
  const team = snapshot?.current_team
  const currentBid = snapshot?.current_bid ?? 0
  const auctionStatus = snapshot?.status ?? 'waiting'

  return (
    <div className="min-h-screen bg-surface-0 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="font-display text-lg tracking-wide">{auction?.name || 'Auction'} — Replay</h1>
        <span className="text-sm text-gray-500">Event {currentIndex + 1} / {events.length}</span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Center: Replay board */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {player ? (
            <motion.div
              key={player.id + '-' + currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="text-gray-400 text-sm mb-2 uppercase tracking-widest">
                {player.role} — {player.country}
              </div>
              <h2 className="font-display text-4xl md:text-6xl tracking-wide text-white mb-2">{player.name}</h2>
              <div className="text-gray-500 text-sm mb-6">Base Price: {formatPrice(player.base_price)}</div>

              <div className="glass-strong rounded-3xl px-14 py-8 inline-block">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
                <motion.div
                  key={currentBid}
                  initial={{ scale: 1.3, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-6xl font-bold gradient-text"
                >
                  {formatPrice(currentBid)}
                </motion.div>
                {team && (
                  <div className="mt-3 text-amber-400 font-semibold text-lg">
                    {team.name} {team.short_name ? `(${team.short_name})` : ''}
                  </div>
                )}
              </div>

              {/* Event badge */}
              {currentEvent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1 }}
                  className={`mt-6 inline-block px-4 py-2 rounded-xl glass-strong text-sm font-bold ${EVENT_COLORS[currentEvent.event_type] || 'text-white'}`}
                >
                  {EVENT_LABELS[currentEvent.event_type] || currentEvent.event_type}
                  {currentEvent.event_type === 'sold' && currentEvent.data.price && ` — ${formatPrice(currentEvent.data.price)}`}
                  {currentEvent.event_type === 'bid' && currentEvent.data.amount && ` — ${formatPrice(currentEvent.data.amount)}`}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="text-center">
              <div className="font-display text-4xl tracking-wider text-gray-500">
                {auctionStatus === 'ended' ? 'AUCTION COMPLETE' : auctionStatus === 'waiting' ? 'WAITING TO START' : 'NEXT PLAYER'}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: Team budgets */}
        <div className="w-56 md:w-72 bg-surface-1/30 backdrop-blur-lg border-l border-white/5 flex flex-col overflow-hidden py-4 px-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Teams</h3>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {(snapshot?.teams || []).map((t: any) => {
              const isLeading = team?.id === t.id
              const budgetPct = t.total_budget > 0 ? Math.round((t.remaining_budget / t.total_budget) * 100) : 0
              return (
                <div
                  key={t.id}
                  className={`rounded-xl p-2.5 border transition-all ${
                    isLeading ? 'bg-amber-400/10 border-amber-400/30' : 'bg-surface-2/30 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-semibold text-sm ${isLeading ? 'text-amber-400' : 'text-gray-300'}`}>
                        {t.short_name || t.name}
                      </div>
                      <div className="text-xs text-gray-600">{formatPrice(t.remaining_budget)}</div>
                    </div>
                    {isLeading && (
                      <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">
                        BIDDING
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-0.5 bg-surface-4 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isLeading ? 'bg-amber-400' : 'bg-blue-500'}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="border-t border-white/5 bg-surface-0/90 backdrop-blur-lg px-6 py-4">
        {/* Timeline scrubber */}
        <div className="mb-3">
          <input
            type="range"
            min={0}
            max={events.length - 1}
            value={currentIndex}
            onChange={handleScrub}
            className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent-gold"
          />
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>Start</span>
            <span>End</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => handleStep(-1)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>

          {playing ? (
            <button onClick={handlePause} className="p-3 rounded-xl bg-accent-gold text-black hover:bg-amber-400 transition-colors">
              <Pause className="w-6 h-6" />
            </button>
          ) : (
            <button onClick={handlePlay} className="p-3 rounded-xl bg-accent-gold text-black hover:bg-amber-400 transition-colors">
              <Play className="w-6 h-6" />
            </button>
          )}

          <button onClick={() => handleStep(1)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1 ml-4 border-l border-white/10 pl-4">
            <Gauge className="w-4 h-4 text-gray-500 mr-1" />
            {SPEEDS.map(s => (
              <button
                key={s.value}
                onClick={() => setSpeed(s.value)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  speed === s.value ? 'bg-accent-gold text-black' : 'text-gray-500 hover:bg-white/10 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
