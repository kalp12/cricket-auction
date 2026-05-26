import axios from 'axios'

const BASE = 'http://localhost:8000'
const WS_BASE = 'ws://localhost:8000'
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

export const assetUrl = (url: string | null | undefined) => url ? (url.startsWith('http') ? url : `${BASE}${url}`) : null

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

// ── Users ─────────────────────────────────────────────
export const listUsersApi = async () =>
  (await axios.get(`${BASE}/api/users`, { headers: headers() })).data

export const inviteUserApi = async (email: string, role: string) =>
  (await axios.post(`${BASE}/api/users/invite`, { email, role }, { headers: headers() })).data

export const registerWithInvite = async (token: string, username: string, password: string) => {
  const res = await axios.post(`${BASE}/api/users/register`, { invite_token: token, username, password })
  return res.data
}

export const changeRoleApi = async (userId: number, role: string) =>
  (await axios.patch(`${BASE}/api/users/${userId}/role`, { role }, { headers: headers() })).data

export const deleteUserApi = async (userId: number) =>
  (await axios.delete(`${BASE}/api/users/${userId}`, { headers: headers() })).data

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

export const nextPlayer = async (id: number, playerId?: number) =>
  (await axios.post(`${BASE}/api/auctions/${id}/next-player`, null, { headers: headers() })).data

// ── Auction Flow (single active auction) ──────────────
export const getAuctionState = async (auctionId?: number) =>
  (await axios.get(`${BASE}/api/auction/state`, { params: auctionId ? { auction_id: auctionId } : {}, headers: headers() })).data

export const startAuction = async (player_id: number, timer_seconds = 60) =>
  (await axios.post(`${BASE}/api/auction/start`, null, { params: { player_id, timer_seconds }, headers: headers() })).data

export const placeBid = async (team_id: number, amount: number) =>
  (await axios.post(`${BASE}/api/auction/bid`, { team_id, amount }, { headers: headers() })).data

export const soldPlayer = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/sold`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const unsoldPlayer = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/unsold`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const rtmAccept = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/rtm-accept`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

export const rtmDecline = async (auctionId?: number) =>
  (await axios.post(`${BASE}/api/auction/rtm-decline`, {}, { params: { auction_id: auctionId }, headers: headers() })).data

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
  return res.data
}

// ── Audio Upload ──────────────────────────────────────
export const uploadAudio = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/upload/audio`, formData, {
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  })
  return res.data
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
  return res.data
}

export const importPlayers = async (auctionId: number, mapping: Record<string, string>, rows: any[]) =>
  (await axios.post(`${BASE}/api/import/players/commit`, { auction_id: auctionId, mapping, rows }, { headers: headers() })).data

// ── Team Import ───────────────────────────────────────
export const downloadTeamTemplate = async () =>
  (await axios.get(`${BASE}/api/import/teams/template`, { headers: headers(), responseType: 'blob' })).data

export const uploadTeamFile = async (auctionId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/import/teams/upload`, formData, {
    params: { auction_id: auctionId },
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const importTeams = async (auctionId: number, mapping: Record<string, string>, rows: any[]) =>
  (await axios.post(`${BASE}/api/import/teams/commit`, { auction_id: auctionId, mapping, rows }, { headers: headers() })).data


// ── Export ────────────────────────────────────────────
export const exportPlayers = async (auctionId: number, format: 'xlsx' | 'csv' = 'xlsx') =>
  (await axios.get(`${BASE}/api/export/players`, { params: { auction_id: auctionId, format }, headers: headers(), responseType: 'blob' })).data

export const exportAuctionResults = async (auctionId: number, format: 'xlsx' | 'csv' = 'xlsx') =>
  (await axios.get(`${BASE}/api/export/auction-results`, { params: { auction_id: auctionId, format }, headers: headers(), responseType: 'blob' })).data

export const exportTeamRosters = async (auctionId: number, format: 'xlsx' | 'csv' = 'xlsx') =>
  (await axios.get(`${BASE}/api/export/team-rosters`, { params: { auction_id: auctionId, format }, headers: headers(), responseType: 'blob' })).data


// ── Stats Import ──────────────────────────────────────
export const uploadStatsFile = async (auctionId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/stats-import/upload`, formData, {
    params: { auction_id: auctionId },
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const commitStatsImport = async (auctionId: number, source: string, mapping: Record<string, string>, rows: any[], playerOverrides: Record<string, number>) =>
  (await axios.post(`${BASE}/api/stats-import/commit`, { auction_id: auctionId, source, mapping, rows, player_overrides: playerOverrides }, { headers: headers() })).data

export const getStatsHistory = async (playerId: number) =>
  (await axios.get(`${BASE}/api/stats-import/history/${playerId}`, { headers: headers() })).data

// ── Player Registration ───────────────────────────────
export const submitRegistration = async (auctionId: number, data: any) =>
  (await axios.post(`${BASE}/api/registration/${auctionId}/submit`, data)).data

export const getRegistrationStatus = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/registration/${auctionId}/status`)).data

export const listRegistrations = async (auctionId: number, status?: string) =>
  (await axios.get(`${BASE}/api/registration/${auctionId}/list`, { params: status ? { status } : {}, headers: headers() })).data

export const approveRegistration = async (registrationId: number) =>
  (await axios.post(`${BASE}/api/registration/${registrationId}/approve`, null, { headers: headers() })).data

export const rejectRegistration = async (registrationId: number) =>
  (await axios.post(`${BASE}/api/registration/${registrationId}/reject`, null, { headers: headers() })).data

export const toggleRegistration = async (auctionId: number) =>
  (await axios.post(`${BASE}/api/registration/${auctionId}/toggle`, null, { headers: headers() })).data

export const uploadRegistrationImage = async (auctionId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${BASE}/api/registration/${auctionId}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const setRegistrationDeadline = async (auctionId: number, deadline: string | null) =>
  (await axios.put(`${BASE}/api/registration/${auctionId}/deadline`, null, { params: { deadline }, headers: headers() })).data

export const updateRegistrationFormConfig = async (auctionId: number, config: any) =>
  (await axios.put(`${BASE}/api/registration/${auctionId}/form-config`, config, { headers: headers() })).data

// ── Replay ────────────────────────────────────────────
export const getAuctionReplay = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/auctions/${auctionId}/replay`, { headers: headers() })).data

export const getAuctionEvents = async (auctionId: number, afterEventId: number = 0) =>
  (await axios.get(`${BASE}/api/auctions/${auctionId}/events`, { params: { after_event_id: afterEventId }, headers: headers() })).data

// ── Post-Auction Report ───────────────────────────────
export const getAuctionReport = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/auction/${auctionId}/report`, { headers: headers() })).data

// ── Public (Spectator) ────────────────────────────────
export const getPublicAuction = async (auctionId: number) =>
  (await axios.get(`${BASE}/api/auctions/${auctionId}/public`)).data

export const getPublicAuctionState = async (auctionId?: number) =>
  (await axios.get(`${BASE}/api/auction/state/public`, { params: auctionId ? { auction_id: auctionId } : {} })).data

export { BASE, WS_BASE }
