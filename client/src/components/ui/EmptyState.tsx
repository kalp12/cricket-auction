import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  message: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export default function EmptyState({ icon: Icon, title, message, action, className = '' }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-xl scale-150" />
        <div className="relative w-20 h-20 rounded-full bg-surface-3 border border-white/5 flex items-center justify-center">
          <Icon className="w-9 h-9 text-gray-500" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
