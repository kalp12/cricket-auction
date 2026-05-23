import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, History, Users, TrendingUp, Search, FileDown, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuctionHistory, getTeams, exportAuctionResults, exportTeamRosters } from '../api'
import { SkeletonTable, ExportMenu } from '../components/ui'

interface HistoryEntry {
  player: string
  team: string
  price: number
  timestamp: number
}

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

const teamColors = [
  'bg-blue-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500',
  'bg-green-500', 'bg-pink-500', 'bg-orange-500', 'bg-cyan-500',
]

export default function AuctionHistory() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('all')

  const aid = Number(auctionId)

  useEffect(() => { fetchData() }, [auctionId])

  const fetchData = async () => {
    try {
      const [historyData, teamsData] = await Promise.all([getAuctionHistory(aid), getTeams(aid)])
      setHistory(historyData); setTeams(teamsData)
    } catch { /* */ }
    setLoading(false)
  }

  const teamColorMap: Record<string, string> = {}
  teams.forEach((t, i) => { teamColorMap[t.name] = teamColors[i % teamColors.length] })

  const filtered = history.filter(entry => {
    const matchesSearch = entry.player.toLowerCase().includes(search.toLowerCase()) || entry.team.toLowerCase().includes(search.toLowerCase())
    const matchesTeam = filterTeam === 'all' || entry.team === filterTeam
    return matchesSearch && matchesTeam
  })

  const totalSpent = history.reduce((sum, e) => sum + e.price, 0)
  const teamSpending: Record<string, number> = {}
  history.forEach(e => { teamSpending[e.team] = (teamSpending[e.team] || 0) + e.price })

  if (loading) return <div className="animate-fade-in"><SkeletonTable rows={6} cols={5} /></div>

  return (
    <div className="animate-fade-in noise-bg relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-700/10 rounded-full blur-[100px] pointer-events-none" />

      <nav className="text-sm text-gray-600 mb-2">
        <span className="text-gray-600">HOME</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-700">›</span>
        <span className="text-gray-400">HISTORY</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/auctions/${aid}`)} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-3xl md:text-5xl tracking-wider gradient-text">AUCTION HISTORY</h1>
        <ExportMenu
          options={[
            { label: 'Auction Results', onClick: async (format) => { const blob = await exportAuctionResults(aid, format); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `auction_results.${format}`; a.click(); window.URL.revokeObjectURL(url) } },
            { label: 'Team Rosters', onClick: async (format) => { const blob = await exportTeamRosters(aid, format); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `team_rosters.${format}`; a.click(); window.URL.revokeObjectURL(url) } },
          ]}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: History, label: 'Total Sold', value: `${history.length} players`, color: 'text-primary-400' },
          { icon: TrendingUp, label: 'Total Spent', value: formatPrice(totalSpent), color: 'text-emerald-400' },
          { icon: Users, label: 'Teams Active', value: `${Object.keys(teamSpending).length}`, color: 'text-purple-400' },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-strong rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-1">
              <Icon className={`w-5 h-5 ${color}`} />
              <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Team Spending Breakdown */}
      {Object.keys(teamSpending).length > 0 && (
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-white mb-4">Team Spending</h2>
          <div className="space-y-3">
            {teams.map(team => {
              const spent = teamSpending[team.name] || 0
              const pct = team.total_budget > 0 ? Math.round((spent / team.total_budget) * 100) : 0
              const color = teamColorMap[team.name] || 'bg-gray-500'
              return (
                <div key={team.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      <span className="font-medium text-gray-300">{team.name}</span>
                      <span className="text-gray-600">({team.short_name})</span>
                    </div>
                    <span className="text-gray-500">{formatPrice(spent)} / {formatPrice(team.total_budget)}</span>
                  </div>
                  <div className="h-2 bg-surface-4 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6 border border-white/5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search player or team..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm" />
          </div>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-gray-300 text-sm focus:ring-2 focus:ring-accent-gold/50 outline-none">
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <span className="text-sm text-gray-600">{filtered.length} results</span>
        </div>
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="glass-strong rounded-2xl p-12 text-center">
          <History className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">No auction history yet. Sold players will appear here.</p>
        </div>
      ) : (
        <div className="glass-strong rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">#</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Player</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Team</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Sold Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const color = teamColorMap[entry.team] || 'bg-gray-500'
                return (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-gray-600 font-mono">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-full flex items-center justify-center text-sm font-bold text-white">
                          {entry.player[0]}
                        </div>
                        <span className="font-medium text-white text-sm">{entry.player}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-sm text-gray-400">{entry.team}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold gradient-text">
                      {formatPrice(entry.price)}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
