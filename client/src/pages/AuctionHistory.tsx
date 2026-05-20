import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, History, Users, TrendingUp, Search } from 'lucide-react'
import { getAuctionHistory, getTeams } from '../api'

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

  useEffect(() => {
    fetchData()
  }, [auctionId])

  const fetchData = async () => {
    try {
      const [historyData, teamsData] = await Promise.all([
        getAuctionHistory(aid),
        getTeams(aid),
      ])
      setHistory(historyData)
      setTeams(teamsData)
    } catch {
      /* */
    }
    setLoading(false)
  }

  const teamColorMap: Record<string, string> = {}
  teams.forEach((t, i) => {
    teamColorMap[t.name] = teamColors[i % teamColors.length]
  })

  const filtered = history.filter(entry => {
    const matchesSearch = entry.player.toLowerCase().includes(search.toLowerCase()) ||
      entry.team.toLowerCase().includes(search.toLowerCase())
    const matchesTeam = filterTeam === 'all' || entry.team === filterTeam
    return matchesSearch && matchesTeam
  })

  const totalSpent = history.reduce((sum, e) => sum + e.price, 0)
  const teamSpending: Record<string, number> = {}
  history.forEach(e => {
    teamSpending[e.team] = (teamSpending[e.team] || 0) + e.price
  })

  if (loading) return <div className="p-12 text-gray-400 text-center">Loading history...</div>

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">AUCTION HISTORY</span>
      </nav>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/auctions/${aid}`)} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Auction History</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <History className="w-5 h-5 text-blue-500" />
            <p className="text-xs text-gray-500 uppercase">Total Sold</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{history.length} players</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <p className="text-xs text-gray-500 uppercase">Total Spent</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(totalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-5 h-5 text-purple-500" />
            <p className="text-xs text-gray-500 uppercase">Teams Active</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{Object.keys(teamSpending).length}</p>
        </div>
      </div>

      {/* Team Spending Breakdown */}
      {Object.keys(teamSpending).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-bold text-gray-800 mb-4">Team Spending</h2>
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
                      <span className="font-medium text-gray-700">{team.name}</span>
                      <span className="text-gray-400">({team.short_name})</span>
                    </div>
                    <span className="text-gray-500">{formatPrice(spent)} / {formatPrice(team.total_budget)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search player or team..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <span className="text-sm text-gray-500">{filtered.length} results</span>
        </div>
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No auction history yet. Sold players will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
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
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-400">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                          {entry.player[0]}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{entry.player}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-sm text-gray-700">{entry.team}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-green-600">
                      {formatPrice(entry.price)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
