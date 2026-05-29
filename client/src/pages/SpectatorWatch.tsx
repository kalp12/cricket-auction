import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, QrCode, X } from 'lucide-react'
import { getPublicAuction, assetUrl } from '../api'
import { useSoundBoard } from '../hooks/useSoundBoard'
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket'
import SoldOverlay from '../components/auction/SoldOverlay'
import TimerCircle from '../components/auction/TimerCircle'
import SponsorSlot from '../components/auction/SponsorSlot'
import { formatPrice, fireConfetti } from '../utils/auction'
import toast from 'react-hot-toast'

interface TeamData {
  id: number
  name: string
  short_name?: string
  logo_url?: string
  budget_tier?: string
}

const TIER_COLORS: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
  unknown: 'bg-gray-500',
}

export default function SpectatorWatch() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const [auction, setAuction] = useState<any>(null)
  const [teams, setTeams] = useState<TeamData[]>([])
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  const soundBoard = useSoundBoard(auction)
  const ws = useAuctionWebSocket({ auctionId, mode: 'spectator', initialAuction: auction, timerSeconds: auction?.timer_seconds || 30, onPlaySound: (key) => soundBoard.playSound(key as any) })

  // Fire effects on sold/unsold overlay
  const prevOverlayRef = useRef(ws.soldOverlay)
  useEffect(() => {
    if (ws.soldOverlay && !prevOverlayRef.current) {
      if (ws.soldOverlay.type === 'sold') { fireConfetti(); soundBoard.playSound('gavel') }
      else { soundBoard.playSound('unsold') }
    }
    prevOverlayRef.current = ws.soldOverlay
  }, [ws.soldOverlay, soundBoard])

  // Initial fetch (once, using public API)
  useEffect(() => {
    if (!auctionId) return
    const fetchData = async () => {
      try {
        const data = await getPublicAuction(Number(auctionId))
        setAuction(data)
        setTeams(data.teams || [])
        ws.updateTeams(data.teams || [])
        ws.setCurrentBid(data.current_bid)
        ws.setCurrentTeamId(data.current_team_id)
        ws.setStatus(data.status)
        if (data.current_player) ws.setCurrentPlayer(data.current_player)
        if (data.current_team) ws.setCurrentTeamId(data.current_team.id)
        if (data.timer_seconds) ws.setTimer(data.timer_seconds)
      } catch (e: any) {
        toast.error('Failed to load auction')
      } finally { setLoading(false) }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId])

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
      {/* Sponsor corners */}
      <SponsorSlot src={auction?.sponsor_tl} position="top-left" />
      <SponsorSlot src={auction?.sponsor_tr} position="top-right" />
      <SponsorSlot src={auction?.sponsor_bl} position="bottom-left" />
      <SponsorSlot src={auction?.sponsor_br} position="bottom-right" />

      {/* Top bar */}
      <div className="bg-surface-1/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-display text-lg md:text-2xl tracking-wide truncate">{auction?.name || 'AUCTION'}</h1>
          <motion.span key={ws.status} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
              ws.status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              ws.status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              ws.status === 'rtm_pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}
          >
            {ws.status}
          </motion.span>
          <span className="text-xs text-gray-600 bg-surface-2 px-2 py-1 rounded-lg font-medium">SPECTATOR</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleCopyLink} className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors" title="Copy spectator link">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button onClick={() => setShowQR(!showQR)} className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors" title="Show QR code">
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">QR</span>
          </button>
        </div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-surface-1 rounded-2xl p-8 flex flex-col items-center gap-4 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between w-full">
                <h3 className="font-display text-lg tracking-wide">Share Spectator Link</h3>
                <button onClick={() => setShowQR(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="bg-white p-4 rounded-xl"><QRCodeSVG value={spectatorUrl} size={200} /></div>
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
      <SoldOverlay overlay={ws.soldOverlay} soldStamp={auction?.sold_stamp} unsoldStamp={auction?.unsold_stamp} />

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {ws.currentPlayer ? (
            <motion.div key={ws.currentPlayer.id} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }} className="text-center">
              <div className="text-gray-400 text-sm mb-2 uppercase tracking-widest">{ws.currentPlayer.role} — {ws.currentPlayer.country}</div>
              <h2 className="font-display text-4xl md:text-6xl tracking-wide text-white mb-2">{ws.currentPlayer.name}</h2>
              <div className="text-gray-500 text-sm mb-6">Base: {formatPrice(ws.currentPlayer.base_price)}</div>

              <div className="glass-strong rounded-3xl px-14 py-8 inline-block">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
                <motion.div key={ws.currentBid} initial={{ scale: 1.05, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }} className="text-6xl font-bold gradient-text">
                  {formatPrice(ws.currentBid)}
                </motion.div>
                {ws.currentTeam && (
                  <div className="mt-3 text-amber-400 font-semibold text-lg">
                    {ws.currentTeam.name} {ws.currentTeam.short_name ? `(${ws.currentTeam.short_name})` : ''}
                  </div>
                )}
              </div>

              {ws.timerMode !== 'off' && ws.status === 'live' && (
                <div className="mt-8 flex justify-center">
                  <TimerCircle seconds={ws.timerValue} maxSeconds={ws.timerMax} />
                </div>
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

        {/* Right Sidebar: Team budgets (tier-based, no exact amounts) */}
        <div className="w-full lg:w-72 bg-surface-1/30 backdrop-blur-lg border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col overflow-hidden py-4 px-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Teams</h3>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {teams.map(team => {
              const isLeading = ws.currentTeamId === team.id
              const tier = team.budget_tier || 'unknown'
              return (
                <div key={team.id} className={`rounded-xl p-2.5 border transition-all ${isLeading ? 'bg-amber-400/10 border-amber-400/30' : 'bg-surface-2/30 border-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <div className={`font-semibold text-sm ${isLeading ? 'text-amber-400' : 'text-gray-300'}`}>{team.short_name || team.name}</div>
                    {isLeading ? (
                      <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">BIDDING</span>
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
