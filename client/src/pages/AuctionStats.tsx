import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, Users, Trophy, Target, BarChart3 } from 'lucide-react'
import { getAuctionStats } from '../api'

interface Stats {
  overview: { total_players: number; sold: number; unsold: number; total_spent: number; avg_price: number; max_price: number; min_price: number }
  role_breakdown: { role: string; count: number }[]
  country_breakdown: { country: string; count: number }[]
  most_expensive: { player_name: string; team_name: string; price: number } | null
  role_avg_price: Record<string, number>
  team_spending: { team_id: number; team_name: string; short_name: string; total_budget: number; remaining_budget: number; spent: number; players_bought: number }[]
  top_batsmen: { name: string; role: string; runs: number; matches: number; batting_avg: number; batting_sr: number; status: string }[]
  top_bowlers: { name: string; role: string; wickets: number; matches: number; bowling_avg: number; bowling_econ: number; status: string }[]
  highest_base: { name: string; role: string; country: string; base_price: number; status: string }[]
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const roleLabel = (r: string) => ({ batsman: 'Batsman', bowler: 'Bowler', allrounder: 'All-Rounder', wicketkeeper: 'WK' }[r] || r)
const roleColor = (r: string) => ({ batsman: 'bg-blue-500', bowler: 'bg-red-500', allrounder: 'bg-purple-500', wicketkeeper: 'bg-emerald-500' }[r] || 'bg-gray-500')
const roleBorder = (r: string) => ({ batsman: 'border-blue-500/20', bowler: 'border-red-500/20', allrounder: 'border-purple-500/20', wicketkeeper: 'border-emerald-500/20' }[r] || 'border-gray-500/20')

export default function AuctionStats() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const aid = Number(auctionId)

  useEffect(() => { fetchStats() }, [auctionId])

  const fetchStats = async () => {
    try { const data = await getAuctionStats(aid); setStats(data) } catch { /* */ }
    setLoading(false)
  }

  if (loading) return <div className="p-12 text-gray-600 text-center">Loading stats...</div>
  if (!stats) return <div className="p-12 text-gray-600 text-center">Failed to load stats</div>

  const { overview, role_breakdown, country_breakdown, most_expensive, role_avg_price, team_spending, top_batsmen, top_bowlers, highest_base } = stats

  return (
    <div className="animate-fade-in noise-bg relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-700/10 rounded-full blur-[100px] pointer-events-none" />

      <nav className="text-sm text-gray-600 mb-2">
        <span className="text-gray-600">HOME</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-400">STATS</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/auctions/${aid}`)} className="text-gray-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-display text-5xl tracking-wide gradient-text">AUCTION STATS</h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users, label: 'Players', value: overview.total_players, sub: `${overview.sold} sold / ${overview.unsold} unsold`, color: 'text-primary-400' },
          { icon: TrendingUp, label: 'Total Spent', value: formatPrice(overview.total_spent), sub: '', color: 'text-emerald-400' },
          { icon: Target, label: 'Avg Price', value: formatPrice(overview.avg_price), sub: `Range: ${formatPrice(overview.min_price)} – ${formatPrice(overview.max_price)}`, color: 'text-amber-400' },
          { icon: Trophy, label: 'Most Expensive', value: most_expensive?.player_name || 'N/A', sub: most_expensive ? `${most_expensive.team_name} — ${formatPrice(most_expensive.price)}` : 'No sales yet', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, value, sub, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-strong rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1"><Icon className={`w-4 h-4 ${color}`} /><p className="text-xs text-gray-500 uppercase">{label}</p></div>
            <p className="text-2xl font-bold text-white truncate">{value}</p>
            {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Role Breakdown */}
        <div className="glass-strong rounded-2xl p-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary-400" /> Role Breakdown</h2>
          <div className="space-y-3">
            {role_breakdown.map(r => {
              const pct = overview.total_players > 0 ? Math.round((r.count / overview.total_players) * 100) : 0
              const avg = role_avg_price[r.role]
              return (
                <div key={r.role}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${roleColor(r.role)}`} /><span className="font-medium text-gray-300">{roleLabel(r.role)}</span></div>
                    <span className="text-gray-500">{r.count} players{avg ? ` · avg ${formatPrice(avg)}` : ''}</span>
                  </div>
                  <div className="h-2 bg-surface-4 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${roleColor(r.role)} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Country Breakdown */}
        <div className="glass-strong rounded-2xl p-6">
          <h2 className="font-bold text-white mb-4">Countries</h2>
          <div className="flex flex-wrap gap-2">
            {country_breakdown.map(c => (
              <span key={c.country} className="px-3 py-1.5 rounded-full bg-surface-3 text-sm text-gray-300 font-medium border border-white/5">{c.country} <span className="text-gray-600">({c.count})</span></span>
            ))}
          </div>

          <h3 className="font-bold text-white mt-6 mb-3">Highest Base Prices</h3>
          <div className="space-y-2">
            {highest_base.map((p, i) => (
              <div key={i} className={`flex items-center justify-between text-sm p-2.5 rounded-xl border ${roleBorder(p.role)} bg-surface-2/50`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-mono w-4">#{i + 1}</span>
                  <span className="font-medium text-gray-200">{p.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${roleColor(p.role)} text-white`}>{roleLabel(p.role)}</span>
                </div>
                <span className="font-semibold gradient-text">{formatPrice(p.base_price)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cricket Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {[{ title: 'Top Batsmen', data: top_batsmen, cols: ['Mat', 'Runs', 'Avg', 'SR'], getCells: (p: any) => [p.matches, p.runs.toLocaleString(), p.batting_avg.toFixed(1), p.batting_sr.toFixed(1)] },
          { title: 'Top Bowlers', data: top_bowlers, cols: ['Mat', 'Wkts', 'Avg', 'Econ'], getCells: (p: any) => [p.matches, p.wickets, p.bowling_avg.toFixed(1), p.bowling_econ.toFixed(1)] }
        ].map(({ title, data, cols, getCells }) => (
          <div key={title} className="glass-strong rounded-2xl p-6">
            <h2 className="font-bold text-white mb-4">{title}</h2>
            {data.length === 0 ? (
              <p className="text-gray-600 text-sm">No data yet</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/5">
                <table className="w-full">
                  <thead><tr className="border-b border-white/5 bg-surface-2/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Player</th>
                    {cols.map(c => <th key={c} className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">{c}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.map((p, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2 text-sm font-medium text-gray-200">{p.name}</td>
                        {getCells(p).map((cell, j) => <td key={j} className={`px-4 py-2 text-sm text-right ${j === 1 ? 'font-semibold text-white' : 'text-gray-400'}`}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Team Spending */}
      <div className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-white mb-4">Team Spending</h2>
        <div className="space-y-3">
          {team_spending.sort((a, b) => b.spent - a.spent).map(team => {
            const pct = team.total_budget > 0 ? Math.round((team.spent / team.total_budget) * 100) : 0
            return (
              <div key={team.team_id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2"><span className="font-bold text-gray-300">{team.short_name || team.team_name}</span><span className="text-xs text-gray-600">{team.players_bought} players</span></div>
                  <span className="text-gray-500">{formatPrice(team.spent)} / {formatPrice(team.total_budget)} <span className="text-xs text-gray-600">({pct}%)</span></span>
                </div>
                <div className="h-2.5 bg-surface-4 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
