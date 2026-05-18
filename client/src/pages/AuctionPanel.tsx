import { Gavel } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AuctionPanel() {
  const navigate = useNavigate()

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">AUCTION PANEL</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">Auction Panel</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">Live auction room will appear here in Phase 4.</p>
        <button
          onClick={() => navigate('/auction')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Open Basic Auction (Current)
        </button>
      </div>
    </div>
  )
}
