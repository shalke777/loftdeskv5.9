import { useAuthContext } from '@/app/providers'

export function useAuth() {
  return useAuthContext()
}

export function useSession() {
  const { user, loading } = useAuthContext()
  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isOwner: user?.role === 'owner',
    isManager: user?.role === 'manager',
    isAccountant: user?.role === 'accountant',
    isClient: user?.role === 'client',
  }
}

export function useIsClient() {
  const { user } = useAuthContext()
  return user?.role === 'client'
}

export function useCompanyId() {
  const { user } = useAuthContext()
  return user?.companyId ?? 'demo-company'
}

export function useCurrentRole() {
  const { user } = useAuthContext()
  // Return null when session is unresolved — callers must handle null explicitly.
  // Never default to any role to avoid silent privilege escalation.
  return user?.role ?? null
}

export function useHasRole(roles: string[]) {
  const { user } = useAuthContext()
  return roles.includes(user?.role ?? '')
}
