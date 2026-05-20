import { ReactNode } from 'react'

type Color = 'gold' | 'emerald' | 'rose' | 'amber' | 'blue' | 'purple' | 'gray'

interface BadgeProps {
  color?: Color
  children: ReactNode
  className?: string
}

const colors: Record<Color, string> = {
  gold: 'bg-accent-gold/15 text-accent-gold border-accent-gold/20',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export function Badge({ color = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border inline-flex items-center gap-1 ${colors[color]} ${className}`}>
      {children}
    </span>
  )
}

const roleColors: Record<string, Color> = {
  batsman: 'blue',
  bowler: 'rose',
  allrounder: 'purple',
  wicketkeeper: 'emerald',
}

const roleLabels: Record<string, string> = {
  batsman: 'BAT',
  bowler: 'BOWL',
  allrounder: 'AR',
  wicketkeeper: 'WK',
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge color={roleColors[role] || 'gray'}>{roleLabels[role] || role.toUpperCase()}</Badge>
}

const statusColors: Record<string, Color> = {
  sold: 'emerald',
  unsold: 'gray',
  pending: 'amber',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={statusColors[status] || 'gray'}>{status}</Badge>
}

const auctionStatusColors: Record<string, Color> = {
  live: 'emerald',
  paused: 'amber',
  ended: 'rose',
  waiting: 'gray',
}

export function AuctionStatusBadge({ status }: { status: string }) {
  return <Badge color={auctionStatusColors[status] || 'gray'}>{status}</Badge>
}
