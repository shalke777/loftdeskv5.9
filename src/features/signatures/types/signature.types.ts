// =============================================================================
// signature.types.ts — Types for LoftDesk signature / approval system
// =============================================================================

// ─── Enums ────────────────────────────────────────────────────────────────────

export type SignatureRequestMode =
  | 'approval_only'
  | 'qualified_signature_required'

export type SignatureRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export type SignatureDocumentType =
  | 'estimate'
  | 'contract'
  | 'annex'
  | 'invoice'
  | 'other'

export type SignatureProviderName = 'autenti' | 'mszafir' | 'certum'

export type ParticipantRole   = 'signer' | 'approver' | 'observer'
export type ParticipantStatus = 'pending' | 'notified' | 'viewed' | 'approved' | 'signed' | 'rejected'
export type ArtifactType      = 'original_pdf' | 'signed_pdf' | 'evidence_card' | 'provider_receipt'
export type ApprovalDecision  = 'approved' | 'rejected' | 'questioned'

export type SignatureEventType =
  | 'created'
  | 'participant_notified'
  | 'viewed'
  | 'otp_sent'
  | 'otp_verified'
  | 'approved'
  | 'rejected'
  | 'signing_initiated'
  | 'signed'
  | 'provider_callback'
  | 'completed'
  | 'cancelled'
  | 'expired'

// ─── DB Row Types ─────────────────────────────────────────────────────────────

export interface SignatureRequest {
  id: string
  company_id: string
  project_id: string | null
  document_type: SignatureDocumentType
  document_id: string
  document_hash: string
  mode: SignatureRequestMode
  status: SignatureRequestStatus
  provider_name: SignatureProviderName | null
  provider_transaction_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
  completed_at: string | null
  document_label: string | null
}

export interface SignatureParticipant {
  id: string
  signature_request_id: string
  role: ParticipantRole
  name: string
  email: string
  client_account_id: string | null
  user_id: string | null
  status: ParticipantStatus
  action_at: string | null
  otp_expires_at: string | null
  created_at: string
}

export interface SignatureEvent {
  id: string
  signature_request_id: string
  participant_id: string | null
  event_type: SignatureEventType
  actor_type: 'operator' | 'client' | 'system' | 'provider'
  actor_id: string | null
  actor_ip: string | null
  actor_user_agent: string | null
  document_hash: string | null
  provider_payload: unknown | null
  created_at: string
}

export interface SignatureArtifact {
  id: string
  signature_request_id: string
  artifact_type: ArtifactType
  storage_path: string
  file_hash: string
  file_size_bytes: number | null
  provider_artifact_id: string | null
  created_at: string
}

export interface ApprovalEvent {
  id: string
  company_id: string
  project_id: string | null
  signature_request_id: string | null
  document_type: string
  document_id: string
  document_hash: string
  actor_type: 'operator' | 'client'
  actor_id: string
  actor_name: string | null
  actor_email: string | null
  actor_ip: string | null
  actor_user_agent: string | null
  consent_text: string
  consent_checked_at: string
  otp_verified_at: string | null
  decision: ApprovalDecision
  comment: string | null
  created_at: string
}

// ─── Enriched / UI types ──────────────────────────────────────────────────────

export interface SignatureRequestWithParticipants extends SignatureRequest {
  participants: SignatureParticipant[]
  events?: SignatureEvent[]
  artifacts?: SignatureArtifact[]
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateSignatureRequestInput {
  companyId: string
  createdByUserId?: string
  projectId: string | null
  documentType: SignatureDocumentType
  documentId: string
  /** SHA-256 hex of the frozen PDF blob */
  documentHash: string
  /** Human-readable label shown to client in portal (e.g. "Wycena #001 – Remont kuchni") */
  documentLabel?: string
  mode: SignatureRequestMode
  providerName?: SignatureProviderName
  expiresInDays?: number
  participants: Array<{
    role: ParticipantRole
    name: string
    email: string
    clientAccountId?: string
    userId?: string
  }>
}

export interface RecordApprovalInput {
  companyId: string
  projectId: string | null
  signatureRequestId?: string
  documentType: string
  documentId: string
  documentHash: string
  actorType: 'operator' | 'client'
  actorId: string
  actorName?: string
  actorEmail?: string
  consentText: string
  otpVerifiedAt?: string
  decision: ApprovalDecision
  comment?: string
}
