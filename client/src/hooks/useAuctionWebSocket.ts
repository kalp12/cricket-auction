import { useState, useEffect, useRef, useCallback } from 'react'
import { WS_BASE } from '../api'

interface PlayerData {
  id: number
  name: string
  role: string
  country: string
  base_price: number
  image_url?: string
  matches?: number
  runs?: number
  wickets?: number
  batting_avg?: number
  batting_sr?: number
  bowling_avg?: number
  bowling_econ?: number
}

interface TeamData {
  id: number
  name: string
  short_name?: string
  logo_url?: string
  remaining_budget?: number
  total_budget?: number
  budget_tier?: string
}

interface SoldOverlayData {
  type: 'sold' | 'unsold'
  playerName: string
  teamName?: string
  teamShort?: string
  price?: number
}

interface RtmPrompt {
  playerName: string
  playerId: number
  winningTeamName: string
  winningTeamShort: string
  winningTeamId: number
  rtmTeamName: string
  rtmTeamShort: string
  rtmTeamId: number
  price: number
}

export interface AuctionWSState {
  currentBid: number
  currentTeamId: number | null
  currentPlayer: PlayerData | null
  status: string
  soldOverlay: SoldOverlayData | null
  rtmPrompt: RtmPrompt | null
  sealedBids: any[]
  sealedRevealed: boolean
  dutchCurrentPrice: number | null
  timerValue: number
  timerMax: number
  timerMode: string
  auction: any
  teams: TeamData[]
}

export interface UseAuctionWSOptions {
  auctionId: string | undefined
  mode?: 'admin' | 'spectator'
  initialAuction?: any
  initialTeams?: TeamData[]
  initialStatus?: string
  initialCurrentBid?: number
  initialCurrentPlayer?: PlayerData | null
  initialCurrentTeamId?: number | null
  timerSeconds?: number
  onPlaySound?: (key: string) => void
}

