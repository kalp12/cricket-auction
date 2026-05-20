import { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  labelClassName?: string
}

export default function Input({ label, hint, error, icon, labelClassName, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className={`text-xs text-gray-400 uppercase tracking-wider mb-1.5 block font-medium ${labelClassName || ''}`}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            {icon}
          </div>
        )}
        <input
          className={`w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600
            focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/30 outline-none transition-all
            text-sm disabled:opacity-50 disabled:cursor-not-allowed
            ${icon ? 'pl-11' : ''} ${error ? 'border-rose-500/50 focus:ring-rose-500/30' : ''}
            ${className}`}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  )
}
