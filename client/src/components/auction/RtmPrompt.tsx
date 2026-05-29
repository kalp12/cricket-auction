import { motion, AnimatePresence } from 'framer-motion'
import { formatPrice } from '../../utils/auction'

interface RtmPromptData {
  playerName: string
  winningTeamName: string
  winningTeamShort: string
  winningTeamId: number
  rtmTeamName: string
  rtmTeamShort: string
  rtmTeamId: number
  price: number
}

interface Props {
  prompt: RtmPromptData | null
  onAccept: () => void
  onDecline: () => void
}

export default function RtmPrompt({ prompt, onAccept, onDecline }: Props) {
  return (
    <AnimatePresence>
      {prompt && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.7, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }} className="glass-strong rounded-3xl p-8 max-w-lg w-full mx-4 border-2 border-amber-400/40 shadow-2xl shadow-amber-400/20">
            <div className="text-center mb-6">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="inline-block bg-amber-400/15 border border-amber-400/30 rounded-2xl px-6 py-2 mb-4">
                <span className="font-display text-2xl tracking-wider text-amber-400">RIGHT TO MATCH</span>
              </motion.div>
              <div className="text-gray-400 text-sm mt-2">{prompt.playerName}</div>
              <div className="text-3xl font-bold gradient-text mt-1">{formatPrice(prompt.price)}</div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between bg-surface-2/60 rounded-xl px-5 py-3 border border-white/5">
                <span className="text-gray-400 text-sm">Winning Bidder</span>
                <span className="text-white font-semibold">{prompt.winningTeamShort || prompt.winningTeamName}</span>
              </div>
              <div className="flex items-center justify-between bg-amber-400/10 rounded-xl px-5 py-3 border border-amber-400/20">
                <span className="text-amber-400/70 text-sm">Previous Team (RTM)</span>
                <span className="text-amber-400 font-bold">{prompt.rtmTeamShort || prompt.rtmTeamName}</span>
              </div>
            </div>
            <p className="text-center text-gray-500 text-sm mb-6">
              Does <span className="text-amber-400 font-semibold">{prompt.rtmTeamShort || prompt.rtmTeamName}</span> want to match the bid and retain <span className="text-white font-semibold">{prompt.playerName}</span>?
            </p>
            <div className="flex gap-3">
              <motion.button onClick={onAccept} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 text-black py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-amber-500/30">
                MATCH — {formatPrice(prompt.price)}
              </motion.button>
              <motion.button onClick={onDecline} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1 bg-surface-3 hover:bg-surface-4 text-gray-400 py-3.5 rounded-xl font-semibold text-lg border border-white/5">
                Pass
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export type { RtmPromptData }
