import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  return (
    <div>
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-400">HOME</span>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-700 font-medium">SETTINGS</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <SettingsIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-400">Bid increments, timer duration, and auction rules configuration coming in Phase 5.</p>
      </div>
    </div>
  )
}
