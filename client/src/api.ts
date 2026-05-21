import axios from 'axios'

const BASE = 'http://localhost:8000'
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

// ── Auth ──────────────────────────────────────────────
export const login = async (u: string, p: string) => {
  const form = new URLSearchParams()
  form.append('username', u)
  form.append('password', p)
  const res = await axios.post(`${BASE}/api/auth/login`, form)
  return res.data
}

export const getMe = async () =>
  (await axios.get(`${BASE}/api/auth/me`, { headers: headers() })).data

// ── Auctions (CRUD) ───────────────────────────────────
export const createAuction = async (data: {
  name: string
  timer_seconds?: number
  timer_mode?: string
  base_bid?: number
  budget_per_team?: number
  min_players?: number
  max_players?: number
  image_url?: string
}) => (await axios.post(`${BASE}/api/auctions`, data, { headers: headers() })).data

export const listAuctions = async () =>
  (await axios.get(`${BASE}/api/auctions`, { headers: headers() })).data

export const getAuction = async (id: number) =>
  (await axios.get(`${BASE}/api/auctions/${id}`, { headers: headers() })).data

export const updateAuction = async (id: number, data: any) =>
  (await axios.put(`${BASE}/api/auctions/${id}`, data, { headers: headers() })).data

export const deleteAuction = async (id: number) =>
  (await axios.delete(`${BASE}/api/auctions/${id}`, { headers: headers() })).data

export const startAuctionById = async (id: number) =>
  (await axios.post(`${BASE}/api/auctions/${id}/start`, null, { headers: headers() })).data

export const nextPlayer = async (id: number) =>
  (await axios.post(`${BASE}/api/auctions/${id}/next-player`, null, { headers: headers() })).data

// ── Auction Flow (single active auction) ──────────────
export const getAuctionState = async () =>
  (await axios.get(`${BASE}/api/auction/state`, { headers: headers() })).data

export const startAuction = async (player_id: number, timer_seconds = 60) =>
  (await axios.post(`${BASE}/api/auction/start`, null, { params: { player_id, timer_seconds }, headers: headers() })).data

export const placeBid = async (team_id: number, amount: number) =>
  (await axios.post(`${BASE}/api/auction/bid`, { team_id, amount }, { headers: headers() })).data

export const soldPlayer = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/sold`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const unsoldPlayer = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/unsold`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const pauseAuction = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/pause`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const resumeAuction = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/resume`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const getAuctionHistory = async (auctionId?: number) =>
  (await axios.get(`${BASE}/api/auction/history`, { params: { auction_id: auctionId }, headers: headers() })).data

export const triggerSound = async (auctionId: number, soundKey: string) =>
  (await axios.post(`${BASE}/api/auction/play-sound`, null, { params: { auction_id: auctionId, sound_key: soundKey }, headers: headers() })).data

// ── Players (scoped to auction) ───────────────────────
export const getPlayers = async (auctionId: number, params?: { role?: string; status?: string }) =>
  (await axios.get(`${BASE}/api/players`, { params: { auction_id: auctionId, ...params }, headers: headers() })).data

export const getPlayer = async (id: number) =>
  (await axios.get(`${BASE}/api/players/${id}`, { headers: headers() })).data

export const createPlayer = async (data: { auction_id: number; name: string; role: string; country: string; base_price: number; image_url?: string }) =>
  (await axios.post(`${BASE}/api/players`, data, { headers: headers() })).data

export const updatePlayer = async (id: number, data: any) =>
  (await axios.put(`${BASE}/api/players/${id}`, data, { headers: headers() })).data

export const deletePlayer = async (id: number) =>
  (await axios.delete(`${BASE}/api/players/${id}`, { headers: headers() })).data

export const bulkCreatePlayers = async (players: any[]) =>
  (await axios.post(`${BASE}/api/players/bulk`, players, { headers: headers() })).data

// ── Teams (scoped to auction) ─────────────────────────
export const getTeams = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/teams`, { params: { auction_id: auctionId }, headers: headers() })).data

export const getTeam = async (id: number) =>
  (await axios.get(`${BASE}/api/teams/${id}`, { headers: headers() })).data

export const createTeam = async (data: { auction_id: number; name: string; short_name?: string; total_budget: number; max_players?: number; logo_url?: string }) =>
  (await axios.post(`${BASE}/api/teams`, data, { headers: headers() })).data

export const updateTeam = async (id: number, data: any) =>
  (await axios.put(`${BASE}/api/teams/${id}`, data, { headers: headers() })).data

export const deleteTeam = async (id: number) =>
  (await axios.delete(`${BASE}/api/teams/${id}`, { headers: headers() })).data

export const getTeamBudget = async (id: number) =>
  (await axios.get(`${BASE}/api/teams/${id}/budget`, { headers: headers() })).data

// ── Bid Increment Slabs ───────────────────────────────
export const getSlabs = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/slabs`, { params: { auction_id: auctionId }, headers: headers() })).data

export const createSlab = async (data: { auction_id: number; min_price: number; max_price: number; increment: number }) =>
  (await axios.post(`${BASE}/api/slabs`, data, { headers: headers() })).data

export const bulkCreateSlabs = async (slabs: { auction_id: number; min_price: number; max_price: number; increment: number }[]) =>
  (await axios.post(`${BASE}/api/slabs/bulk`, { slabs }, { headers: headers() })).data

export const createDefaultSlabs = async (auctionId: number) =>
  (await axios.post(`${BASE}/api/slabs/defaults/${auctionId}`, null, { headers: headers() })).data

export const updateSlab = async (id: number, data: { min_price?: number; max_price?: number; increment?: number }) =>
  (await axios.put(`${BASE}/api/slabs/${id}`, data, { headers: headers() })).data

export const deleteSlab = async (id: number) =>
  (await axios.delete(`${BASE}/api/slabs/${id}`, { headers: headers() })).data

// ── Stats ─────────────────────────────────────────────
export const getAuctionStats = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/auction/${auctionId}/stats`, { headers: headers() })).data

// ── Image Upload ──────────────────────────────────────
export const uploadImage = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/upload/image`, formData, {
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  })
  return res.data // { url: "/uploads/abc123.png" }
}

// ── Audio Upload ──────────────────────────────────────
export const uploadAudio = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/upload/audio`, formData, {
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  })
  return res.data // { url: "/uploads/abc123.mp3" }
}

// ── Player Import ─────────────────────────────────────
export const downloadPlayerTemplate = async () =>
  (await axios.get(`${BASE}/api/import/players/template`, { headers: headers(), responseType: 'blob' })).data

export const uploadPlayerFile = async (auctionId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/import/players/upload`, formData, {
    params: { auction_id: auctionId },
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  })
  return res.data // { headers: [...], rows: [...] }
}

export const importPlayers = async (auctionId: number, mapping: Record<string, string>, rows: any[]) =>
  (await axios.post(`${BASE}/api/import/players/commit`, { auction_id: auctionId, mapping, rows }, { headers: headers() })).data
