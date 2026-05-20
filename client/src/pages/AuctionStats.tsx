import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Users, Trophy, Target, BarChart3 } from 'lucide-react'
import { getAuctionStats } from '../api'

interface Stats {
  overview: {
    total_players: number
    sold: number
    unsold: number
    total_spent: number
    avg_price: number
    max_price: number
    min_price: number
  }
  role_breakdown: { role: string; count: number }[]
  country_breakdown: { country: string; count: number }[]
  most_expensive: { player_name: string; team_name: string; price: number } | null
  role_avg_price: Record<string, number>
  team_spending: {
    team_id: number
    team_name: string
    short_name: string
    total_budget: number
    remaining_budget: number
    spent: number
    players_bought: number
  }[]
  top_batsmen: { name: string; role: string; runs: number; matches: number; batting_avg: number; batting_sr: number; status: string }[]
  top_bowlers: { name: string; role: string; wickets: number; matches: number; bowling_avg: number; bowling_econ: number; status: string }[]
  highest_base: { name: string; role: string; country: string; base_price: number; status: string }[]
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const roleLabel = (r: string) => {
  const map: Record<string, string> = { batsman: 'Batsman', bowler: 'Bowler', allrounder: 'All-Rounder', wicketkeeper: 'WK' }
  return map[r] || r
}

const roleColor = (r: string) => {
  const map: Record<string, string> = { batsman: 'bg-blue-500', bowler: 'bg-red-500', allrounder: 'bg-purple-500', wicketkeeper: 'bg-green-500' }
  return map[r] || 'bg-gray-500'
}

const roleBorder = (r: string) => {
  const map: Record<string, string> = { batsman: 'border-blue-200', bowler: 'border-red-200', allrounder: 'border-purple-200', wicketkeeper: 'border-green-200' }
  return map[r] || 'border-gray-200'
}

export default function AuctionStats() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const aid = Number(auctionId)

  useEffect(() => {
    fetchStats()
  }, [auctionId])

  const fetchStats = async () => {
    try {
      const data = await getAuctionStats(aid)
      setStats(data)
    } catch { /* */ }
    setLoading(false)
  }

  if (loading) return <div className="p-12 text-gray-400 text-center">Loading stats...</div>
  if (!stats) return <div className="p-12 text-gray-400 text-center">Failed to load stats</div>

  const { overview, role_breakdown, country_breakdown, most_expensive, role_avg_price, team_spending, top_batsmen, top_bowlers, highest_base } = stats

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">STATS</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/auctions/${aid}`)} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Auction Stats</h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-gray-500 uppercase">Players</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{overview.total_players}</p>
          <p className="text-xs text-gray-400 mt-1">{overview.sold} sold / {overview.unsold} unsold</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 uppercase">Total Spent</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(overview.total_spent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-yellow-500" />
            <p className="text-xs text-gray-500 uppercase">Avg Price</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(overview.avg_price)}</p>
          <p className="text-xs text-gray-400 mt-1">Range: {formatPrice(overview.min_price)} – {formatPrice(overview.max_price)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-purple-500" />
            <p className="text-xs text-gray-500 uppercase">Most Expensive</p>
          </div>
          {most_expensive ? (
            <>
              <p className="text-lg font-bold text-gray-800 truncate">{most_expensive.player_name}</p>
              <p className="text-xs text-gray-400">{most_expensive.team_name} — {formatPrice(most_expensive.price)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No sales yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Role Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" /> Role Breakdown
          </h2>
          <div className="space-y-3">
            {role_breakdown.map(r => {
              const pct = overview.total_players > 0 ? Math.round((r.count / overview.total_players) * 100) : 0
              const avg = role_avg_price[r.role]
              return (
                <div key={r.role}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${roleColor(r.role)}`} />
                      <span className="font-medium text-gray-700">{roleLabel(r.role)}</span>
                    </div>
                    <span className="text-gray-500">{r.count} players{avg ? ` · avg ${formatPrice(avg)}` : ''}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${roleColor(r.role)} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Country Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Countries</h2>
          <div className="flex flex-wrap gap-2">
            {country_breakdown.map(c => (
              <span key={c.country} className="px-3 py-1.5 rounded-full bg-gray-100 text-sm text-gray-700 font-medium">
                {c.country} <span className="text-gray-400">({c.count})</span>
              </span>
            ))}
          </div>

          {/* Highest Base Prices */}
          <h3 className="font-bold text-gray-800 mt-6 mb-3">Highest Base Prices</h3>
          <div className="space-y-2">
            {highest_base.map((p, i) => (
              <div key={i} className={`flex items-center justify-between text-sm p-2 rounded-lg border ${roleBorder(p.role)}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-4">#{i + 1}</span>
                  <span className="font-medium text-gray-800">{p.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${roleColor(p.role)} text-white`}>{roleLabel(p.role)}</span>
                </div>
                <span className="font-semibold text-gray-700">{formatPrice(p.base_price)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cricket Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Batsmen */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Top Batsmen</h2>
          {top_batsmen.length === 0 ? (
            <p className="text-gray-400 text-sm">No batsmen with stats yet</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Player</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Mat</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Runs</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Avg</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {top_batsmen.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-sm font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">{p.matches}</td>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-800 text-right">{p.runs.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">{p.batting_avg.toFixed(1)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">{p.batting_sr.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Bowlers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Top Bowlers</h2>
          {top_bowlers.length === 0 ? (
            <p className="text-gray-400 text-sm">No bowlers with stats yet</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Player</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Mat</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Wkts</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Avg</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {top_bowlers.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-sm font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">{p.matches}</td>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-800 text-right">{p.wickets}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">{p.bowling_avg.toFixed(1)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">{p.bowling_econ.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Team Spending */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">Team Spending</h2>
        <div className="space-y-3">
          {team_spending.sort((a, b) => b.spent - a.spent).map(team => {
            const pct = team.total_budget > 0 ? Math.round((team.spent / team.total_budget) * 100) : 0
            const remainingPct = team.total_budget > 0 ? Math.round((team.remaining_budget / team.total_budget) * 100) : 0
            return (
              <div key={team.team_id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700">{team.short_name || team.team_name}</span>
                    <span className="text-xs text-gray-400">{team.players_bought} players</span>
                  </div>
                  <span className="text-gray-500">{formatPrice(team.spent)} / {formatPrice(team.total_budget)} <span className="text-xs">({pct}%)</span></span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
