import { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return <div className={`animate-shimmer bg-surface-2 rounded-lg ${className}`} style={style} />
}

export function SkeletonLine({ width = '100%', height = '16px', className = '' }: { width?: string; height?: string; className?: string }) {
  return <Skeleton className={className} style={{ width, height }} />
}

export function SkeletonCircle({ size = '40px', className = '' }: { size?: string; className?: string }) {
  return <Skeleton className={`!rounded-full ${className}`} style={{ width: size, height: size }} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-strong rounded-2xl p-6 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <SkeletonCircle />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" height="20px" />
          <SkeletonLine width="40%" height="14px" />
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonLine height="12px" />
        <SkeletonLine width="80%" height="12px" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`glass-strong rounded-2xl overflow-hidden ${className}`}>
      <div className="border-b border-white/5 px-5 py-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={i === 0 ? '20%' : `${60 / (cols - 1)}%`} height="12px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="border-b border-white/5 px-5 py-3.5 flex items-center gap-4">
          <SkeletonCircle size="32px" />
          {Array.from({ length: cols - 1 }).map((_, col) => (
            <SkeletonLine key={col} width={col === cols - 2 ? '20%' : '25%'} height="14px" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 6, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonStats({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-strong rounded-2xl p-5">
            <SkeletonLine width="50%" height="10px" className="mb-3" />
            <SkeletonLine width="70%" height="28px" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-strong rounded-2xl p-6">
          <SkeletonLine width="40%" height="20px" className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonLine width="30%" height="14px" />
                <SkeletonLine width="15%" height="14px" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-strong rounded-2xl p-6">
          <SkeletonLine width="40%" height="20px" className="mb-4" />
          <SkeletonLine height="200px" className="!rounded-xl" />
        </div>
      </div>
    </div>
  )
}
