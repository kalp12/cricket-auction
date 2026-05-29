import { motion } from 'framer-motion'
import { ArrowLeft, Check, Eye, ExternalLink, Keyboard, Share2, Volume2, Bell, BellOff, Settings } from 'lucide-react'

interface Props {
  auctionName: string
  status: string
  soldCount: number
  totalPlayers: number
  shareCopied: boolean
  showSoundBoard: boolean
  showShortcuts: boolean
  notificationsOn: boolean
  isNotificationSupported: boolean
  onBack: () => void
  onShare: () => void
  onSpectate: () => void
  onOverlay: () => void
  onToggleSounds: () => void
  onToggleShortcuts: () => void
  onToggleNotifications: () => void
  onSettings: () => void
}

export default function AuctionTopBar({
  auctionName, status, soldCount, totalPlayers,
  shareCopied, showSoundBoard, showShortcuts, notificationsOn, isNotificationSupported,
  onBack, onShare, onSpectate, onOverlay, onToggleSounds, onToggleShortcuts, onToggleNotifications, onSettings,
}: Props) {
  return (
    <div className="bg-surface-1/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between relative z-10">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <button onClick={onBack} aria-label="Back" className="text-gray-500 hover:text-white transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-lg md:text-2xl tracking-wide truncate">{auctionName || 'AUCTION'}</h1>
        <motion.span
          key={status}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
            status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            status === 'rtm_pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' :
            status === 'dutch_active' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse' :
            status === 'sealed_reveal' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}
        >
          {status}
        </motion.span>
        <span className="text-sm text-gray-500 shrink-0 hidden sm:inline">{soldCount}/{totalPlayers} sold</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button onClick={onShare} className="text-gray-500 hover:text-accent-gold flex items-center gap-1 text-sm transition-colors" title="Copy spectator link">
          {shareCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{shareCopied ? 'Copied' : 'Share'}</span>
        </button>
        <button onClick={onSpectate} className="text-gray-500 hover:text-accent-gold flex items-center gap-1 text-sm transition-colors" title="Open spectator view">
          <Eye className="w-4 h-4" /> Spectate
        </button>
        <button onClick={onOverlay} className="text-gray-500 hover:text-accent-gold flex items-center gap-1 text-sm transition-colors" title="Open broadcast overlay">
          <ExternalLink className="w-4 h-4" /> Overlay
        </button>
        <button onClick={onToggleSounds} className={showSoundBoard ? 'text-accent-gold hover:text-amber-300 flex items-center gap-1 text-sm' : 'text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors'}>
          <Volume2 className="w-4 h-4" /> Sounds
        </button>
        <button onClick={onToggleShortcuts} className="text-gray-500 hover:text-white flex items-center gap-1 text-sm transition-colors">
          <Keyboard className="w-4 h-4" /> Keys
        </button>
        {isNotificationSupported && (
          <button onClick={onToggleNotifications} className={notificationsOn ? 'text-accent-gold hover:text-amber-300 flex items-center gap-1 text-sm' : 'text-gray-600 hover:text-gray-400 flex items-center gap-1 text-sm'}>
            {notificationsOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        )}
        <button onClick={onSettings} className="text-gray-500 hover:text-white transition-colors shrink-0">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
