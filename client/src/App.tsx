import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardLayout from './components/DashboardLayout'
import Auction from './pages/Auction'
import NewAuction from './pages/NewAuction'
import MyAuctions from './pages/MyAuctions'
import AuctionDetail from './pages/AuctionDetail'
import Teams from './pages/Teams'
import Players from './pages/Players'
import AuctionPanel from './pages/AuctionPanel'
import AuctionLive from './pages/AuctionLive'
import AuctionOverlay from './pages/AuctionOverlay'
import Settings from './pages/Settings'
import AuctionHistory from './pages/AuctionHistory'
import AuctionStats from './pages/AuctionStats'
import PlayerImport from './pages/PlayerImport'

const isAuth = () => !!localStorage.getItem('token')

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuth() ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1f2e',
            color: '#e5e7eb',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#1a1f2e' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1a1f2e' },
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Broadcast overlay — no auth, no layout, chromeless */}
        <Route path="/overlay/:auctionId" element={<AuctionOverlay />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="auctions/new" element={<NewAuction />} />
          <Route path="auctions" element={<MyAuctions />} />
          <Route path="auctions/:id" element={<AuctionDetail />} />
          <Route path="auctions/:auctionId/teams" element={<Teams />} />
          <Route path="auctions/:auctionId/players" element={<Players />} />
          <Route path="auctions/:auctionId/players/import" element={<PlayerImport />} />
          <Route path="auction-panel" element={<AuctionPanel />} />
          <Route path="auctions/:auctionId/live" element={<AuctionLive />} />
          <Route path="auctions/:auctionId/settings" element={<Settings />} />
          <Route path="auctions/:auctionId/history" element={<AuctionHistory />} />
          <Route path="auctions/:auctionId/stats" element={<AuctionStats />} />
        </Route>
        <Route path="/auction" element={isAuth() ? <Auction /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}
