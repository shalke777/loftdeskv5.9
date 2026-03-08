import { QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react'
import { queryClient } from '@/shared/lib/queryClient'
import { generateId } from '@/shared/lib/generateId'
import { ToastViewport } from '@/shared/ui/Toast/Toast'
import { useLocalStorage } from '@/shared/hooks/useLocalStorage'
import { demoDb, type DemoRole } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { resolveSupabaseSession } from '@/shared/lib/backend'

export type UserRole = DemoRole

export interface SessionUser {
  id: string
  email: string
  companyId: string
  companyName: string
  role: UserRole
  plan: 'free' | 'pro' | 'business' | 'admin'
  fullName: string
}

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  signInDemo: (email?: string) => void
  registerDemoCompany: (input?: { email?: string; companyName?: string; fullName?: string; password?: string; nip?: string }) => void
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  items: ToastItem[]
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  remove: (id: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ToastContext = createContext<ToastContextValue | null>(null)

function mapUser(email?: string): SessionUser {
  const demoUser = (email && demoDb.users.byEmail(email)) || demoDb.users.byEmail('adam@budowlanka.pl') || demoDb.users.list()[0]
  return {
    id: demoUser.id,
    email: demoUser.email,
    companyId: demoUser.company_id,
    companyName: demoUser.company_name,
    role: demoUser.role,
    plan: demoUser.plan,
    fullName: demoUser.full_name,
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [storedUser, setStoredUser] = useLocalStorage<SessionUser | null>('loftdesk-v4-session', isDemoMode ? mapUser() : null)
  const [user, setUser] = useState<SessionUser | null>(storedUser)
  const [loading, setLoading] = useState(!isDemoMode)

  const refreshSession = async () => {
    if (isDemoMode) {
      setUser((prev) => {
        const next = prev ? mapUser(prev.email) : prev
        setStoredUser(next)
        return next
      })
      return
    }
    setLoading(true)
    try {
      const resolved = await resolveSupabaseSession()
      setUser(resolved.user)
      setStoredUser(resolved.user)
    } catch {
      setUser(null)
      setStoredUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isDemoMode) {
      setUser(storedUser)
      setLoading(false)
      return
    }
    void refreshSession()
    const subscription = supabase?.auth.onAuthStateChange(() => {
      void refreshSession()
    })
    return () => subscription?.data.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signInDemo: (email) => {
        const next = mapUser(email)
        setUser(next)
        setStoredUser(next)
      },
      registerDemoCompany: (input) => {
        const created = demoDb.users.createCompanyOwner({
          email: input?.email || 'nowy@loftdesk.pl',
          companyName: input?.companyName,
          fullName: input?.fullName,
          password: input?.password,
          nip: input?.nip,
        })
        const next = mapUser(created.email)
        setUser(next)
        setStoredUser(next)
      },
      signOut: async () => {
        if (!isDemoMode && supabase) await supabase.auth.signOut()
        setUser(null)
        setStoredUser(null)
      },
      refreshSession,
    }),
    [loading, setStoredUser, storedUser, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const remove = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id))
  const push = (variant: ToastItem['variant'], title: string, description?: string) => {
    const id = generateId()
    setItems((prev) => [...prev, { id, title, description, variant }])
    window.setTimeout(() => remove(id), 3200)
  }

  const value = useMemo<ToastContextValue>(
    () => ({
      items,
      remove,
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [items],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}

export function useToastContext() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used inside ToastProvider')
  return ctx
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          {children}
          <ToastViewport />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
