import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, Play, Pause, SkipForward, Check, X, Keyboard } from 'lucide-react'
import { getAuction, getPlayers, getTeams, getSlabs, startAuctionById, nextPlayer, soldPlayer, unsoldPlayer, pauseAuction, resumeAuction } from '../api'

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
  const [timer, setTimer] = useState(0)
  const [status, setStatus] = useState('waiting')
  const [error, setError] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(true)

  // Build a map of shortcut key -> team
  const keyMap = useRef<Record<string, Team>>({})

  const buildKeyMap = useCallback((teamsList: Team[]) => {
    const map: Record<string, Team> = {}
    const usedKeys = new Set<string>()
    for (const team of teamsList) {
      let key = getTeamKey(team)
      if (usedKeys.has(key)) {
        // Try second letter of name
        for (const ch of team.name.toUpperCase()) {
          if (!usedKeys.has(ch) && /[A-Z]/.test(ch)) {
            key = ch
            break
          }
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
      setTimer(auctionData.timer_seconds)

      // Find current player
      if (auctionData.current_player_id) {
        const p = (playersData.players || playersData).find((pl: any) => pl.id === auctionData.current_player_id)
        setCurrentPlayer(p || null)
      }

      buildKeyMap(teamsData)
    } catch (e) {
      console.error(e)
    }
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
        setCurrentBid(msg.amount)
        setCurrentTeamId(msg.team_id)
        setTimer(msg.timer_seconds)
        setBidEvents(prev => [{
          team_name: msg.team_name,
          team_short: msg.team_name?.substring(0, 3).toUpperCase() || '',
          amount: msg.amount,
        }, ...prev].slice(0, 10))
      } else if (msg.type === 'sold' || msg.type === 'unsold') {
        setBidEvents([])
        setCurrentBid(msg.current_bid || 0)
        setStatus(msg.status || 'live')
        fetchData()
      } else if (msg.type === 'state') {
        setCurrentBid(msg.current_bid)
        setCurrentTeamId(msg.current_team_id)
        setTimer(msg.timer_seconds)
        setStatus(msg.status)
        fetchData()
      }
    }

    return () => { ws.close() }
  }, [auctionId, fetchData])

  // Timer countdown
  useEffect(() => {
    if (status !== 'live' || timer <= 0) return
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [status, timer])

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

      const key = e.key.toUpperCase()
      const team = keyMap.current[key]
      if (team && status === 'live' && wsRef.current?.readyState === WebSocket.OPEN) {
        const nextAmount = getNextBid(currentBid, slabs)
        wsRef.current.send(JSON.stringify({
          type: 'bid',
          team_id: team.id,
          auto: true,
        }))
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentBid, slabs, status])

  // Actions
  const handleStart = async () => {
    if (!auctionId) return
    try {
      await startAuctionById(Number(auctionId))
      await fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to start')
    }
  }

  const handleNextPlayer = async () => {
    if (!auctionId) return
    try {
      await nextPlayer(Number(auctionId))
      await fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed')
    }
  }

  const handleSold = async () => {
    if (!auctionId) return
    try {
      const res = await soldPlayer(Number(auctionId))
      setBidEvents([])
      setCurrentBid(res.current_bid || 0)
      setStatus(res.status || 'live')
      await fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed')
    }
  }

  const handleUnsold = async () => {
    if (!auctionId) return
    try {
      const res = await unsoldPlayer(Number(auctionId))
      setBidEvents([])
      setCurrentBid(res.current_bid || 0)
      setStatus(res.status || 'live')
      await fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed')
    }
  }

  const handlePause = async () => {
    if (!auctionId) return
    try {
      await pauseAuction(Number(auctionId))
      setStatus('paused')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed')
    }
  }

  const handleResume = async () => {
    if (!auctionId) return
    try {
      await resumeAuction(Number(auctionId))
      setStatus('live')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed')
    }
  }

  const unsoldPlayers = allPlayers.filter(p => p.status === 'unsold')
  const soldCount = allPlayers.filter(p => p.status === 'sold').length
  const leadingTeam = teams.find(t => t.id === currentTeamId)
  const nextBidAmount = currentBid > 0 ? getNextBid(currentBid, slabs) : (currentPlayer?.base_price || auction?.base_bid || 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white" onKeyDown={e => e.key}>
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/auctions/${auctionId}`)} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{auction?.name || 'Auction'}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            status === 'live' ? 'bg-green-500 text-white' :
            status === 'paused' ? 'bg-yellow-500 text-black' :
            'bg-gray-600 text-gray-300'
          }`}>
            {status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
            <Keyboard className="w-4 h-4" /> Shortcuts
          </button>
          <button onClick={() => navigate(`/auctions/${auctionId}/settings`)} className="text-gray-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-300 px-4 py-2 text-sm text-center">
          {error} <button onClick={() => setError('')} className="ml-2 text-red-400">x</button>
        </div>
      )}

      <div className="flex h-[calc(100vh-56px)]">
        {/* Main Auction Area */}
        <div className="flex-1 flex flex-col">
          {/* Current Player / Bid Display */}
          <div className="flex-1 flex items-center justify-center">
            {currentPlayer ? (
              <div className="text-center">
                <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">
                  {currentPlayer.role} — {currentPlayer.country}
                </div>
                <h2 className="text-5xl font-bold mb-3">{currentPlayer.name}</h2>
                <div className="text-gray-500 text-sm mb-4">
                  Base Price: {formatPrice(currentPlayer.base_price)}
                </div>
                <div className="bg-gray-800 rounded-2xl px-12 py-6 inline-block">
                  <div className="text-sm text-gray-400 mb-1">Current Bid</div>
                  <div className="text-5xl font-bold text-green-400">
                    {formatPrice(currentBid)}
                  </div>
                  {leadingTeam && (
                    <div className="mt-2 text-yellow-400 font-medium">
                      {leadingTeam.name} ({leadingTeam.short_name})
                    </div>
                  )}
                  <div className="mt-2 text-gray-500 text-sm">
                    Next bid: {formatPrice(nextBidAmount)}
                  </div>
                </div>
                {/* Timer */}
                {auction?.timer_enabled && status === 'live' && (
                  <div className={`mt-6 text-4xl font-mono font-bold ${timer <= 10 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
                    {timer}s
                  </div>
                )}
              </div>
            ) : status === 'live' ? (
              <div className="text-center">
                <div className="text-gray-500 text-xl mb-4">No player selected</div>
                <button onClick={handleNextPlayer} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto">
                  <SkipForward className="w-5 h-5" /> Next Player
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-gray-500 text-xl mb-4">Auction not started</div>
                <button onClick={handleStart} className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto">
                  <Play className="w-5 h-5" /> Start Auction
                </button>
              </div>
            )}
          </div>

          {/* Control Bar */}
          {status === 'live' && currentPlayer && (
            <div className="bg-gray-900 border-t border-gray-800 px-6 py-3 flex items-center justify-center gap-3">
              <button onClick={handleNextPlayer} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm">
                <SkipForward className="w-4 h-4" /> Skip
              </button>
              <button onClick={handleSold} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                <Check className="w-4 h-4" /> SOLD
              </button>
              <button onClick={handleUnsold} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                <X className="w-4 h-4" /> UNSOLD
              </button>
              <button onClick={handlePause} className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm">
                <Pause className="w-4 h-4" /> Pause
              </button>
            </div>
          )}
          {status === 'paused' && (
            <div className="bg-gray-900 border-t border-gray-800 px-6 py-3 flex items-center justify-center gap-3">
              <button onClick={handleResume} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                <Play className="w-4 h-4" /> Resume
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: Teams + Keyboard Shortcuts */}
        <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Team Cards with Shortcuts */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Teams</h3>
              <span className="text-xs text-gray-600">{soldCount}/{allPlayers.length} sold</span>
            </div>
            {teams.map(team => {
              const key = Object.entries(keyMap.current).find(([_, t]) => t.id === team.id)?.[0]
              const isLeading = team.id === currentTeamId
              return (
                <div
                  key={team.id}
                  className={`rounded-lg p-3 border transition-all ${
                    isLeading
                      ? 'bg-yellow-900/30 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                      : 'bg-gray-800/50 border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {showShortcuts && key && (
                        <kbd className={`px-2 py-1 rounded text-xs font-mono font-bold border ${
                          isLeading ? 'bg-yellow-800 border-yellow-600 text-yellow-300' : 'bg-gray-700 border-gray-600 text-gray-300'
                        }`}>
                          {key}
                        </kbd>
                      )}
                      <div>
                        <div className={`font-medium text-sm ${isLeading ? 'text-yellow-400' : 'text-gray-200'}`}>
                          {team.short_name || team.name}
                        </div>
                        <div className="text-xs text-gray-500">{formatPrice(team.remaining_budget)}</div>
                      </div>
                    </div>
                    {isLeading && (
                      <div className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-medium">
                        LEADING
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bid History */}
          <div className="border-t border-gray-800 p-4 max-h-48 overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Bid History</h3>
            {bidEvents.length === 0 ? (
              <p className="text-gray-600 text-xs">No bids yet</p>
            ) : (
              <div className="space-y-1">
                {bidEvents.map((evt, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className={i === 0 ? 'text-green-400 font-medium' : 'text-gray-500'}>
                      {evt.team_short || evt.team_name}
                    </span>
                    <span className={i === 0 ? 'text-white font-medium' : 'text-gray-400'}>
                      {formatPrice(evt.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unsold count */}
          <div className="border-t border-gray-800 p-4">
            <div className="text-xs text-gray-500">
              {unsoldPlayers.length} unsold players remaining
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
