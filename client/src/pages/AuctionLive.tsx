import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getAuction, getPlayers, getTeams, getSlabs,
  startAuctionById, nextPlayer, soldPlayer, unsoldPlayer,
  pauseAuction, resumeAuction, triggerSound, rtmAccept, rtmDecline
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useSoundBoard, type SoundKey } from '../hooks/useSoundBoard'
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket'
import { Skeleton, SkeletonLine, SkeletonCircle } from '../components/ui'
import SoldOverlay from '../components/auction/SoldOverlay'
import AuctionTopBar from '../components/auction/AuctionTopBar'
import RtmPrompt from '../components/auction/RtmPrompt'
import PlayerPanel from '../components/auction/PlayerPanel'
import TeamSidebar from '../components/auction/TeamSidebar'
import { formatPrice, getNextBid, fireConfetti, buildKeyMap } from '../utils/auction'
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

const SOUND_BUTTONS: { key: SoundKey; label: string; icon: string; color: string }[] = [
  { key: 'gavel', label: 'Gavel', icon: '🔨', color: 'from-amber-600 to-amber-500' },
  { key: 'celebration', label: 'Celebrate', icon: '🎉', color: 'from-purple-600 to-purple-500' },
  { key: 'unsold', label: 'Buzzer', icon: '🔇', color: 'from-rose-600 to-rose-500' },
  { key: 'timer', label: 'Alarm', icon: '⏰', color: 'from-blue-600 to-blue-500' },
]

