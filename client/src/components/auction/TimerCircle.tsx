import { motion } from 'framer-motion'

interface Props {
  seconds: number
  maxSeconds: number
}

export default function TimerCircle({ seconds, maxSeconds }: Props) {
  const radius = 54
  const stroke = 5
  const circumference = 2 * Math.PI * radius
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 0
  const offset = circumference * (1 - progress)
  const color = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx="59" cy="59" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
      </svg>
      <motion.div
        key={seconds}
        initial={{ scale: 1.05, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`text-3xl font-mono font-bold ${seconds <= 5 ? 'text-red-400' : seconds <= 10 ? 'text-yellow-400' : 'text-blue-400'}`}
      >
        {seconds}
      </motion.div>
    </div>
  )
}
