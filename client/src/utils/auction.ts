import confetti from 'canvas-confetti'

export interface Slab {
  min_price: number
  max_price: number
  increment: number
}

export const formatPrice = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`
  return `₹${val.toLocaleString()}`
}

export const getNextBid = (currentBid: number, slabs: Slab[]): number => {
  for (const slab of slabs) {
    if (slab.min_price <= currentBid && currentBid < slab.max_price) {
      return currentBid + slab.increment
    }
  }
  return currentBid + (slabs[slabs.length - 1]?.increment || 1000000)
}

export const getTeamKey = (team: { short_name?: string; name: string }): string => {
  if (team.short_name) return team.short_name[0].toUpperCase()
  return team.name[0].toUpperCase()
}

export const buildKeyMap = <T extends { short_name?: string; name: string; id: number }>(
  teams: T[]
): Record<string, T> => {
  const map: Record<string, T> = {}
  const usedKeys = new Set<string>()
  for (const team of teams) {
    let key = getTeamKey(team)
    if (usedKeys.has(key)) {
      for (const ch of team.name.toUpperCase()) {
        if (!usedKeys.has(ch) && /[A-Z]/.test(ch)) { key = ch; break }
      }
    }
    usedKeys.add(key)
    map[key] = team
  }
  return map
}

const CONFETTI_COLORS = ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7']

export const fireConfetti = () => {
  const duration = 1500
  const end = Date.now() + duration
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: CONFETTI_COLORS })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: CONFETTI_COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  confetti({ particleCount: 100, spread: 100, origin: { y: 0.6 }, colors: CONFETTI_COLORS, startVelocity: 45 })
}
