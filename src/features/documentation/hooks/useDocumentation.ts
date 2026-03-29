import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { documentationApi } from '@/features/documentation/api/documentation.api'
import { useToast } from '@/shared/hooks/useToast'
import type { ClientDecision, HandoverProtocol, PhotoDocumentation, TechnicalStandard } from '@/entities/documentation/model'

const documentationKeys = {
  all: ['documentation'] as const,
  overview: (companyId: string) => [...documentationKeys.all, companyId] as const,
  projectPhotos: (projectId: string) => [...documentationKeys.all, 'project-photos', projectId] as const,
}

export function useDocumentationOverview() {
  const companyId = useCompanyId()
  return useQuery({ queryKey: documentationKeys.overview(companyId), queryFn: () => documentationApi.overview(companyId) })
}

function useInvalidate() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  const invalidate = () => qc.invalidateQueries({ queryKey: documentationKeys.overview(companyId) })
  return { companyId, qc, toast, invalidate }
}

export function useCreateDecision() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (input: Omit<ClientDecision, 'id' | 'requested_at' | 'decided_at'>) => documentationApi.createDecision(input), onSuccess: () => { invalidate(); toast.success('Decyzja klienta dodana') } })
}
export function useUpdateDecision() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<ClientDecision> }) => documentationApi.updateDecision(id, input), onSuccess: () => { invalidate(); toast.success('Decyzja zaktualizowana') } })
}
export function useDecideDecision() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: ({ id, status, comment }: { id: string; status: ClientDecision['status']; comment?: string }) => documentationApi.decide(id, status, comment), onSuccess: (_, vars) => { invalidate(); toast.info(vars.status === 'accepted' ? 'Decyzja zaakceptowana' : 'Decyzja zaktualizowana') } })
}
export function useDeleteDecision() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (id: string) => documentationApi.deleteDecision(id), onSuccess: () => { invalidate(); toast.info('Decyzja usunięta') } })
}

export function useCreateProtocol() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (input: Omit<HandoverProtocol, 'id'>) => documentationApi.createProtocol(input), onSuccess: () => { invalidate(); toast.success('Protokół zapisany') } })
}
export function useUpdateProtocol() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<HandoverProtocol> }) => documentationApi.updateProtocol(id, input), onSuccess: () => { invalidate(); toast.success('Protokół zaktualizowany') } })
}
export function useDecideProtocol() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: HandoverProtocol['status'] }) => documentationApi.decideProtocol(id, status), onSuccess: (_, vars) => { invalidate(); toast.info(vars.status === 'accepted' ? 'Protokół zaakceptowany' : 'Status protokołu zaktualizowany') } })
}
export function useDeleteProtocol() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (id: string) => documentationApi.deleteProtocol(id), onSuccess: () => { invalidate(); toast.info('Protokół usunięty') } })
}

export function useCreatePhoto() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (input: Omit<PhotoDocumentation, 'id'>) => documentationApi.createPhoto(input), onSuccess: () => { invalidate(); toast.success('Zdjęcie dodane do dokumentacji') } })
}
export function useUpdatePhoto() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<PhotoDocumentation> }) => documentationApi.updatePhoto(id, input), onSuccess: () => { invalidate(); toast.success('Zdjęcie zaktualizowane') } })
}
export function useDeletePhoto() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (id: string) => documentationApi.deletePhoto(id), onSuccess: () => { invalidate(); toast.info('Zdjęcie usunięte') } })
}

export function useProjectPhotos(projectId: string) {
  return useQuery({
    queryKey: documentationKeys.projectPhotos(projectId),
    queryFn: () => documentationApi.listByProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useCreateStandard() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (input: Omit<TechnicalStandard, 'id'>) => documentationApi.createStandard(input), onSuccess: () => { invalidate(); toast.success('Standard zapisany') } })
}
export function useUpdateStandard() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<TechnicalStandard> }) => documentationApi.updateStandard(id, input), onSuccess: () => { invalidate(); toast.success('Standard zaktualizowany') } })
}
export function useAcceptStandard() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (id: string) => documentationApi.acceptStandard(id), onSuccess: () => { invalidate(); toast.success('Standard zaakceptowany') } })
}
export function useDeleteStandard() {
  const { toast, invalidate } = useInvalidate()
  return useMutation({ mutationFn: (id: string) => documentationApi.deleteStandard(id), onSuccess: () => { invalidate(); toast.info('Standard usunięty') } })
}
