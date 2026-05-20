import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Plus, Clock, Play, Pause, CheckCircle } from 'lucide-react'
import { listAuctions } from '../api'

const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  waiting: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock, label: 'Waiting' },
  live: { bg: 'bg-green-100', text: 'text-green-700', icon: Play, label: 'Live' },
  paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Pause, label: 'Paused' },
  ended: { bg: 'bg-red-100', text: 'text-red-700', icon: CheckCircle, label: 'Ended' },
}

export default function MyAuctions() {
  const navigate = useNavigate()
  const [auctions, setAuctions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAuctions()
  }, [])

  const fetchAuctions = async () => {
    try {
      const data = await listAuctions()
      setAuctions(data)
    } catch {
      /* auth issue */
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
    return `₹${val.toLocaleString()}`
  }

  if (loading) return <div className="text-gray-400 p-12 text-center">Loading auctions...</div>

  return (
    <div className="animate-fade-in">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">MY AUCTIONS</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Auctions</h1>
        <button
          onClick={() => navigate('/auctions/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Auction
        </button>
      </div>

      {auctions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No auctions yet. Create your first one!</p>
          <button
            onClick={() => navigate('/auctions/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Create Auction
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {auctions.map(auction => {
            const s = statusConfig[auction.status] || statusConfig.waiting
            const Icon = s.icon
            return (
              <button
                key={auction.id}
                onClick={() => navigate(`/auctions/${auction.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-md hover:border-blue-300 transition-all duration-200 group hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-lg font-bold text-blue-600">{auction.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${s.bg} ${s.text} flex items-center gap-1`}>
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{auction.name}</h3>
                <p className="text-xs font-mono text-gray-400 mt-1">A-{String(auction.id).padStart(3, '0')}</p>

                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400">Budget</p>
                    <p className="text-sm font-semibold text-gray-700">{formatPrice(auction.budget_per_team)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Base Bid</p>
                    <p className="text-sm font-semibold text-gray-700">{formatPrice(auction.base_bid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Timer</p>
                    <p className="text-sm font-semibold text-gray-700">{auction.timer_enabled ? `${auction.timer_seconds}s` : 'Off'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Players</p>
                    <p className="text-sm font-semibold text-gray-700">{auction.min_players}–{auction.max_players}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
