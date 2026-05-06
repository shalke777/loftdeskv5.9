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
  // Never default to 'owner' — that would silently promote unprivileged users.
  // 'worker' is the safe minimal fallback for the brief period before session loads.
  return user?.role ?? 'worker'
}

export function useHasRole(roles: string[]) {
  const { user } = useAuthContext()
  return roles.includes(user?.role ?? '')
}
