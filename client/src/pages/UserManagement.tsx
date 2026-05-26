import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, Trash2, Shield, Mail, Crown, Edit3, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { listUsersApi, inviteUserApi, deleteUserApi, changeRoleApi } from '../api'
import { useAuth } from '../contexts/AuthContext'

const ROLE_BADGE: Record<string, { color: string; icon: typeof Crown; label: string }> = {
  owner: { color: 'from-amber-500 to-yellow-500', icon: Crown, label: 'Owner' },
  editor: { color: 'from-blue-500 to-cyan-500', icon: Edit3, label: 'Editor' },
  viewer: { color: 'from-gray-500 to-gray-400', icon: Eye, label: 'Viewer' },
}

interface UserData {
  id: number
  username: string
  email?: string
  role: string
  invite_token?: string
}

export default function UserManagement() {
  const { user: currentUser, isOwner } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string; role: string } | null>(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      const data = await listUsersApi()
      setUsers(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await inviteUserApi(inviteEmail, inviteRole)
      setInviteResult(res)
      toast.success('Invite created!')
      fetchUsers()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to invite')
    }
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('Delete this user?')) return
    try {
      await deleteUserApi(userId)
      toast.success('User deleted')
      fetchUsers()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await changeRoleApi(userId, newRole)
      toast.success('Role updated')
      fetchUsers()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to update role')
    }
  }

  const copyInviteLink = () => {
    if (!inviteResult) return
    const link = `${window.location.origin}/register-invite?token=${inviteResult.token}`
    navigator.clipboard.writeText(link)
    toast.success('Invite link copied!')
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-2 rounded w-48" />
          <div className="h-64 bg-surface-2 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl tracking-wide gradient-text">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage admin accounts and permissions</p>
        </div>
        {isOwner && (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setShowInvite(!showInvite); setInviteResult(null) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-gold to-amber-500 text-black font-semibold text-sm shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Invite User
          </motion.button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && isOwner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          {inviteResult ? (
            <div className="space-y-3">
              <h3 className="text-green-400 font-semibold">Invite Created!</h3>
              <p className="text-gray-400 text-sm">Share this link with <span className="text-white">{inviteResult.email}</span> to register as <span className="text-accent-gold">{inviteResult.role}</span>:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/register-invite?token=${inviteResult.token}`}
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-gray-300 text-sm font-mono"
                />
                <button onClick={copyInviteLink} className="px-4 py-2 rounded-lg bg-accent-gold text-black font-semibold text-sm">Copy</button>
              </div>
              <button onClick={() => { setInviteResult(null); setShowInvite(false) }} className="text-sm text-gray-500 hover:text-white">Done</button>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <h3 className="text-white font-semibold">Invite New User</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 outline-none"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none"
                >
                  <option value="editor">Editor — can manage auction flow, players, teams</option>
                  <option value="viewer">Viewer — read-only dashboard access</option>
                </select>
              </div>
              <button type="submit" className="px-6 py-2.5 rounded-xl bg-accent-gold text-black font-semibold text-sm">Create Invite</button>
            </form>
          )}
        </motion.div>
      )}

      {/* Users Table */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">User</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Email</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Role</th>
              {isOwner && <th className="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const badge = ROLE_BADGE[u.role] || ROLE_BADGE.viewer
              const BadgeIcon = badge.icon
              const isSelf = currentUser?.id === u.id
              return (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-sm font-bold text-gray-400">
                        {(u.username || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{u.username || <span className="text-gray-600 italic">Pending invite</span>}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{u.email || '—'}</td>
                  <td className="px-6 py-4">
                    {isOwner && !isSelf ? (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r ${badge.color} border-0 cursor-pointer`}
                      >
                        <option value="owner">Owner</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" /> {badge.label}
                      </span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="px-6 py-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-gray-600">You</span>
                      ) : u.invite_token ? (
                        <span className="text-xs text-accent-gold">Pending</span>
                      ) : (
                        <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-600">No users found</div>
        )}
      </div>
    </div>
  )
}
