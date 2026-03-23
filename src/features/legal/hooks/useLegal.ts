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
    },
    onError: (err: Error) => {
      toast.error('Błąd zapisu akceptacji', err.message)
    },
  })
}
