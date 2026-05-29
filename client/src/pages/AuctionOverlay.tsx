import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSoundBoard } from '../hooks/useSoundBoard'
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket'
import { getAuction, getTeams, assetUrl } from '../api'
import SoldOverlay from '../components/auction/SoldOverlay'
import TimerCircle from '../components/auction/TimerCircle'
import SponsorSlot from '../components/auction/SponsorSlot'
import { formatPrice, fireConfetti } from '../utils/auction'

interface TeamData {
  id: number
  name: string
  short_name?: string
  logo_url?: string
  remaining_budget?: number
  total_budget?: number
}

export default function AuctionOverlay() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const [auction, setAuction] = useState<any>(null)
  const [teams, setTeams] = useState<TeamData[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  // Sound board (declared before WS hook so onPlaySound callback can reference it)
  const soundBoard = useSoundBoard(auction)

  // WS hook
  const ws = useAuctionWebSocket({ auctionId, initialAuction: auction, timerSeconds: auction?.timer_seconds || 30, onPlaySound: (key) => soundBoard.playSound(key as any) })

  // Fire effects on sold/unsold overlay
  const prevOverlayRef = useRef(ws.soldOverlay)
  useEffect(() => {
    if (ws.soldOverlay && !prevOverlayRef.current) {
      if (ws.soldOverlay.type === 'sold') { fireConfetti(); soundBoard.playSound('gavel') }
      else { soundBoard.playSound('unsold') }
    }
    prevOverlayRef.current = ws.soldOverlay
  }, [ws.soldOverlay, soundBoard])

  // Initial fetch (once)
  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      setLoading(true)
      setFetchError('')
      try {
        const [auctionData, teamsData] = await Promise.all([
          getAuction(Number(auctionId)), getTeams(Number(auctionId)),
        ])
        setAuction(auctionData)
        setTeams(teamsData)
        ws.updateTeams(teamsData)
        ws.setCurrentBid(auctionData.current_bid)
        ws.setCurrentTeamId(auctionData.current_team_id)
        ws.setStatus(auctionData.status)
        if (auctionData.current_player_id) {
          // Overlay doesn't need to fetch player separately, WS state msg has it
        }
        if (auctionData.timer_seconds) ws.setTimer(auctionData.timer_seconds)
      } catch (e: any) {
        setFetchError(e?.message || 'Failed to load auction data')
      } finally { setLoading(false) }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId])

  const overlayBgUrl = assetUrl(auction?.overlay_bg)

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
    <div className="fixed inset-0 bg-surface-0 text-white overflow-hidden" style={overlayBgUrl ? { backgroundImage: `url(${overlayBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {!overlayBgUrl && <div className="absolute inset-0 noise-bg opacity-30" />}

      {/* Sponsor corners */}
      <SponsorSlot src={auction?.sponsor_tl} position="top-left" />
      <SponsorSlot src={auction?.sponsor_tr} position="top-right" />
      <SponsorSlot src={auction?.sponsor_bl} position="bottom-left" />
      <SponsorSlot src={auction?.sponsor_br} position="bottom-right" />

      {/* SOLD/UNSOLD Overlay */}
      <SoldOverlay overlay={ws.soldOverlay} soldStamp={auction?.sold_stamp} unsoldStamp={auction?.unsold_stamp} position="absolute" zIndex={40} />

      {/* Main Content */}
      <div className="relative z-10 h-full flex">
        {/* Center: Player Card + Bid Display */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {ws.currentPlayer ? (
            <motion.div key={ws.currentPlayer.id} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }} className="text-center">
              <div className="text-gray-400 text-sm mb-2 uppercase tracking-widest">{ws.currentPlayer.role} — {ws.currentPlayer.country}</div>
              <h2 className="font-display text-4xl md:text-7xl tracking-wide text-white mb-2 break-words">{ws.currentPlayer.name}</h2>
              <div className="text-gray-500 text-sm mb-6">Base Price: {formatPrice(ws.currentPlayer.base_price)}</div>

              <motion.div layout className="glass-strong rounded-3xl px-14 py-8 inline-block">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
                <motion.div key={ws.currentBid} initial={{ scale: 1.05, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }} className="text-6xl font-bold gradient-text">
                  {formatPrice(ws.currentBid)}
                </motion.div>
                {ws.currentTeam && (
                  <motion.div key={ws.currentTeam.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-amber-400 font-semibold text-lg">
                    {ws.currentTeam.name} ({ws.currentTeam.short_name})
                  </motion.div>
                )}
              </motion.div>

              {ws.timerMode !== 'off' && ws.status === 'live' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex justify-center">
                  <TimerCircle seconds={ws.timerValue} maxSeconds={ws.timerMax} />
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="font-display text-4xl tracking-wider text-gray-500">
                {ws.status === 'waiting' ? 'AUCTION STARTING SOON' : ws.status === 'ended' ? 'AUCTION COMPLETE' : 'NEXT PLAYER'}
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
              const isLeading = ws.currentTeamId === team.id
              const budgetPct = team.total_budget && team.total_budget > 0
                ? Math.round(((team.remaining_budget ?? 0) / team.total_budget) * 100) : 0
              return (
                <motion.div key={team.id} layout animate={isLeading ? { scale: 1.02 } : { scale: 1 }}
                  className={`rounded-xl p-2.5 border transition-all duration-300 ${isLeading ? 'bg-amber-400/10 border-amber-400/30 glow-gold' : 'bg-surface-2/30 border-white/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-semibold text-sm ${isLeading ? 'text-amber-400' : 'text-gray-300'}`}>{team.short_name || team.name}</div>
                      <div className="text-xs text-gray-600">{formatPrice(team.remaining_budget ?? 0)}</div>
                    </div>
                    {isLeading && <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">BIDDING</span>}
                  </div>
                  <div className="mt-1.5 h-0.5 bg-surface-4 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isLeading ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${budgetPct}%` }} />
                  </div>
                </motion.div>
              )
            })}
          </div>

          {auction?.lower_third_banner && (
            <div className="mt-3 px-1">
              <img src={assetUrl(auction.lower_third_banner)!} alt="Banner" className="w-full rounded-lg opacity-80" style={{ maxHeight: 50, objectFit: 'contain' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
