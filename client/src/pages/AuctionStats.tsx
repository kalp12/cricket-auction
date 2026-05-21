import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, Users, Trophy, Target, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getAuctionStats } from '../api'
import { SkeletonStats, EmptyState } from '../components/ui'

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

const shortPrice = (val: number) => {
  if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000) return `${(val / 100000).toFixed(0)}L`
  return `${val.toLocaleString()}`
}

const roleLabel = (r: string) => ({ batsman: 'Batsman', bowler: 'Bowler', allrounder: 'All-Rounder', wicketkeeper: 'WK' }[r] || r)
const roleColor = (r: string) => ({ batsman: '#3b82f6', bowler: '#ef4444', allrounder: '#a855f7', wicketkeeper: '#10b981' }[r] || '#6b7280')
const roleBg = (r: string) => ({ batsman: 'bg-blue-500', bowler: 'bg-red-500', allrounder: 'bg-purple-500', wicketkeeper: 'bg-emerald-500' }[r] || 'bg-gray-500')
const roleBorder = (r: string) => ({ batsman: 'border-blue-500/20', bowler: 'border-red-500/20', allrounder: 'border-purple-500/20', wicketkeeper: 'border-emerald-500/20' }[r] || 'border-gray-500/20')

const CHART_COLORS = ['#6366f1', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#e879f9']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-lg px-3 py-2 border border-white/10 shadow-xl">
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? formatPrice(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }: any) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#9ca3af" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={500}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  )
}

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

  if (loading) return <div className="animate-fade-in"><SkeletonStats /></div>
  if (!stats) return <div className="p-12 text-gray-600 text-center">Failed to load stats</div>

  const { overview, role_breakdown, country_breakdown, most_expensive, role_avg_price, team_spending, top_batsmen, top_bowlers, highest_base } = stats

  // Chart data
  const rolePieData = role_breakdown.map(r => ({ name: roleLabel(r.role), value: r.count, fill: roleColor(r.role) }))
  const countryPieData = country_breakdown.map((c, i) => ({ name: c.country, value: c.count, fill: CHART_COLORS[i % CHART_COLORS.length] }))

  const teamBarData = team_spending
    .sort((a, b) => b.spent - a.spent)
    .map(t => ({
      name: t.short_name || t.team_name,
      Spent: t.spent,
      Remaining: t.remaining_budget,
      Players: t.players_bought,
    }))

  const roleAvgData = Object.entries(role_avg_price).map(([role, avg]) => ({
    name: roleLabel(role),
    avg: avg,
    fill: roleColor(role),
  }))

  return (
    <div className="animate-fade-in noise-bg relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-700/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-700/10 rounded-full blur-[100px] pointer-events-none" />

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

      {/* Row 1: Role Pie + Country Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-strong rounded-2xl p-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-primary-400" /> Role Breakdown</h2>
          {rolePieData.length === 0 ? (
            <EmptyState icon={PieChartIcon} title="No player data yet" message="Add players to see role breakdown." className="py-4" />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={rolePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} labelLine={false} label={PieLabel} animationBegin={0} animationDuration={800}>
                    {rolePieData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {role_breakdown.map(r => {
                  const avg = role_avg_price[r.role]
                  return (
                    <div key={r.role} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: roleColor(r.role) }} />
                        <span className="font-medium text-gray-300 text-sm">{roleLabel(r.role)}</span>
                      </div>
                      <span className="text-gray-500 text-sm">{r.count}{avg ? ` · avg ${formatPrice(avg)}` : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-strong rounded-2xl p-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary-400" /> Country Breakdown</h2>
          {countryPieData.length === 0 ? (
            <EmptyState icon={BarChart3} title="No country data" message="Add players to see country breakdown." className="py-4" />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={countryPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2} labelLine={false} label={PieLabel} animationBegin={0} animationDuration={800}>
                    {countryPieData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-wrap gap-2">
                {country_breakdown.map((c, i) => (
                  <span key={c.country} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-3 text-sm text-gray-300 font-medium border border-white/5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {c.country} <span className="text-gray-600">({c.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 2: Team Spending Bar Chart */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary-400" /> Team Spending</h2>
        {teamBarData.length === 0 ? (
          <EmptyState icon={BarChart3} title="No spending data" message="Teams will appear here once bidding starts." className="py-4" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamBarData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <XAxis type="number" tickFormatter={shortPrice} stroke="#4b5563" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Bar dataKey="Spent" fill="#6366f1" radius={[0, 4, 4, 0]} animationDuration={800} />
                <Bar dataKey="Remaining" fill="#1e1b4b" radius={[0, 4, 4, 0]} animationDuration={800} animationBegin={200} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {team_spending.sort((a, b) => b.spent - a.spent).map(team => {
                const pct = team.total_budget > 0 ? Math.round((team.spent / team.total_budget) * 100) : 0
                return (
                  <div key={team.team_id} className="flex items-center gap-3 text-sm">
                    <span className="font-bold text-gray-300 w-16 shrink-0">{team.short_name || team.team_name}</span>
                    <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-28 text-right shrink-0">{formatPrice(team.spent)} / {formatPrice(team.total_budget)}</span>
                    <span className="text-xs text-gray-600 w-8 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </motion.div>

      {/* Row 3: Role Avg Price Bar + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-strong rounded-2xl p-6">
          <h2 className="font-bold text-white mb-4">Avg Price by Role</h2>
          {roleAvgData.length === 0 ? (
            <EmptyState icon={BarChart3} title="No pricing data" message="Avg price by role will appear after sales." className="py-4" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={roleAvgData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis tickFormatter={shortPrice} stroke="#4b5563" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" name="Avg Price" radius={[4, 4, 0, 0]} animationDuration={800}>
                  {roleAvgData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-strong rounded-2xl p-6">
          <h2 className="font-bold text-white mb-4">Players per Team</h2>
          {teamBarData.length === 0 ? (
            <EmptyState icon={Users} title="No team data" message="Teams will appear here once created." className="py-4" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={teamBarData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <XAxis type="number" stroke="#4b5563" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Players" fill="#10b981" radius={[0, 4, 4, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Row 4: Cricket Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {[{ title: 'Top Batsmen', data: top_batsmen, cols: ['Mat', 'Runs', 'Avg', 'SR'], getCells: (p: any) => [p.matches, p.runs.toLocaleString(), p.batting_avg.toFixed(1), p.batting_sr.toFixed(1)] },
          { title: 'Top Bowlers', data: top_bowlers, cols: ['Mat', 'Wkts', 'Avg', 'Econ'], getCells: (p: any) => [p.matches, p.wickets, p.bowling_avg.toFixed(1), p.bowling_econ.toFixed(1)] }
        ].map(({ title, data, cols, getCells }) => (
          <motion.div key={title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-strong rounded-2xl p-6">
            <h2 className="font-bold text-white mb-4">{title}</h2>
            {data.length === 0 ? (
            <EmptyState icon={Users} title="No stats yet" message="Cricket stats will appear after players are added." className="py-2" />
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
          </motion.div>
        ))}
      </div>

      {/* Row 5: Highest Base Prices */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-strong rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-white mb-4">Highest Base Prices</h2>
        {highest_base.length === 0 ? (
          <EmptyState icon={Trophy} title="No base prices" message="Players with base prices will appear here." className="py-4" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={highest_base.slice(0, 8).map(p => ({ name: p.name, Base: p.base_price, fill: roleColor(p.role) }))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} angle={-20} textAnchor="end" height={50} />
                <YAxis tickFormatter={shortPrice} stroke="#4b5563" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Base" name="Base Price" radius={[4, 4, 0, 0]} animationDuration={800}>
                  {highest_base.slice(0, 8).map((p, i) => <Cell key={i} fill={roleColor(p.role)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {highest_base.map((p, i) => (
                <div key={i} className={`flex items-center justify-between text-sm p-2.5 rounded-xl border ${roleBorder(p.role)} bg-surface-2/50`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-mono w-4">#{i + 1}</span>
                    <span className="font-medium text-gray-200">{p.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${roleBg(p.role)} text-white`}>{roleLabel(p.role)}</span>
                  </div>
                  <span className="font-semibold gradient-text">{formatPrice(p.base_price)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
