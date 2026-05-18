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
    },
  },
  plugins: [],
}
