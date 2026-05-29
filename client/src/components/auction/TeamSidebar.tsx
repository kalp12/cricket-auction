import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { formatPrice } from '../../utils/auction'
import { EmptyState } from '../ui'

interface Team {
  id: number
  name: string
  short_name: string
  remaining_budget: number
  total_budget: number
  logo_url?: string
}

interface BidEvent {
  team_name: string
  team_short: string
  amount: number
  id: number
}

interface Props {
  teams: Team[]
  currentTeamId: number | null
  status: string
  showShortcuts: boolean
  keyMap: Record<string, Team>
  bidEvents: BidEvent[]
  unsoldCount: number
  onBid: (teamId: number) => void
}

export default function TeamSidebar({ teams, currentTeamId, status, showShortcuts, keyMap, bidEvents, unsoldCount, onBid }: Props) {
  return (
    <div className="w-full lg:w-80 bg-surface-1/40 backdrop-blur-lg border-l-0 lg:border-l border-t lg:border-t-0 border-white/5 flex flex-col max-h-[60vh] lg:max-h-none overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 dark-scrollbar">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Teams — Click to Bid</h3>
        </div>
        {teams.map(team => {
          const key = Object.entries(keyMap).find(([_, t]) => t.id === team.id)?.[0]
          const isLeading = team.id === currentTeamId
          const budgetPct = team.total_budget > 0 ? Math.round((team.remaining_budget / team.total_budget) * 100) : 0
          return (
            <motion.button
              key={team.id}
              layout
              onClick={() => onBid(team.id)}
              disabled={status !== 'live'}
              animate={isLeading ? { scale: 1.02 } : { scale: 1 }}
              className={`w-full rounded-xl p-3 border text-left transition-all duration-300 ${
                isLeading ? 'bg-accent-gold/10 border-accent-gold/30 glow-gold' : 'bg-surface-2/50 border-white/5 hover:bg-surface-3/50 hover:border-white/10'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                  {showShortcuts && key && (
                    <kbd className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border ${
                      isLeading ? 'bg-accent-gold/20 border-accent-gold/40 text-accent-gold' : 'bg-surface-3 border-white/10 text-gray-400'
                    }`}>{key}</kbd>
                  )}
                  <div>
                    <div className={`font-semibold text-sm ${isLeading ? 'text-accent-gold' : 'text-gray-300'}`}>{team.short_name || team.name}</div>
                    <div className="text-xs text-gray-600">{formatPrice(team.remaining_budget)}</div>
                  </div>
                </div>
                {isLeading && <span className="text-xs bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-lg font-semibold">LEADING</span>}
              </div>
              <div className="mt-2 h-1 bg-surface-4 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${isLeading ? 'bg-accent-gold' : 'bg-primary-500'}`} style={{ width: `${budgetPct}%` }} />
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="border-t border-white/5 p-3 max-h-40 overflow-y-auto dark-scrollbar">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bid History</h3>
        {bidEvents.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No bids yet" message="Waiting for the first bid..." className="py-2" />
        ) : (
          <div className="space-y-1">
            {bidEvents.map((evt, i) => (
              <motion.div key={evt.id} initial={i === 0 ? { opacity: 0, x: 20 } : false} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className={`flex items-center justify-between text-xs ${i === 0 ? 'text-white' : 'text-gray-500'}`}>
                <span className={i === 0 ? 'font-semibold' : ''}>{evt.team_short || evt.team_name}</span>
                <span className={`font-mono ${i === 0 ? 'font-bold text-accent-gold' : ''}`}>{formatPrice(evt.amount)}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-white/5 p-3">
        <div className="text-xs text-gray-600">{unsoldCount} unsold players remaining</div>
      </div>
    </div>
  )
}
