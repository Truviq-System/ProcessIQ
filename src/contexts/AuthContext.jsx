import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Role definitions ────────────────────────────────────────────────────────
export const ROLES = {
  process_analyst:      'Process Analyst',
  process_owner:        'Process Owner',
  system_administrator: 'System Administrator',
}

const ROLE_PERMS = {
  process_analyst: {
    read: true, add: true, edit: true, delete: false,
    manageOrgs: false, manageUsers: false, approveChanges: false,
  },
  process_owner: {
    read: true, add: true, edit: true, delete: true,
    manageOrgs: false, manageUsers: false, approveChanges: true,
  },
  system_administrator: {
    read: true, add: true, edit: true, delete: true,
    manageOrgs: true, manageUsers: true, approveChanges: true,
  },
}

// Merge permissions from all roles (OR semantics).
// editsRequireApproval is true only when the user is a Process Analyst
// without any higher role that can self-approve.
function derivePermissions(roles) {
  const merged = {}
  for (const r of (roles || [])) {
    for (const [k, v] of Object.entries(ROLE_PERMS[r] || {})) {
      merged[k] = merged[k] || v
    }
  }
  const r = roles || []
  merged.editsRequireApproval = r.includes('process_analyst')
    && !r.includes('process_owner')
    && !r.includes('system_administrator')
  return merged
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

async function fetchAppUser(email) {
  const { data, error } = await supabase
    .from('app_users')
    .select('roles, name, is_active')
    .ilike('email', email)   // case-insensitive match
    .maybeSingle()           // returns null (not error) when no row found
  if (error) {
    console.error('app_users lookup failed:', error.message)
    return null
  }
  return data  // null if not found, object if found
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [roles, setRoles]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const appUser = await fetchAppUser(session.user.email)
        if (appUser && appUser.is_active) {
          setUser({ ...session.user, displayName: appUser.name })
          setRoles(appUser.roles || [])
        } else {
          await supabase.auth.signOut()
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null)
        setRoles([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const appUser = await fetchAppUser(data.user.email)
    if (!appUser) {
      await supabase.auth.signOut()
      throw new Error('Access denied. Your account is not authorized for this application. Contact your System Administrator.')
    }
    if (!appUser.is_active) {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated. Contact your System Administrator.')
    }
    setUser({ ...data.user, displayName: appUser.name })
    setRoles(appUser.roles || [])
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRoles([])
  }

  const permissions = derivePermissions(roles)

  return (
    <AuthContext.Provider value={{ user, roles, permissions, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
