import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-surface-0">
      <Sidebar />
      <main className="ml-72 p-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
