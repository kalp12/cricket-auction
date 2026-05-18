import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gavel } from 'lucide-react'
import { listAuctions } from '../api'

export default function AuctionPanel() {
  const navigate = useNavigate()
  const [auctions, setAuctions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const data = await listAuctions()
        setAuctions(data)
      } catch { /* empty */ } finally {
        setLoading(false)
      }
    }
    fetchAuctions()
  }, [])

  if (loading) return <div className="text-gray-400 p-12 text-center">Loading...</div>

  if (auctions.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Auction Panel</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No auctions yet. Create one first.</p>
          <button
            onClick={() => navigate('/auctions/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
          >
            Create Auction
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Auction Panel</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctions.map(a => (
          <button
            key={a.id}
            onClick={() => navigate(`/auctions/${a.id}/live`)}
            className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                a.status === 'live' ? 'bg-green-100 text-green-700' :
                a.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                a.status === 'ended' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {a.status.toUpperCase()}
              </span>
            </div>
            <h3 className="font-bold text-gray-800">{a.name}</h3>
            <p className="text-sm text-gray-500 mt-1">Click to open live auction</p>
          </button>
        ))}
      </div>
    </div>
  )
}
