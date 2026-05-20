import { ReactNode } from 'react'

type Variant = 'glass' | 'glass-strong' | 'solid' | 'gradient-gold' | 'gradient-purple'

interface CardProps {
  variant?: Variant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
}

const variants: Record<Variant, string> = {
  glass: 'glass rounded-2xl border border-white/5',
  'glass-strong': 'glass-strong rounded-2xl',
  solid: 'bg-surface-2 rounded-2xl border border-white/5',
  'gradient-gold': 'bg-gradient-to-br from-accent-gold/10 to-amber-600/5 rounded-2xl border border-accent-gold/10',
  'gradient-purple': 'bg-gradient-to-br from-purple-700 to-indigo-800 rounded-2xl',
}

const paddings: Record<string, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export default function Card({ variant = 'glass-strong', padding = 'md', className = '', children }: CardProps) {
  return (
    <div className={`${variants[variant]} ${paddings[padding]} ${className}`}>
      {children}
    </div>
  )
}
