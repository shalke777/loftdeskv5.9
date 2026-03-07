import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { settingsApi } from '@/features/settings/api/settings.api'
import { useToast } from '@/shared/hooks/useToast'
import { useAuth } from '@/features/auth/hooks/useAuth'

const settingsKeys = {
  profile: (companyId: string) => ['settings', 'profile', companyId] as const,
  team: (companyId: string) => ['settings', 'team', companyId] as const,
  invitations: (companyId: string) => ['settings', 'invitations', companyId] as const,
  pendingEmail: (email: string) => ['settings', 'pending-email', email] as const,
}

export function useSettings() {
  const companyId = useCompanyId()
  const profile = useQuery({ queryKey: settingsKeys.profile(companyId), queryFn: () => settingsApi.profile(companyId) })
  const team = useQuery({ queryKey: settingsKeys.team(companyId), queryFn: () => settingsApi.team(companyId) })
  const invitations = useQuery({ queryKey: settingsKeys.invitations(companyId), queryFn: () => settingsApi.invitations(companyId) })
  return { profile: profile.data, team: team.data ?? [], invitations: invitations.data ?? [], loading: profile.isLoading || team.isLoading || invitations.isLoading }
}

export function useInviteMember() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: 'owner' | 'admin' | 'manager' | 'worker' | 'accountant' }) => settingsApi.inviteMember({ companyId, email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.team(companyId) })
      toast.success('Członek zespołu dodany')
    },
    onError: (error) => toast.error('Nie udało się dodać członka', error instanceof Error ? error.message : undefined),
  })
}

export function useUpdateCompanyProfile() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  const { refreshSession } = useAuth()
  return useMutation({
    mutationFn: (input: { company_name: string; nip?: string; address?: string; postal_code?: string; city?: string; iban?: string; phone?: string; email?: string; ksef_env: 'test' | 'prod'; ksef_nip: string; ksef_token: string }) => settingsApi.updateProfile(companyId, input),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: settingsKeys.profile(companyId) })
      await refreshSession()
      toast.success('Profil firmy zapisany')
    },
    onError: (error) => toast.error('Nie udało się zapisać profilu', error instanceof Error ? error.message : undefined),
  })
}


export function useRevokeInvitation() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (invitationId: string) => settingsApi.revokeInvitation(companyId, invitationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.invitations(companyId) })
      toast.success('Zaproszenie wycofane')
    },
    onError: (error) => toast.error('Nie udało się wycofać zaproszenia', error instanceof Error ? error.message : undefined),
  })
}

export function usePendingInvitationsByEmail(email: string) {
  return useQuery({
    queryKey: settingsKeys.pendingEmail(email),
    queryFn: () => settingsApi.pendingInvitationsByEmail(email),
    enabled: Boolean(email),
  })
}

export function useAcceptInvitation() {
  const toast = useToast()
  const { refreshSession } = useAuth()
  return useMutation({
    mutationFn: ({ token, email }: { token: string; email?: string }) => settingsApi.acceptInvitation(token, email),
    onSuccess: async () => {
      await refreshSession()
      toast.success('Zaproszenie zaakceptowane')
    },
    onError: (error) => toast.error('Nie udało się zaakceptować zaproszenia', error instanceof Error ? error.message : undefined),
  })
}
