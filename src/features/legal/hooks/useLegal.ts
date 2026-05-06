import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { legalApi, type SaveInput } from '@/features/legal/api/legal.api'
import { useAuthContext } from '@/app/providers'
import { useToast } from '@/shared/hooks/useToast'

const ACCEPTANCES_KEY = ['legal', 'acceptances'] as const

/**
 * Fetch all acceptance records for the current user.
 * Disabled when there is no authenticated user.
 */
export function useLegalAcceptances() {
  const { user } = useAuthContext()
  return useQuery({
    queryKey: ACCEPTANCES_KEY,
    queryFn: () => legalApi.getAcceptances(),
    // Klienci (role:'client') nie mają dokumentów prawnych do akceptacji.
    // Wyłączamy query żeby nie odpytywać bazy i nie generować undefined-loading-state.
    enabled: Boolean(user) && user?.role !== 'client',
    // Stale time: 5 min — acceptances rarely change mid-session
    staleTime: 5 * 60 * 1_000,
    // Retry once — covers transient network glitches without long delays
    retry: 1,
  })
}

/**
 * Pure DB guard hook: does the current user have ANY legal acceptance row
 * for the active company?  Returns undefined while loading.
 *
 * The gate uses ONLY this signal — no flow heuristics, no localStorage,
 * no version_update branching at the access-decision layer.
 */
export function useCompanyAcceptanceExists(): boolean | undefined {
  const { user } = useAuthContext()
  const companyId = user?.companyId ?? null
  const enabled = Boolean(user) && user?.role !== 'client' && Boolean(companyId)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['legal', 'company-acceptance-exists', user?.id, companyId],
    queryFn: () => legalApi.hasCompanyAcceptance(companyId as string),
    enabled,
    staleTime: 5 * 60 * 1_000,
    retry: 1,
  })
  if (!enabled) return true // no company yet → nothing to gate against
  if (isLoading) return undefined
  if (isError) return true // fail-open on transient errors
  return Boolean(data)
}

/**
 * Returns the list of required document keys not yet accepted at their
 * current version.  Returns undefined while still loading.
 */
export function useMissingAcceptances(): string[] | undefined {
  const { data, isLoading, isError } = useLegalAcceptances()
  if (isLoading) return undefined
  // Backend error (table missing, auth issue, network) — don't permanently
  // block the user. Let them through; the gate will re-check on next load.
  if (isError || data === undefined) return []
  return legalApi.getMissingRequired(data)
}

/**
 * Mutation: save one or more acceptance records.
 * On success invalidates the acceptances query so the gate re-evaluates.
 */
export function useSaveAcceptances() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (inputs: SaveInput[]) => legalApi.saveAcceptances(inputs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCEPTANCES_KEY })
      qc.invalidateQueries({ queryKey: ['legal', 'company-acceptance-exists'] })
    },
    onError: (err: Error) => {
      toast.error('Błąd zapisu akceptacji', err.message)
    },
  })
}
