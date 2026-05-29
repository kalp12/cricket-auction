import { motion, AnimatePresence } from 'framer-motion'
import { Gavel } from 'lucide-react'
import { formatPrice } from '../../utils/auction'
import { assetUrl } from '../../api'

interface SoldOverlayData {
  type: 'sold' | 'unsold'
  playerName: string
  teamName?: string
  teamShort?: string
  price?: number
}

interface Props {
  overlay: SoldOverlayData | null
  soldStamp?: string | null
  unsoldStamp?: string | null
  zIndex?: number
  position?: 'fixed' | 'absolute'
}

export default function SoldOverlay({ overlay, soldStamp, unsoldStamp, zIndex = 50, position = 'fixed' }: Props) {
  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`${position} inset-0 pointer-events-none flex items-center justify-center backdrop-blur-sm ${
            overlay.type === 'sold' ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}
          style={{ zIndex }}
        >
          {overlay.type === 'sold' && (
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
            {overlay.type === 'sold' && soldStamp ? (
              <motion.img
                initial={{ rotate: -12, scale: 0.5 }}
                animate={{ rotate: -8, scale: 1 }}
                src={assetUrl(soldStamp)!}
                alt="SOLD"
                className="max-w-md max-h-48 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]"
              />
            ) : overlay.type === 'unsold' && unsoldStamp ? (
              <motion.img
                initial={{ rotate: -8, scale: 0.5 }}
                animate={{ rotate: -5, scale: 1 }}
                src={assetUrl(unsoldStamp)!}
                alt="UNSOLD"
                className="max-w-md max-h-48 drop-shadow-[0_0_60px_rgba(239,68,68,0.5)]"
              />
            ) : (
              <>
                {overlay.type === 'sold' && <Gavel className="w-16 h-16 text-amber-400 mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />}
                <span className={`font-display text-6xl md:text-8xl tracking-wider ${
                  overlay.type === 'sold'
                    ? 'text-green-400 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]'
                    : 'text-red-400 drop-shadow-[0_0_60px_rgba(239,68,68,0.5)]'
                }`}>
                  {overlay.type === 'sold' ? 'SOLD!' : 'UNSOLD'}
                </span>
              </>
            )}
            {overlay.type === 'sold' && overlay.teamName && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl text-amber-400 font-medium mt-2"
              >
                {overlay.teamShort || overlay.teamName} — {formatPrice(overlay.price || 0)}
              </motion.span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
