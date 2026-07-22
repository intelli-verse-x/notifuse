import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { authService } from '../services/api/auth'
import { workspaceService } from '../services/api/workspace'
import { Workspace, UserPermissions } from '../services/api/types'
import { isRootUser } from '../services/api/auth'

export interface User {
  id: string
  email: string
  language?: string
}

interface AuthContextType {
  user: User | null
  workspaces: Workspace[]
  isAuthenticated: boolean
  signin: (token: string) => Promise<void>
  signout: () => Promise<void>
  loading: boolean
  refreshWorkspaces: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components -- Context co-located with provider
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      // Private deployments can skip magic-code login and open the console directly.
      if (!localStorage.getItem('auth_token') && window.CONSOLE_SKIP_LOGIN === true) {
        const response = await authService.consoleSkipLogin()
        if (response.token) {
          localStorage.setItem('auth_token', response.token)
        }
      }

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setLoading(false)
        return
      }

      const { user, workspaces } = await authService.getCurrentUser()
      setUser(user)
      setWorkspaces(workspaces)
      setLoading(false)
    } catch {
      localStorage.removeItem('auth_token')
      setUser(null)
      setWorkspaces([])
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signin = async (token: string) => {
    try {
      localStorage.setItem('auth_token', token)

      const { user, workspaces } = await authService.getCurrentUser()
      setUser(user)
      setWorkspaces(workspaces)
    } catch (error) {
      localStorage.removeItem('auth_token')
      throw error
    }
  }

  const signout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error('Failed to logout on backend:', error)
    }

    localStorage.removeItem('auth_token')
    setUser(null)
    setWorkspaces([])

    // Re-open console automatically when skip-login is enabled.
    if (window.CONSOLE_SKIP_LOGIN === true) {
      await checkAuth()
    }
  }

  const refreshWorkspaces = async () => {
    const { workspaces } = await authService.getCurrentUser()
    setWorkspaces(workspaces)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        isAuthenticated: !!user,
        signin,
        signout,
        loading,
        refreshWorkspaces
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook co-located with context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Custom hook to get user permissions for a specific workspace
// eslint-disable-next-line react-refresh/only-export-components -- Hook co-located with context
export function useWorkspacePermissions(workspaceId: string) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user || !workspaceId) {
        setLoading(false)
        return
      }

      // If user is root, they have full permissions
      if (isRootUser(user.email)) {
        setPermissions({
          contacts: { read: true, write: true },
          lists: { read: true, write: true },
          templates: { read: true, write: true },
          broadcasts: { read: true, write: true },
          transactional: { read: true, write: true },
          workspace: { read: true, write: true },
          message_history: { read: true, write: true },
          blog: { read: true, write: true },
          automations: { read: true, write: true }
        })
        setLoading(false)
        return
      }

      try {
        const response = await workspaceService.getMembers(workspaceId)
        const currentUserMember = response.members.find((member) => member.user_id === user.id)

        if (currentUserMember) {
          setPermissions(currentUserMember.permissions)
        } else {
          // User is not a member of this workspace, set empty permissions
          setPermissions({
            contacts: { read: false, write: false },
            lists: { read: false, write: false },
            templates: { read: false, write: false },
            broadcasts: { read: false, write: false },
            transactional: { read: false, write: false },
            workspace: { read: false, write: false },
            message_history: { read: false, write: false },
            blog: { read: false, write: false },
            automations: { read: false, write: false }
          })
        }
      } catch (error) {
        console.error('Failed to fetch user permissions', error)
        // On error, assume no permissions
        setPermissions({
          contacts: { read: false, write: false },
          lists: { read: false, write: false },
          templates: { read: false, write: false },
          broadcasts: { read: false, write: false },
          transactional: { read: false, write: false },
          workspace: { read: false, write: false },
          message_history: { read: false, write: false },
          blog: { read: false, write: false },
          automations: { read: false, write: false }
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [workspaceId, user])

  return { permissions, loading }
}
