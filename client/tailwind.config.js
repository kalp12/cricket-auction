/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        surface: {
          0: 'var(--bg-base)',
          1: 'var(--bg-surface-1)',
          2: 'var(--bg-surface-2)',
          3: 'var(--bg-surface-3)',
          4: 'var(--bg-surface-4)',
        },
        accent: {
          gold: '#fbbf24',
          emerald: '#10b981',
          rose: '#f43f5e',
          sky: '#38bdf8',
        },
        auction: {
          sold: '#22c55e',
          unsold: '#ef4444',
          bid: '#eab308',
          live: '#10b981',
          paused: '#f59e0b',
        },
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'price-bump': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'sold-flash': {
          '0%': { backgroundColor: 'rgba(34, 197, 94, 0)' },
          '30%': { backgroundColor: 'rgba(34, 197, 94, 0.3)' },
          '100%': { backgroundColor: 'rgba(34, 197, 94, 0)' },
        },
        'unsold-flash': {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0)' },
          '30%': { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
          '100%': { backgroundColor: 'rgba(239, 68, 68, 0)' },
        },
        'bid-glow': {
          '0%': { textShadow: '0 0 0px rgba(234, 179, 8, 0)' },
          '50%': { textShadow: '0 0 20px rgba(234, 179, 8, 0.6)' },
          '100%': { textShadow: '0 0 0px rgba(234, 179, 8, 0)' },
        },
        'player-reveal': {
          '0%': { opacity: '0', transform: 'scale(0.9) translateY(10px)' },
          '60%': { opacity: '1', transform: 'scale(1.02) translateY(-2px)' },
          '100%': { transform: 'scale(1) translateY(0)' },
        },
        'count-urgent': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251, 191, 36, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(251, 191, 36, 0.25)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'scale-in': 'scale-in 0.3s var(--joy-pop)',
        'price-bump': 'price-bump 0.3s ease-out',
        'sold-flash': 'sold-flash 1s ease-out',
        'unsold-flash': 'unsold-flash 1s ease-out',
        'bid-glow': 'bid-glow 0.4s ease-out',
        'player-reveal': 'player-reveal 0.5s var(--joy-pop)',
        'count-urgent': 'count-urgent 0.5s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
