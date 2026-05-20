import { motion } from 'framer-motion'
import { ReactNode, ButtonHTMLAttributes } from 'react'

type Variant = 'gold' | 'emerald' | 'rose' | 'ghost' | 'outline' | 'surface'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  motion?: boolean
}

const variants: Record<Variant, string> = {
  gold: 'bg-gradient-to-r from-accent-gold to-amber-500 text-black font-bold shadow-lg shadow-amber-500/20 disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-400 disabled:shadow-none',
  emerald: 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold shadow-lg shadow-emerald-500/20',
  rose: 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold shadow-lg shadow-rose-500/20',
  ghost: 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white',
  outline: 'border border-white/10 text-gray-400 hover:bg-white/5',
  surface: 'bg-surface-3 hover:bg-surface-4 border border-white/5 text-white',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-8 py-3 text-base rounded-xl gap-2',
}

export default function Button({
  variant = 'gold', size = 'md', icon, motion: useMotion = true,
  children, className = '', disabled, ...props
}: ButtonProps) {
  const cls = `inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`

  if (useMotion) {
    return (
      <motion.button
        whileHover={disabled ? {} : { scale: variant === 'ghost' || variant === 'outline' || variant === 'surface' ? 1.02 : 1.03 }}
        whileTap={disabled ? {} : { scale: 0.97 }}
        className={cls}
        disabled={disabled}
        {...(props as any)}
      >
        {icon}{children}
      </motion.button>
    )
  }

  return <button className={cls} disabled={disabled} {...props}>{icon}{children}</button>
}
