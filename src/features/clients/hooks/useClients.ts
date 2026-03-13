import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientsApi } from '@/features/clients/api/clients.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import type { Client } from '@/entities/client/model'

const clientKeys = {
  all: ['clients'] as const,
  list: (companyId: string) => [...clientKeys.all, companyId] as const,
}

export function useClients() {
  const companyId = useCompanyId()
  return useQuery({ queryKey: clientKeys.list(companyId), queryFn: () => clientsApi.list(companyId) })
}

export function useCreateClient() {
  const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast()
  return useMutation({ mutationFn: (input: Omit<Client, 'id' | 'created_at'>) => clientsApi.create(input), onSuccess: () => { qc.invalidateQueries({ queryKey: clientKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['onboarding-progress', companyId] }); toast.success('Klient dodany') } })
}

export function useUpdateClient() {
  const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast()
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Client> }) => clientsApi.update(id, input, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: clientKeys.list(companyId) }); toast.success('Klient zaktualizowany') } })
}

export function useDeleteClient() {
  const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast()
  return useMutation({ mutationFn: (id: string) => clientsApi.delete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: clientKeys.list(companyId) }); toast.info('Klient usunięty') } })
}
