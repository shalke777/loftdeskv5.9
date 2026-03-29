// =============================================================================
// useSignatureRequests.ts — React Query hooks for signature workflow
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { signatureRequestsApi, approvalEventsApi } from '../api/signature-requests.api'
import type { CreateSignatureRequestInput, RecordApprovalInput } from '../types/signature.types'
import { createTimelineEvent } from '@/features/projects/lib/timeline'

export const signatureKeys = {
  forDocument: (type: string, id: string) => ['signature-requests', type, id] as const,
  detail:      (id: string)               => ['signature-request', id] as const,
  events:      (id: string)               => ['signature-events', id] as const,
  artifacts:   (id: string)               => ['signature-artifacts', id] as const,
  approvals:   (type: string, id: string) => ['approval-events', type, id] as const,
}

export function useSignatureRequestsForDocument(documentType: string, documentId: string) {
  return useQuery({
    queryKey: signatureKeys.forDocument(documentType, documentId),
    queryFn:  () => signatureRequestsApi.listForDocument(documentType, documentId),
    enabled:  Boolean(documentType && documentId),
    staleTime: 30_000,
  })
}

export function useSignatureRequestsForDocumentWithParts(documentType: string, documentId: string) {
  return useQuery({
    queryKey: [...signatureKeys.forDocument(documentType, documentId), 'with-parts'],
    queryFn:  () => signatureRequestsApi.listForDocumentWithParticipants(documentType, documentId),
    enabled:  Boolean(documentType && documentId),
    staleTime: 30_000,
  })
}

export function useSignatureRequest(id: string | null) {
  return useQuery({
    queryKey: signatureKeys.detail(id ?? ''),
    queryFn:  () => signatureRequestsApi.getById(id!),
    enabled:  Boolean(id),
    staleTime: 15_000,
  })
}

export function useSignatureEvents(signatureRequestId: string | null) {
  return useQuery({
    queryKey: signatureKeys.events(signatureRequestId ?? ''),
    queryFn:  () => signatureRequestsApi.getEvents(signatureRequestId!),
    enabled:  Boolean(signatureRequestId),
    staleTime: 15_000,
  })
}

export function useCreateSignatureRequest(documentType: string, documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSignatureRequestInput) => signatureRequestsApi.create(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: signatureKeys.forDocument(documentType, documentId) })
      if (input.projectId) {
        void createTimelineEvent({
          company_id:     input.companyId,
          project_id:     input.projectId,
          event_type:     'doc_approval_sent',
          visibility:     'internal',
          title:          `Wysłano do akceptacji: ${input.documentLabel ?? documentType}`,
          actor_type:     'operator',
          actor_id:       input.createdByUserId ?? undefined,
          reference_id:   documentId,
          reference_type: 'document',
          payload: {
            document_type:  documentType,
            document_id:    documentId,
            document_label: input.documentLabel ?? null,
          },
        }).catch((err) => console.warn('[signatures] timeline event failed:', err))
      }
    },
  })
}

export function useApprovalEventsForDocument(documentType: string, documentId: string) {
  return useQuery({
    queryKey: signatureKeys.approvals(documentType, documentId),
    queryFn:  () => approvalEventsApi.listForDocument(documentType, documentId),
    enabled:  Boolean(documentType && documentId),
    staleTime: 30_000,
  })
}

export function useRecordApproval(documentType: string, documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordApprovalInput) => approvalEventsApi.record(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: signatureKeys.approvals(documentType, documentId) })
      if (input.signatureRequestId) {
        void queryClient.invalidateQueries({ queryKey: signatureKeys.detail(input.signatureRequestId) })
      }
    },
  })
}
