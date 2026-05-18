import { useState, useEffect } from 'react'
import { getAuctionState, getPlayers, getTeams,
         startAuction, placeBid, soldPlayer, unsoldPlayer } from '../api'

export default function Auction() {
  const [auction, setAuction] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [bidAmounts, setBidAmounts] = useState<{[key:number]:string}>({})
  const [message, setMessage] = useState('')

  const fetchAll = async () => {
    try {
      const a = await getAuctionState()
      setAuction(a)
      const auctionId = a?.current_auction?.id
      if (auctionId) {
        const [p, t] = await Promise.all([getPlayers(auctionId), getTeams(auctionId)])
        setPlayers(p.players || p)
        setTeams(t)
      }
    } catch(e) { console.error(e) }
  }

  useEffect(() => {
    fetchAll()
    let ws: WebSocket | null = null
    const connectWs = async () => {
      try {
        const state = await getAuctionState()
        const auctionId = state?.current_auction?.id
        if (auctionId) {
          ws = new WebSocket(`ws://localhost:8000/ws/auction/${auctionId}`)
          ws.onmessage = () => fetchAll()
        }
      } catch { /* no auction yet */ }
    }
    connectWs()
    return () => { if (ws) ws.close() }
  }, [])

  const isLive = auction?.status === 'live'
  const unsoldPlayers = players.filter(p => p.status === 'unsold')

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🏏 Cricket Auction</h1>
        <button onClick={() => { localStorage.removeItem('token'); window.location.href='/login' }}
          className="bg-gray-600 px-4 py-2 rounded">Logout</button>
      </div>

      {message && (
        <div className="bg-blue-800 p-3 rounded mb-4 text-center">
          {message} <button onClick={() => setMessage('')} className="ml-4">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
          <div className="flex gap-3 mb-4 items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              isLive ? 'bg-green-500' : auction?.status==='paused' ? 'bg-yellow-500' : 'bg-gray-500'}`}>
              {auction?.status?.toUpperCase() || 'LOADING'}
            </span>
            <h2 className="text-xl font-bold">Live Auction</h2>
          </div>

          {isLive ? (
            <div className="text-center py-6">
              <h3 className="text-4xl font-bold mb-2">{auction.current_player_name}</h3>
              <div className="text-5xl font-bold text-green-400 my-4">
                ₹{auction.current_bid?.toLocaleString()}
              </div>
              {auction.current_team_name && (
                <p className="text-yellow-400 text-lg">Leading: {auction.current_team_name}</p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No active auction</div>
          )}

          <div className="flex gap-3 mt-4 flex-wrap">
            {!isLive && (
              <div className="flex gap-2 w-full">
                <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}
                  className="flex-1 bg-gray-700 text-white p-2 rounded">
                  <option value="">Select Player to Auction</option>
                  {unsoldPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.base_price?.toLocaleString()}</option>
                  ))}
                </select>
                <button onClick={async () => {
                  if (!selectedPlayer) return
                  try { await startAuction(parseInt(selectedPlayer)); await fetchAll(); setMessage('Started!') }
                  catch(e:any) { setMessage(e?.response?.data?.detail || 'Error') }
                }} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold">
                  Start
                </button>
              </div>
            )}
            {isLive && <>
              <button onClick={async () => {
                try { const r = await soldPlayer(); setMessage(`Sold! ${r.player} → ${r.team}`); await fetchAll() }
                catch(e:any) { setMessage(e?.response?.data?.detail || 'Error') }
              }} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-bold">✅ Sold</button>
              <button onClick={async () => {
                try { await unsoldPlayer(); setMessage('Unsold'); await fetchAll() }
                catch(e:any) { setMessage(e?.response?.data?.detail || 'Error') }
              }} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-bold">❌ Unsold</button>
            </>}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">Teams & Bidding</h2>
          <div className="space-y-3">
            {teams.map((team:any) => (
              <div key={team.id} className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-bold">{team.name}</h3>
                <p className="text-green-400">₹{team.remaining_budget?.toLocaleString()}</p>
                <p className="text-gray-400 text-xs">of ₹{team.total_budget?.toLocaleString()}</p>
                {isLive && (
                  <div className="flex gap-2 mt-2">
                    <input type="number" placeholder="Amount"
                      value={bidAmounts[team.id] || ''}
                      onChange={e => setBidAmounts({...bidAmounts, [team.id]: e.target.value})}
                      className="flex-1 bg-gray-700 text-white p-2 rounded text-sm" />
                    <button onClick={async () => {
                      const amt = parseFloat(bidAmounts[team.id] || '0')
                      if (!amt) return
                      try { await placeBid(team.id, amt); await fetchAll(); setMessage(`Bid ₹${amt.toLocaleString()}`) }
                      catch(e:any) { setMessage(e?.response?.data?.detail || 'Bid failed') }
                    }} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-bold">Bid</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}