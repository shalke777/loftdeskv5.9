// =============================================================================
// signature-requests.api.ts — Supabase API for signature workflow
// =============================================================================

import { supabase, isDemoMode } from '@/shared/lib/supabase'
import type {
  SignatureRequest,
  SignatureRequestWithParticipants,
  SignatureEvent,
  SignatureArtifact,
  ApprovalEvent,
  CreateSignatureRequestInput,
  RecordApprovalInput,
} from '@/features/signatures/types/signature.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute SHA-256 of arbitrary text using WebCrypto (browser-safe) */
export async function computeDocumentHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── signature_requests ───────────────────────────────────────────────────────

export const signatureRequestsApi = {
  async create(input: CreateSignatureRequestInput): Promise<SignatureRequest> {
    if (!supabase || isDemoMode) throw new Error('Supabase not available in demo mode')

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null

    const { data: req, error: reqErr } = await supabase
      .from('signature_requests')
      .insert({
        project_id:    input.projectId,
        document_type: input.documentType,
        document_id:   input.documentId,
        document_hash: input.documentHash,
        mode:          input.mode,
        provider_name: input.providerName ?? null,
        expires_at:    expiresAt,
      })
      .select('*')
      .single()

    if (reqErr) throw reqErr

    // Insert participants
    if (input.participants.length > 0) {
      const { error: partErr } = await supabase
        .from('signature_participants')
        .insert(
          input.participants.map(p => ({
            signature_request_id: req.id,
            role:               p.role,
            name:               p.name,
            email:              p.email,
            client_account_id:  p.clientAccountId ?? null,
            user_id:            p.userId ?? null,
          }))
        )
      if (partErr) throw partErr
    }

    // Log 'created' event
    await signatureRequestsApi.logEvent({
      signatureRequestId: req.id,
      eventType:          'created',
      actorType:          'operator',
    })

    return req as SignatureRequest
  },

  async getById(id: string): Promise<SignatureRequestWithParticipants | null> {
    if (!supabase || isDemoMode) return null
    const { data, error } = await supabase
      .from('signature_requests')
      .select(`
        *,
        signature_participants(*),
        signature_events(* ORDER BY created_at),
        signature_artifacts(*)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    if (!data) return null
    return {
      ...(data as any),
      participants: (data as any).signature_participants ?? [],
      events:       (data as any).signature_events      ?? [],
      artifacts:    (data as any).signature_artifacts   ?? [],
    } as SignatureRequestWithParticipants
  },

  async listForDocument(documentType: string, documentId: string): Promise<SignatureRequest[]> {
    if (!supabase || isDemoMode) return []
    const { data, error } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('document_type', documentType)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as SignatureRequest[]
  },

  /** Update status after provider callback / manual action */
  async updateStatus(
    id: string,
    status: SignatureRequest['status'],
    extras?: { providerTransactionId?: string; completedAt?: string }
  ): Promise<void> {
    if (!supabase || isDemoMode) return
    const { error } = await supabase
      .from('signature_requests')
      .update({
        status,
        ...(extras?.providerTransactionId ? { provider_transaction_id: extras.providerTransactionId } : {}),
        ...(extras?.completedAt ? { completed_at: extras.completedAt } : {}),
      })
      .eq('id', id)
    if (error) throw error
  },

  async logEvent(options: {
    signatureRequestId: string
    eventType: string
    actorType?: 'operator' | 'client' | 'system' | 'provider'
    actorId?: string
    participantId?: string
    documentHash?: string
    providerPayload?: unknown
  }): Promise<void> {
    if (!supabase || isDemoMode) return
    const { error } = await supabase
      .from('signature_events')
      .insert({
        signature_request_id: options.signatureRequestId,
        event_type:           options.eventType,
        actor_type:           options.actorType ?? 'system',
        actor_id:             options.actorId ?? null,
        participant_id:       options.participantId ?? null,
        document_hash:        options.documentHash ?? null,
        provider_payload:     options.providerPayload ?? null,
      })
    if (error) console.error('[signatures] logEvent failed', error)
  },

  async getEvents(signatureRequestId: string): Promise<SignatureEvent[]> {
    if (!supabase || isDemoMode) return []
    const { data, error } = await supabase
      .from('signature_events')
      .select('*')
      .eq('signature_request_id', signatureRequestId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as SignatureEvent[]
  },

  async storeArtifact(artifact: {
    signatureRequestId: string
    artifactType: SignatureArtifact['artifact_type']
    storagePath: string
    fileHash: string
    fileSizeBytes?: number
    providerArtifactId?: string
  }): Promise<void> {
    if (!supabase || isDemoMode) return
    const { error } = await supabase
      .from('signature_artifacts')
      .insert({
        signature_request_id: artifact.signatureRequestId,
        artifact_type:        artifact.artifactType,
        storage_path:         artifact.storagePath,
        file_hash:            artifact.fileHash,
        file_size_bytes:      artifact.fileSizeBytes ?? null,
        provider_artifact_id: artifact.providerArtifactId ?? null,
      })
    if (error) throw error
  },

  async getArtifacts(signatureRequestId: string): Promise<SignatureArtifact[]> {
    if (!supabase || isDemoMode) return []
    const { data, error } = await supabase
      .from('signature_artifacts')
      .select('*')
      .eq('signature_request_id', signatureRequestId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as SignatureArtifact[]
  },
}

// ─── approval_events ──────────────────────────────────────────────────────────

export const approvalEventsApi = {
  async record(input: RecordApprovalInput): Promise<ApprovalEvent> {
    if (!supabase || isDemoMode) throw new Error('Supabase not available in demo mode')
    const { data, error } = await supabase
      .from('approval_events')
      .insert({
        company_id:           input.companyId,
        project_id:           input.projectId,
        signature_request_id: input.signatureRequestId ?? null,
        document_type:        input.documentType,
        document_id:          input.documentId,
        document_hash:        input.documentHash,
        actor_type:           input.actorType,
        actor_id:             input.actorId,
        actor_name:           input.actorName ?? null,
        actor_email:          input.actorEmail ?? null,
        actor_ip:             null, // IP resolved server-side in Netlify function
        actor_user_agent:     typeof navigator !== 'undefined' ? navigator.userAgent : null,
        consent_text:         input.consentText,
        otp_verified_at:      input.otpVerifiedAt ?? null,
        decision:             input.decision,
        comment:              input.comment ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as ApprovalEvent
  },

  async listForDocument(documentType: string, documentId: string): Promise<ApprovalEvent[]> {
    if (!supabase || isDemoMode) return []
    const { data, error } = await supabase
      .from('approval_events')
      .select('*')
      .eq('document_type', documentType)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ApprovalEvent[]
  },
}