export default function AuctionLive() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const { canEdit } = useAuth()
  const [shareCopied, setShareCopied] = useState(false)

  // Static data (fetched once on mount)
  const [auction, setAuction] = useState<any>(null)
  const [teamList, setTeamList] = useState<Team[]>([])
  const [slabs, setSlabs] = useState<Slab[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // UI toggles
  const [showShortcuts, setShowShortcuts] = useState(true)
  const [notificationsOn, setNotificationsOn] = useState(areNotificationsEnabled())
  const [showSoundBoard, setShowSoundBoard] = useState(false)
  const [bidEvents, setBidEvents] = useState<BidEvent[]>([])
  const bidIdCounter = useRef(0)

  // Keyboard shortcut map
  const keyMap = useRef<Record<string, Team>>({})

  // WebSocket hook — manages all real-time state
  const ws = useAuctionWebSocket({
    auctionId,
    initialAuction: auction,
    initialTeams: teamList,
    timerSeconds: auction?.timer_seconds || 30,
  })

  // Sound board
  const soundBoard = useSoundBoard(auction)
  const handleTriggerSound = async (key: SoundKey) => {
    soundBoard.playSound(key)
    if (auctionId) {
      try { await triggerSound(Number(auctionId), key) } catch { /* overlay gets it via WS */ }
    }
  }

  // ── Initial data fetch (once) ──
  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const [auctionData, teamsData, slabsData, playersData] = await Promise.all([
          getAuction(Number(auctionId)), getTeams(Number(auctionId)),
          getSlabs(Number(auctionId)), getPlayers(Number(auctionId)),
        ])
        setAuction(auctionData)
        setTeamList(teamsData)
        setSlabs(slabsData)
        setAllPlayers(playersData.players || playersData)
        keyMap.current = buildKeyMap(teamsData)
        // Seed WS hook with initial values
        ws.setCurrentBid(auctionData.current_bid)
        ws.setCurrentTeamId(auctionData.current_team_id)
        ws.setStatus(auctionData.status)
        ws.updateTeams(teamsData)
        if (auctionData.current_player_id) {
          const p = (playersData.players || playersData).find((pl: any) => pl.id === auctionData.current_player_id)
          ws.setCurrentPlayer(p || null)
        } else {
          ws.setCurrentPlayer(null)
        }
        if (auctionData.timer_seconds) ws.setTimer(auctionData.timer_seconds)
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || 'Failed to load auction data'
        setError(msg)
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId])

  // Fire effects on sold/unsold overlay changes
  const prevOverlayRef = useRef(ws.soldOverlay)
  useEffect(() => {
    if (ws.soldOverlay && !prevOverlayRef.current) {
      if (ws.soldOverlay.type === 'sold') {
        fireConfetti()
        soundBoard.playSound('gavel')
        notify('SOLD!', `${ws.soldOverlay.playerName} sold to ${ws.soldOverlay.teamName || 'team'} for ${formatPrice(ws.soldOverlay.price || 0)}`, `sold-${Date.now()}`)
      } else {
        soundBoard.playSound('unsold')
        notify('UNSOLD', `${ws.soldOverlay.playerName} goes unsold`, `unsold-${Date.now()}`)
      }
      setBidEvents([])
    }
    prevOverlayRef.current = ws.soldOverlay
  }, [ws.soldOverlay, soundBoard])

  // ── Keyboard shortcuts ──
  const statusRef = useRef(ws.status)
  statusRef.current = ws.status
  const lastBidTimeRef = useRef<Record<number, number>>({})
  const handleNextPlayerButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canEdit) return
      if (e.repeat) return
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') return
      const key = e.key.toUpperCase()
      if (key === 'R') {
        e.preventDefault()
        handleNextPlayerButtonRef.current?.click()
        return
      }
      const team = keyMap.current[key]
      if (team && statusRef.current === 'live' && ws.wsRef.current?.readyState === WebSocket.OPEN) {
        const now = Date.now()
        if (now - (lastBidTimeRef.current[team.id] || 0) < 500) return
        lastBidTimeRef.current[team.id] = now
        ws.wsRef.current.send(JSON.stringify({ type: 'bid', team_id: team.id, auto: true }))
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Track bid events from currentBid changes ──
  const prevBidRef = useRef(ws.currentBid)
  const prevTeamIdRef = useRef(ws.currentTeamId)
  useEffect(() => {
    if (ws.currentBid > 0 && ws.currentBid !== prevBidRef.current && ws.currentTeamId && ws.status === 'live') {
      const team = teamList.find(t => t.id === ws.currentTeamId)
      if (team) {
        bidIdCounter.current += 1
        setBidEvents(prev => [{
          team_name: team.name,
          team_short: team.short_name || team.name.substring(0, 3).toUpperCase(),
          amount: ws.currentBid,
          id: bidIdCounter.current,
        }, ...prev].slice(0, 10))
      }
    }
    prevBidRef.current = ws.currentBid
    prevTeamIdRef.current = ws.currentTeamId
  }, [ws.currentBid, ws.currentTeamId, ws.status, teamList])

  // ── Actions ──
  const handleStart = async () => {
    if (!auctionId) return
    try { await startAuctionById(Number(auctionId)); toast.success('Auction started') }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed to start') }
  }

  const handleNextPlayer = async (playerId?: number) => {
    if (!auctionId) return
    try {
      await nextPlayer(Number(auctionId), playerId)
      setBidEvents([])
      if ((auction?.timer_mode || 'auto') === 'auto') {
        ws.setTimer(auction?.timer_seconds || 30)
        ws.startCountdown()
      }
      toast.success('Next player selected')
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleSold = async () => {
    if (!auctionId) return
    try {
      const res = await soldPlayer(Number(auctionId))
      setBidEvents([])
      ws.setStatus(res.status || 'live')
      ws.stopCountdown()
      // Show overlay locally (WS will also send, but overlay guard prevents double)
      if (!ws.overlayActiveRef.current) {
        ws.overlayActiveRef.current = true
        ws.setSoldOverlay({
          type: 'sold',
          playerName: ws.currentPlayer?.name || 'Player',
          teamName: res.team,
          price: res.price,
        })
        setTimeout(() => {
          ws.setSoldOverlay(null)
          ws.overlayActiveRef.current = false
          ws.setCurrentPlayer(null)
          ws.setCurrentBid(0)
          ws.setCurrentTeamId(null)
        }, 3000)
      }
      notify('SOLD!', `${ws.currentPlayer?.name || 'Player'} sold for ${formatPrice(ws.currentBid)}`, `sold-${Date.now()}`)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleUnsold = async () => {
    if (!auctionId) return
    try {
      const res = await unsoldPlayer(Number(auctionId))
      setBidEvents([])
      ws.setStatus(res.status || 'live')
      ws.stopCountdown()
      if (!ws.overlayActiveRef.current) {
        ws.overlayActiveRef.current = true
        ws.setSoldOverlay({
          type: 'unsold',
          playerName: ws.currentPlayer?.name || 'Player',
        })
        setTimeout(() => {
          ws.setSoldOverlay(null)
          ws.overlayActiveRef.current = false
          ws.setCurrentPlayer(null)
          ws.setCurrentBid(0)
          ws.setCurrentTeamId(null)
        }, 2500)
      }
      notify('UNSOLD', `${ws.currentPlayer?.name || 'Player'} goes unsold`, `unsold-${Date.now()}`)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleRtmAccept = async () => {
    if (!auctionId) return
    try {
      ws.setRtmPrompt(null)
      const res = await rtmAccept(Number(auctionId))
      setBidEvents([])
      ws.setCurrentBid(0)
      ws.setStatus(res.status || 'live')
      ws.stopCountdown()
      toast.success('RTM accepted! Player goes to previous team')
      if (!ws.overlayActiveRef.current) {
        ws.overlayActiveRef.current = true
        ws.setSoldOverlay({
          type: 'sold',
          playerName: ws.rtmPrompt?.playerName || 'Player',
          teamName: ws.rtmPrompt?.rtmTeamName,
          teamShort: ws.rtmPrompt?.rtmTeamShort,
          price: ws.rtmPrompt?.price,
        })
        setTimeout(() => {
          ws.setSoldOverlay(null)
          ws.overlayActiveRef.current = false
          ws.setCurrentPlayer(null)
          ws.setCurrentTeamId(null)
        }, 3000)
      }
    } catch (e: any) { setError(e?.response?.data?.detail || 'RTM failed'); ws.setRtmPrompt(null) }
  }

  const handleRtmDecline = async () => {
    if (!auctionId) return
    try {
      ws.setRtmPrompt(null)
      const res = await rtmDecline(Number(auctionId))
      setBidEvents([])
      ws.setCurrentBid(0)
      ws.setStatus(res.status || 'live')
      ws.stopCountdown()
      toast('RTM declined — player sold to winning bidder', { icon: '➡️' })
      if (!ws.overlayActiveRef.current) {
        ws.overlayActiveRef.current = true
        ws.setSoldOverlay({
          type: 'sold',
          playerName: ws.rtmPrompt?.playerName || 'Player',
          teamName: ws.rtmPrompt?.winningTeamName,
          teamShort: ws.rtmPrompt?.winningTeamShort,
          price: ws.rtmPrompt?.price,
        })
        setTimeout(() => {
          ws.setSoldOverlay(null)
          ws.overlayActiveRef.current = false
          ws.setCurrentPlayer(null)
          ws.setCurrentTeamId(null)
        }, 3000)
      }
    } catch (e: any) { setError(e?.response?.data?.detail || 'RTM failed'); ws.setRtmPrompt(null) }
  }

  const handlePause = async () => {
    if (!auctionId) return
    try { await pauseAuction(Number(auctionId)); ws.stopCountdown(); ws.setStatus('paused'); toast('Auction paused', { icon: '⏸️' }) }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleResume = async () => {
    if (!auctionId) return
    try {
      await resumeAuction(Number(auctionId))
      ws.setStatus('live')
      const tm = auction?.timer_mode || 'auto'
      if (tm === 'auto' && ws.timerValue > 0) ws.startCountdown()
      else if (tm === 'auto') { ws.setTimer(auction?.timer_seconds || 30); ws.startCountdown() }
      toast.success('Auction resumed')
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed') }
  }

  const handleStartTimer = () => { if (ws.timerValue <= 0) ws.setTimer(auction?.timer_seconds || 30); ws.startCountdown() }
  const handleResetTimer = () => { ws.stopCountdown(); ws.setTimer(auction?.timer_seconds || 30) }

  const toggleNotifications = async () => {
    if (!notificationsOn) {
      const perm = await requestNotificationPermission()
      if (perm === 'granted') { setNotificationsEnabled(true); setNotificationsOn(true) }
    } else { setNotificationsEnabled(false); setNotificationsOn(false) }
  }

  // ── Derived state ──
  const timerMode = ws.timerMode || 'auto'
  const leadingTeam = teamList.find(t => t.id === ws.currentTeamId)
  const nextBidAmount = ws.currentBid > 0 ? getNextBid(ws.currentBid, slabs) : (ws.currentPlayer?.base_price || auction?.base_bid || 0)
  const unsoldPlayers = allPlayers.filter(p => p.status === 'unsold')
  const passedCount = allPlayers.filter(p => p.status === 'passed').length
  const soldCount = allPlayers.filter(p => p.status === 'sold').length

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 text-white relative overflow-hidden noise-bg">
        <div className="bg-surface-1/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 min-w-0"><Skeleton className="w-5 h-5" /><Skeleton className="w-32 h-6" /><Skeleton className="w-16 h-5" /></div>
          <div className="flex items-center gap-2 shrink-0"><Skeleton className="w-20 h-5" /><Skeleton className="w-20 h-5" /><Skeleton className="w-8 h-8 !rounded-full" /></div>
        </div>
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-56px)]">
          <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-0 items-center justify-center">
            <div className="text-center space-y-4">
              <Skeleton className="w-48 h-6 mx-auto" /><Skeleton className="w-64 h-10 mx-auto" /><Skeleton className="w-40 h-5 mx-auto" /><Skeleton className="w-56 h-24 mx-auto rounded-2xl mt-8" />
            </div>
          </div>
          <div className="w-full lg:w-80 bg-surface-1/40 backdrop-blur-lg border-t lg:border-t-0 lg:border-l border-white/5 p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3"><SkeletonCircle size="40px" /><div className="flex-1 space-y-2"><SkeletonLine width="60%" height="14px" /><SkeletonLine width="40%" height="12px" /></div></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 text-white relative overflow-hidden noise-bg">
      <AuctionTopBar
        auctionName={auction?.name || ''}
        status={ws.status}
        soldCount={soldCount}
        totalPlayers={allPlayers.length}
        shareCopied={shareCopied}
        showSoundBoard={showSoundBoard}
        showShortcuts={showShortcuts}
        notificationsOn={notificationsOn}
        isNotificationSupported={isNotificationSupported()}
        canEdit={canEdit}
        onBack={() => navigate(`/auctions/${auctionId}`)}
        onShare={() => {
          const url = `${window.location.origin}/watch/${auctionId}`
          navigator.clipboard.writeText(url)
          setShareCopied(true)
          toast.success('Spectator link copied!')
          setTimeout(() => setShareCopied(false), 2000)
        }}
        onSpectate={() => window.open(`/watch/${auctionId}`, '_blank')}
        onOverlay={() => window.open(`/overlay/${auctionId}`, '_blank', 'width=1920,height=1080')}
        onToggleSounds={() => setShowSoundBoard(!showSoundBoard)}
        onToggleShortcuts={() => setShowShortcuts(!showShortcuts)}
        onToggleNotifications={toggleNotifications}
        onSettings={() => navigate(`/auctions/${auctionId}/settings`)}
      />

      {/* Error bar */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 px-4 py-2 text-sm text-center">
          {error} <button onClick={() => setError('')} className="ml-2 text-rose-400 font-bold">×</button>
        </motion.div>
      )}

      {/* SOLD/UNSOLD Overlay */}
      <SoldOverlay overlay={ws.soldOverlay} soldStamp={auction?.sold_stamp} unsoldStamp={auction?.unsold_stamp} />

      {/* RTM Prompt */}
      <RtmPrompt prompt={ws.rtmPrompt} canEdit={canEdit} onAccept={handleRtmAccept} onDecline={handleRtmDecline} />

      {/* Sound Board */}
      <AnimatePresence>
        {showSoundBoard && canEdit && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-surface-1/60 backdrop-blur-xl border-b border-white/5 overflow-hidden">
            <div className="px-6 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-500 font-display tracking-widest mr-2">SOUND BOARD</span>
              {SOUND_BUTTONS.map(btn => (
                <button key={btn.key} onClick={() => handleTriggerSound(btn.key)} className={`bg-gradient-to-r ${btn.color} hover:brightness-110 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg transition-all`}><span>{btn.icon}</span> {btn.label}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-56px)]">
        <PlayerPanel
          currentPlayer={ws.currentPlayer}
          currentBid={ws.currentBid}
          leadingTeam={leadingTeam}
          nextBidAmount={nextBidAmount}
          status={ws.status}
          soldOverlay={ws.soldOverlay}
          timerValue={ws.timerValue}
          timerMax={ws.timerMax}
          timerMode={timerMode}
          canEdit={canEdit}
          onSold={handleSold}
          onUnsold={handleUnsold}
          onPause={handlePause}
          onResume={handleResume}
          onNextPlayer={() => handleNextPlayer()}
          onStart={handleStart}
          onStartTimer={handleStartTimer}
          onResetTimer={handleResetTimer}
          nextButtonRef={handleNextPlayerButtonRef}
          soldCount={soldCount}
          passedCount={passedCount}
          unsoldCount={unsoldPlayers.length}
          totalPlayers={allPlayers.length}
        />

      <TeamSidebar
        teams={teamList}
        currentTeamId={ws.currentTeamId}
        status={ws.status}
        showShortcuts={showShortcuts}
        canEdit={canEdit}
        keyMap={keyMap.current}
        bidEvents={bidEvents}
        unsoldCount={unsoldPlayers.length}
        onBid={(teamId) => {
          if (ws.status === 'live' && ws.wsRef.current?.readyState === WebSocket.OPEN) {
            ws.wsRef.current.send(JSON.stringify({ type: 'bid', team_id: teamId, auto: true }))
          }
        }}
      />
    </div>
    </div>
  )
}
