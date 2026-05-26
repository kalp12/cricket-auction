import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Users, Trophy, TrendingUp, Shield, DollarSign, BarChart3 } from 'lucide-react'
import { getAuctionReport, exportAuctionResults, exportTeamRosters, assetUrl } from '../api'
import { SkeletonCard, SkeletonLine } from '../components/ui'
import toast from 'react-hot-toast'

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const ROLE_COLORS: Record<string, string> = {
  batsman: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bowler: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  allrounder: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  wicketkeeper: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

export default function AuctionReport() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)

  useEffect(() => {
    if (!auctionId) return
    const fetchReport = async () => {
      try {
        const data = await getAuctionReport(Number(auctionId))
        setReport(data)
      } catch (e: any) {
        toast.error('Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [auctionId])

  const handleExport = async (type: 'results' | 'rosters') => {
    if (!auctionId) return
    try {
      const blob = type === 'results'
        ? await exportAuctionResults(Number(auctionId))
        : await exportTeamRosters(Number(auctionId))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'results' ? 'auction_results.xlsx' : 'team_rosters.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 text-white p-6 max-w-7xl mx-auto">
        <SkeletonCard className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
        <SkeletonCard className="h-64 mb-6" />
        <SkeletonCard className="h-96" />
      </div>
    )
  }

  if (!report) return null

  const { auction: auctionInfo, summary, teams, sold_players, unsold_players, team_bid_activity, rtm_events } = report

  return (
    <div className="animate-fade-in noise-bg min-h-screen bg-surface-0 text-white max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-xs tracking-widest font-display mb-6 text-white/30">
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/dashboard')}>HOME</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate(`/auctions/${auctionId}`)}>{auctionInfo.name?.toUpperCase()}</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-accent-gold font-semibold">REPORT</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/auctions/${auctionId}`)} className="text-white/30 hover:text-accent-gold transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-3xl md:text-4xl tracking-wider gradient-text">AUCTION REPORT</h1>
            <p className="text-sm text-gray-500 mt-1">{auctionInfo.name} — {auctionInfo.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('results')} className="bg-surface-2 hover:bg-surface-3 border border-white/5 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
            <Download className="w-4 h-4" /> Results
          </button>
          <button onClick={() => handleExport('rosters')} className="bg-surface-2 hover:bg-surface-3 border border-white/5 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
            <Download className="w-4 h-4" /> Rosters
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-strong rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2"><Users className="w-5 h-5 text-blue-400" /><span className="text-xs text-gray-500 uppercase tracking-wider font-display">Players</span></div>
          <div className="text-2xl font-bold">{summary.total_players}</div>
          <div className="text-xs text-gray-500 mt-1">{summary.sold} sold / {summary.unsold} unsold</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-strong rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-emerald-400" /><span className="text-xs text-gray-500 uppercase tracking-wider font-display">Total Spent</span></div>
          <div className="text-2xl font-bold gradient-text">{formatPrice(summary.total_spent)}</div>
          <div className="text-xs text-gray-500 mt-1">Avg: {formatPrice(summary.avg_price)}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-strong rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2"><Trophy className="w-5 h-5 text-amber-400" /><span className="text-xs text-gray-500 uppercase tracking-wider font-display">Most Expensive</span></div>
          <div className="text-2xl font-bold">{formatPrice(summary.max_price)}</div>
          <div className="text-xs text-gray-500 mt-1">{sold_players[0]?.name || '—'}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-strong rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2"><BarChart3 className="w-5 h-5 text-purple-400" /><span className="text-xs text-gray-500 uppercase tracking-wider font-display">Total Bids</span></div>
          <div className="text-2xl font-bold">{summary.total_bids}</div>
          <div className="text-xs text-gray-500 mt-1">Across {teams.length} teams</div>
        </motion.div>
      </div>

      {/* Team Summaries */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-5 flex items-center gap-2"><Shield className="w-5 h-5" /> TEAM SUMMARIES</h2>
        <div className="space-y-3">
          {teams.sort((a: any, b: any) => b.spent - a.spent).map((team: any) => {
            const budgetPct = team.total_budget > 0 ? Math.round((team.remaining_budget / team.total_budget) * 100) : 0
            const spentPct = team.total_budget > 0 ? Math.round((team.spent / team.total_budget) * 100) : 0
            const isExpanded = expandedTeam === team.id
            return (
              <div key={team.id} className="rounded-xl border border-white/5 overflow-hidden">
                <button
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {team.logo_url && <img src={assetUrl(team.logo_url)!} alt="" className="w-8 h-8 rounded-full object-cover" />}
                    <div>
                      <div className="font-semibold text-white">{team.name} {team.short_name ? `(${team.short_name})` : ''}</div>
                      <div className="text-xs text-gray-600">{team.players_bought}/{team.max_players} players</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">{formatPrice(team.spent)} spent</div>
                    <div className="text-xs text-gray-500">{formatPrice(team.remaining_budget)} left</div>
                  </div>
                </button>

                {/* Budget bar */}
                <div className="px-5 pb-3">
                  <div className="h-1.5 bg-surface-4 rounded-full overflow-hidden flex">
                    <div className="h-full bg-accent-gold rounded-l-full transition-all" style={{ width: `${spentPct}%` }} />
                    <div className="h-full bg-emerald-500 rounded-r-full transition-all" style={{ width: `${budgetPct}%` }} />
                  </div>
                  {/* Role summary */}
                  <div className="flex gap-2 mt-2">
                    {Object.entries(team.role_counts || {}).map(([role, count]: [string, any]) => (
                      <span key={role} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${ROLE_COLORS[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {count} {role}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expanded roster */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-white/5 px-5 py-3 bg-surface-1/30"
                  >
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left py-2 text-gray-500 text-xs">Player</th>
                          <th className="text-left py-2 text-gray-500 text-xs">Role</th>
                          <th className="text-left py-2 text-gray-500 text-xs">Country</th>
                          <th className="text-right py-2 text-gray-500 text-xs">Base</th>
                          <th className="text-right py-2 text-gray-500 text-xs">Bought</th>
                          {auctionInfo.rtm_enabled && <th className="text-center py-2 text-gray-500 text-xs">RTM</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {team.roster.map((p: any) => (
                          <tr key={p.id} className="border-b border-white/[0.03]">
                            <td className="py-2 text-white font-medium">{p.name}</td>
                            <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] border ${ROLE_COLORS[p.role] || ''}`}>{p.role}</span></td>
                            <td className="py-2 text-gray-400">{p.country}</td>
                            <td className="py-2 text-right text-gray-500">{formatPrice(p.base_price)}</td>
                            <td className="py-2 text-right font-mono text-accent-gold font-semibold">{formatPrice(p.bought_price)}</td>
                            {auctionInfo.rtm_enabled && (
                              <td className="py-2 text-center">
                                {p.rtm_used === 1 ? <span className="text-amber-400 text-xs font-bold">RTM</span> : ''}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {team.roster.length === 0 && <p className="text-gray-600 text-sm py-2 text-center">No players bought</p>}
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Sold Players List */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider text-accent-gold mb-5 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> ALL SOLD PLAYERS</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 text-gray-500 text-xs">#</th>
                <th className="text-left py-3 text-gray-500 text-xs">Player</th>
                <th className="text-left py-3 text-gray-500 text-xs">Role</th>
                <th className="text-left py-3 text-gray-500 text-xs">Team</th>
                <th className="text-right py-3 text-gray-500 text-xs">Base</th>
                <th className="text-right py-3 text-gray-500 text-xs">Sold</th>
                <th className="text-right py-3 text-gray-500 text-xs">Premium</th>
                {auctionInfo.rtm_enabled && <th className="text-center py-3 text-gray-500 text-xs">RTM</th>}
              </tr>
            </thead>
            <tbody>
              {sold_players.map((p: any, i: number) => {
                const premium = ((p.bought_price - p.base_price) / p.base_price * 100).toFixed(0)
                return (
                  <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 text-gray-600">{i + 1}</td>
                    <td className="py-2.5 text-white font-medium">{p.name}</td>
                    <td className="py-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] border ${ROLE_COLORS[p.role] || ''}`}>{p.role}</span></td>
                    <td className="py-2.5 text-gray-300">{p.team_short || p.team_name}</td>
                    <td className="py-2.5 text-right text-gray-500">{formatPrice(p.base_price)}</td>
                    <td className="py-2.5 text-right font-mono text-accent-gold font-semibold">{formatPrice(p.bought_price)}</td>
                    <td className="py-2.5 text-right text-xs">
                      <span className={Number(premium) > 100 ? 'text-emerald-400' : Number(premium) > 0 ? 'text-amber-400' : 'text-gray-500'}>
                        {Number(premium) >= 0 ? '+' : ''}{premium}%
                      </span>
                    </td>
                    {auctionInfo.rtm_enabled && (
                      <td className="py-2.5 text-center">
                        {p.rtm_used === 1 ? <span className="text-amber-400 text-xs font-bold">RTM</span> : ''}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {sold_players.length === 0 && <p className="text-gray-600 text-sm py-4 text-center">No players sold yet</p>}
      </div>

      {/* Unsold Players */}
      {unsold_players.length > 0 && (
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <h2 className="font-display text-xl tracking-wider text-gray-500 mb-5">UNSOLD PLAYERS ({unsold_players.length})</h2>
          <div className="flex flex-wrap gap-2">
            {unsold_players.map((p: any) => (
              <span key={p.id} className="bg-surface-2/50 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-gray-400">
                {p.name} <span className="text-gray-600 text-xs">({p.role}, {formatPrice(p.base_price)})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* RTM Events */}
      {rtm_events.length > 0 && (
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <h2 className="font-display text-xl tracking-wider text-amber-400 mb-5">RTM EVENTS</h2>
          <div className="space-y-2">
            {rtm_events.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-surface-2/50 rounded-lg px-4 py-3 border border-white/5">
                <span className="text-white font-medium">{e.player}</span>
                <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${e.result === 'accepted' ? 'bg-amber-400/15 text-amber-400' : 'bg-gray-500/15 text-gray-400'}`}>
                  {e.result === 'accepted' ? 'RTM USED' : 'RTM DECLINED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bid Activity */}
      {team_bid_activity.length > 0 && (
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <h2 className="font-display text-xl tracking-wider text-purple-400 mb-5">BID ACTIVITY</h2>
          <div className="space-y-2">
            {team_bid_activity.map((t: any) => {
              const maxBids = team_bid_activity[0]?.bid_count || 1
              const pct = Math.round((t.bid_count / maxBids) * 100)
              return (
                <div key={t.team_name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-28 truncate">{t.short_name || t.team_name}</span>
                  <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 font-mono w-8 text-right">{t.bid_count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
