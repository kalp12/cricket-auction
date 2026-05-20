/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e3a5f',
          900: '#1e2d4f',
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
      },
      animation: {
        'slide-up': 'slide-up 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'price-bump': 'price-bump 0.3s ease-out',
        'sold-flash': 'sold-flash 1s ease-out',
        'unsold-flash': 'unsold-flash 1s ease-out',
        'bid-glow': 'bid-glow 0.4s ease-out',
        'player-reveal': 'player-reveal 0.5s ease-out',
        'count-urgent': 'count-urgent 0.5s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
