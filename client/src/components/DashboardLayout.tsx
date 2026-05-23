import { useState, createContext, useContext } from 'react'
import { Outlet } from 'react-router-dom'
import { MotionConfig, AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

const SidebarContext = createContext<{
  open: boolean
  setOpen: (v: boolean) => void
}>({ open: false, setOpen: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export default function DashboardLayout() {
  const [open, setOpen] = useState(false)

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-surface-0">
          {/* Desktop sidebar */}
          <div className="hidden lg:block fixed inset-y-0 left-0 z-20">
            <Sidebar />
          </div>

          {/* Mobile sidebar overlay */}
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  initial={{ x: -288 }}
                  animate={{ x: 0 }}
                  exit={{ x: -288 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="fixed inset-y-0 left-0 z-50 lg:hidden"
                >
                  <Sidebar />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(true)}
            className="fixed top-4 left-4 z-30 lg:hidden p-2.5 rounded-xl bg-surface-1/90 backdrop-blur border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Main content */}
          <main className="lg:ml-72 p-4 md:p-6 lg:p-8 pt-16 lg:pt-8 min-h-screen">
            <Outlet />
          </main>
        </div>
      </MotionConfig>
    </SidebarContext.Provider>
  )
}
