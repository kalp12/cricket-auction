import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMe } from '../api'

interface AuthUser {
  id: number
  username: string
  role: string
  email?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  setUser: (user: AuthUser | null) => void
  refreshUser: () => Promise<void>
  isOwner: boolean
  isEditor: boolean
  isViewer: boolean
  canEdit: boolean // owner or editor
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  isOwner: false,
  isEditor: false,
  isViewer: false,
  canEdit: false,
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const data = await getMe()
      setUser(data)
    } catch {
      setUser(null)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (localStorage.getItem('token')) {
      refreshUser()
    } else {
      setLoading(false)
    }
  }, [])

  const isOwner = user?.role === 'owner'
  const isEditor = user?.role === 'editor'
  const isViewer = user?.role === 'viewer'
  const canEdit = isOwner || isEditor

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshUser, isOwner, isEditor, isViewer, canEdit }}>
      {children}
    </AuthContext.Provider>
  )
}