export function useAuctionWebSocket(options: UseAuctionWSOptions) {
  const {
    auctionId,
    mode = 'admin',
    initialAuction,
    initialTeams = [],
    initialStatus = 'waiting',
    initialCurrentBid = 0,
    initialCurrentPlayer = null,
    initialCurrentTeamId = null,
    timerSeconds: initialTimerSeconds = 30,
    onPlaySound,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const [currentBid, setCurrentBid] = useState(initialCurrentBid)
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(initialCurrentTeamId)
  const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(initialCurrentPlayer)
  const [status, setStatus] = useState(initialStatus)
  const [soldOverlay, setSoldOverlay] = useState<SoldOverlayData | null>(null)
  const [rtmPrompt, setRtmPrompt] = useState<RtmPrompt | null>(null)
  const [sealedBids, setSealedBids] = useState<any[]>([])
  const [sealedRevealed, setSealedRevealed] = useState(false)
  const [dutchCurrentPrice, setDutchCurrentPrice] = useState<number | null>(null)

  const overlayActiveRef = useRef(false)
  const currentPlayerRef = useRef(currentPlayer)
  currentPlayerRef.current = currentPlayer

  // Timer state (refs to avoid re-renders on every tick)
  const timerValueRef = useRef(0)
  const timerMaxRef = useRef(initialTimerSeconds)
  const timerModeRef = useRef<string>(initialAuction?.timer_mode || 'auto')
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [, forceUpdate] = useState(0)

  const setTimer = useCallback((seconds: number) => {
    timerValueRef.current = seconds
    timerMaxRef.current = seconds
    forceUpdate(n => n + 1)
  }, [])

  const startCountdown = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = setInterval(() => {
      if (timerValueRef.current > 0) {
        timerValueRef.current -= 1
        forceUpdate(n => n + 1)
      } else {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }, 1000)
  }, [])

  const stopCountdown = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
  }, [])

  // Current team helper
  const [teams, setTeams] = useState<TeamData[]>(initialTeams)
  const currentTeam = teams.find(t => t.id === currentTeamId) || null

  // Update timer mode when auction changes
  useEffect(() => {
    if (initialAuction?.timer_mode) timerModeRef.current = initialAuction.timer_mode
  }, [initialAuction?.timer_mode])

  // Cleanup on unmount
  useEffect(() => { return () => { stopCountdown() } }, [stopCountdown])

  // WebSocket connection
  useEffect(() => {
    if (!auctionId) return

    const wsUrl = mode === 'spectator'
      ? `${WS_BASE}/ws/auction/${auctionId}?mode=spectator`
      : `${WS_BASE}/ws/auction/${auctionId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'state') {
        setCurrentBid(msg.current_bid)
        setStatus(msg.status)
        setCurrentTeamId(msg.current_team_id)
        if (msg.current_player) setCurrentPlayer(msg.current_player)
        else setCurrentPlayer(null)
        if (msg.timer_mode) timerModeRef.current = msg.timer_mode
        if (msg.timer_seconds && msg.status === 'live' && timerModeRef.current === 'auto') {
          setTimer(msg.timer_seconds)
          startCountdown()
        }
      }

      else if (msg.type === 'next_player') {
        setCurrentBid(msg.current_bid)
        setCurrentTeamId(null)
        setStatus(msg.status)
        if (msg.current_player) setCurrentPlayer(msg.current_player)
        if (msg.timer_mode) timerModeRef.current = msg.timer_mode
        if (timerModeRef.current === 'auto') {
          setTimer(msg.timer_seconds || initialTimerSeconds)
          startCountdown()
        }
        setSoldOverlay(null)
        overlayActiveRef.current = false
      }

      else if (msg.type === 'bid_update') {
        setCurrentBid(msg.amount)
        setCurrentTeamId(msg.team_id)
        if (timerModeRef.current === 'auto') {
          setTimer(msg.timer_seconds || initialTimerSeconds)
          startCountdown()
        }
      }

      else if (msg.type === 'sold') {
        setCurrentBid(msg.price || 0)
        setStatus(msg.status)
        if (!overlayActiveRef.current) {
          setSoldOverlay({
            type: 'sold',
            playerName: msg.player_name || currentPlayerRef.current?.name || 'Player',
            teamName: msg.team_name,
            teamShort: msg.team_short,
            price: msg.price,
          })
          overlayActiveRef.current = true
          setTimeout(() => {
            setSoldOverlay(null)
            overlayActiveRef.current = false
            // If next player was queued in the sold message
            if (msg.current_player) {
              setCurrentPlayer(msg.current_player)
              setCurrentTeamId(null)
              setCurrentBid(msg.current_bid)
              if (timerModeRef.current === 'auto') {
                setTimer(initialTimerSeconds)
                startCountdown()
              }
            } else {
              setCurrentPlayer(null)
              setCurrentBid(0)
              setCurrentTeamId(null)
            }
          }, 3000)
        }
      }

      else if (msg.type === 'unsold') {
        setStatus(msg.status)
        if (!overlayActiveRef.current) {
          setSoldOverlay({
            type: 'unsold',
            playerName: msg.player_name || currentPlayerRef.current?.name || 'Player',
          })
          overlayActiveRef.current = true
          setTimeout(() => {
            setSoldOverlay(null)
            overlayActiveRef.current = false
            if (msg.current_player) {
              setCurrentPlayer(msg.current_player)
              setCurrentTeamId(null)
              setCurrentBid(msg.current_bid)
              if (timerModeRef.current === 'auto') {
                setTimer(initialTimerSeconds)
                startCountdown()
              }
            } else {
              setCurrentPlayer(null)
              setCurrentBid(0)
              setCurrentTeamId(null)
            }
          }, 2500)
        }
      }

      else if (msg.type === 'rtm_prompt') {
        setStatus('rtm_pending')
        setRtmPrompt({
          playerName: msg.player_name,
          playerId: msg.player_id,
          winningTeamName: msg.winning_team_name,
          winningTeamShort: msg.winning_team_short || '',
          winningTeamId: msg.winning_team_id,
          rtmTeamName: msg.rtm_team_name,
          rtmTeamShort: msg.rtm_team_short || '',
          rtmTeamId: msg.rtm_team_id,
          price: msg.price,
        })
      }

      else if (msg.type === 'rtm_result') {
        setRtmPrompt(null)
        if (msg.rtm_accepted) {
          // Show sold overlay for RTM
          if (!overlayActiveRef.current) {
            setSoldOverlay({
              type: 'sold',
              playerName: msg.player_name || currentPlayerRef.current?.name || 'Player',
              teamName: msg.team_name,
              teamShort: msg.team_short,
              price: msg.price,
            })
            overlayActiveRef.current = true
            setTimeout(() => {
              setSoldOverlay(null)
              overlayActiveRef.current = false
            }, 3000)
          }
        }
        setCurrentBid(0)
        setCurrentTeamId(null)
        setStatus(msg.status || 'live')
        setCurrentPlayer(null)
      }

      else if (msg.type === 'sealed_reveal') {
        setSealedBids(msg.bids || [])
        setSealedRevealed(true)
        if (msg.winner_team_name) {
          setCurrentBid(msg.price)
          setCurrentTeamId(msg.winner_team_id)
        }
      }

      else if (msg.type === 'dutch_start') {
        setDutchCurrentPrice(msg.current_price)
        setStatus(msg.status || 'dutch_active')
      }

      else if (msg.type === 'dutch_price_drop') {
        setDutchCurrentPrice(msg.current_price)
      }

      else if (msg.type === 'dutch_floor_reached') {
        setDutchCurrentPrice(null)
        setStatus('live')
      }
    }

    return () => { ws.close(); stopCountdown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, setTimer, startCountdown, stopCountdown, initialTimerSeconds])

  // Auto-start/stop timer based on status
  useEffect(() => {
    if (status === 'live' && timerModeRef.current === 'auto' && timerValueRef.current > 0 && !timerIntervalRef.current) startCountdown()
    if (status !== 'live') stopCountdown()
  }, [status, startCountdown, stopCountdown])

  // Method to refresh teams from an external fetch
  const updateTeams = useCallback((newTeams: TeamData[]) => {
    setTeams(newTeams)
  }, [])

  return {
    wsRef,
    currentBid,
    currentPlayer,
    currentTeamId,
    currentTeam,
    status,
    soldOverlay,
    rtmPrompt,
    sealedBids,
    sealedRevealed,
    dutchCurrentPrice,
    timerValue: timerValueRef.current,
    timerMax: timerMaxRef.current,
    timerMode: timerModeRef.current,
    teams,
    setStatus,
    setCurrentPlayer,
    setCurrentBid,
    setCurrentTeamId,
    setRtmPrompt,
    setSealedRevealed,
    setSealedBids,
    setDutchCurrentPrice,
    setSoldOverlay,
    overlayActiveRef,
    currentPlayerRef,
    updateTeams,
    setTimer,
    startCountdown,
    stopCountdown,
  }
}
