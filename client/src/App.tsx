import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Settings from './pages/Settings'
import AuctionHistory from './pages/AuctionHistory'
import AuctionStats from './pages/AuctionStats'

const isAuth = () => !!localStorage.getItem('token')

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuth() ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
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
