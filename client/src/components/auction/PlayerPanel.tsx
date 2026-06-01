import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, X, Shuffle, Gavel, TimerOff } from 'lucide-react'
import TimerCircle from './TimerCircle'
import { formatPrice } from '../../utils/auction'

interface PlayerData {
  id: number
  name: string
  role: string
  country: string
  base_price: number
}

interface Team {
  id: number
  name: string
  short_name: string
}

interface Props {
  currentPlayer: PlayerData | null
  currentBid: number
  leadingTeam: Team | undefined
  nextBidAmount: number
  status: string
  soldOverlay: any
  timerValue: number
  timerMax: number
  timerMode: string
  canEdit: boolean
  onSold: () => void
  onUnsold: () => void
  onPause: () => void
  onResume: () => void
  onNextPlayer: () => void
  onStart: () => void
  onStartTimer: () => void
  onResetTimer: () => void
  nextButtonRef: React.RefObject<HTMLButtonElement | null>
  soldCount: number
  passedCount: number
  unsoldCount: number
  totalPlayers: number
}

export default function PlayerPanel({
  currentPlayer, currentBid, leadingTeam, nextBidAmount, status, soldOverlay,
  timerValue, timerMax, timerMode, canEdit,
  onSold, onUnsold, onPause, onResume, onNextPlayer, onStart, onStartTimer, onResetTimer,
  nextButtonRef, soldCount, passedCount, unsoldCount, totalPlayers,
}: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-0">
      <div className="flex-1 flex items-center justify-center">
        {currentPlayer ? (
          <motion.div key={currentPlayer.id} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }} className="text-center">
            <div className="text-gray-500 text-sm mb-1 uppercase tracking-widest">{currentPlayer.role} — {currentPlayer.country}</div>
            <h2 className="font-display text-3xl md:text-5xl tracking-wide text-white mb-1">{currentPlayer.name}</h2>
            <div className="text-gray-600 text-sm mb-4">Base: {formatPrice(currentPlayer.base_price)}</div>
            <div className="glass-strong rounded-2xl px-6 md:px-10 py-4 md:py-6 inline-block" aria-live="polite">
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Current Bid</div>
              <motion.div key={currentBid} initial={{ scale: 1.05, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }} className="text-3xl md:text-5xl font-bold gradient-text">
                {formatPrice(currentBid)}
              </motion.div>
              {leadingTeam && <div className="mt-2 text-accent-gold font-semibold">{leadingTeam.name} ({leadingTeam.short_name})</div>}
              <div className="mt-1 text-gray-600 text-sm">Next: {formatPrice(nextBidAmount)}</div>
            </div>
            {timerMode !== 'off' && status === 'live' && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <TimerCircle seconds={timerValue} maxSeconds={timerMax} />
                {timerMode === 'manual' && canEdit && (
                  <div className="flex flex-col gap-1">
                    <button onClick={onStartTimer} className="text-xs bg-emerald-600/80 hover:bg-emerald-600 px-2 py-1 rounded-lg flex items-center gap-1"><Play className="w-3 h-3" /> Start</button>
                    <button onClick={onResetTimer} className="text-xs bg-surface-3 hover:bg-surface-4 px-2 py-1 rounded-lg flex items-center gap-1"><TimerOff className="w-3 h-3" /> Reset</button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : status === 'live' || status === 'waiting' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="text-gray-600 text-xl mb-4">No player selected</div>
            {canEdit && (
              <motion.button onClick={onNextPlayer} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto shadow-lg shadow-primary-600/20">
                <Shuffle className="w-5 h-5" /> Random Player
              </motion.button>
            )}
          </motion.div>
        ) : status === 'ended' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="text-gray-500 text-xl">Auction Complete</div>
            <div className="text-gray-600 text-sm mt-2">{soldCount} sold · {passedCount} passed · {unsoldCount} remaining</div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="text-gray-600 text-xl mb-4">Auction not started</div>
            {canEdit && (
              <motion.button onClick={onStart} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto shadow-lg shadow-emerald-600/20">
                <Play className="w-5 h-5" /> Start Auction
              </motion.button>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {canEdit && status === 'live' && currentPlayer && !soldOverlay && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-1/60 backdrop-blur-xl border-t border-white/5 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-center gap-2 md:gap-4">
            <motion.button ref={nextButtonRef} onClick={onNextPlayer} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-surface-3 hover:bg-surface-4 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-colors border border-white/5">
              <Shuffle className="w-4 h-4" /> Random (R)
            </motion.button>
            <motion.button onClick={onSold} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <Gavel className="w-4 h-4" /> SOLD
            </motion.button>
            <motion.button onClick={onUnsold} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20">
              <X className="w-4 h-4" /> UNSOLD
            </motion.button>
            <motion.button onClick={onPause} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-amber-600/80 hover:bg-amber-600 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-colors">
              <Pause className="w-4 h-4" /> Pause
            </motion.button>
          </motion.div>
        )}
        {canEdit && status === 'paused' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface-1/60 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex items-center justify-center gap-3">
            <motion.button onClick={onResume} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <Play className="w-4 h-4" /> Resume
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
