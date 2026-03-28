// =============================================================================
// signature-provider.interface.ts
// =============================================================================
// Provider adapter interface for QTSP (Qualified Trust Service Providers).
// Supported: Autenti, mSzafir, Certum SimplySign.
//
// LoftDesk manages: workflow, PDF freeze, hash, DB state, evidence trail.
// Provider manages: cryptographic signing, identity verification, timestamping.
//
// To add a new provider: implement SignatureProvider and register in
// src/features/signatures/providers/provider-registry.ts
// =============================================================================

export interface ProviderParticipant {
  name: string
  email: string
  role: 'signer' | 'approver' | 'observer'
  /** Provider-specific identity level requirement */
  identityLevel?: 'basic' | 'advanced' | 'qualified'
}

export interface CreateSigningFlowInput {
  /** SHA-256 hex of the document to be signed */
  documentHash: string
  /** Supabase Storage public/signed URL for the PDF */
  documentUrl: string
  /** Human-readable document title */
  documentTitle: string
  participants: ProviderParticipant[]
  /** ISO 8601 datetime */
  expiresAt?: string
  /** Arbitrary key/value metadata passed through to provider */
  metadata?: Record<string, string>
  /** URL to call when signing is complete / status changes */
  callbackUrl: string
}

export interface CreateSigningFlowResult {
  /** Provider-side transaction/envelope ID — stored in signature_requests */
  providerTransactionId: string
  /** Redirect URL for the first signer, if synchronous signing URL is available */
  signingUrl?: string
  /** Raw provider response for audit storage */
  rawResponse: unknown
}

export interface ProviderParticipantStatus {
  email: string
  status: 'pending' | 'notified' | 'viewed' | 'signed' | 'rejected'
  actionAt?: string
}

export interface GetSigningStatusResult {
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired'
  participantStatuses: ProviderParticipantStatus[]
  completedAt?: string
  rawResponse: unknown
}

export interface WebhookHandlerResult {
  /** Transaction ID from provider */
  providerTransactionId: string
  /** New computed status after this webhook event */
  newStatus: 'in_progress' | 'completed' | 'rejected' | 'expired'
  /** List of individual events to record in signature_events */
  events: Array<{
    eventType: string
    participantEmail?: string
    payload: unknown
  }>
}

export interface DownloadSignedArtifactResult {
  /** Binary PDF buffer */
  pdfBuffer: Buffer
  /** SHA-256 hex of the signed PDF */
  fileHash: string
  /** Provider-side artifact ID to store in signature_artifacts */
  providerArtifactId: string
  /** ISO 8601 timestamp of the qualified timestamp embedded in the signature */
  signatureTimestamp: string
}

// ─── Provider Interface ────────────────────────────────────────────────────────

export interface SignatureProvider {
  readonly providerName: 'autenti' | 'mszafir' | 'certum'

  /**
   * Create a new signing flow at the provider side.
   * Called after: PDF is frozen, hash computed, SignatureRequest row created.
   * Returns providerTransactionId to store back in signature_requests.
   */
  createSigningFlow(input: CreateSigningFlowInput): Promise<CreateSigningFlowResult>

  /**
   * Poll the current status of a signing flow.
   * Used for status sync when webhooks are not available or as fallback.
   */
  getSigningStatus(providerTransactionId: string): Promise<GetSigningStatusResult>

  /**
   * Process an incoming webhook from the provider.
   * Must verify the webhook signature/HMAC before processing.
   * @param rawBody   Raw request body (Buffer or string) for HMAC validation
   * @param signature Webhook signature header value
   */
  handleWebhook(rawBody: Buffer | string, signature: string): Promise<WebhookHandlerResult>

  /**
   * Download the finalized signed PDF artifact from the provider.
   * Called only when status = 'completed'.
   * Result is stored in Supabase Storage and indexed in signature_artifacts.
   */
  downloadSignedArtifact(providerTransactionId: string): Promise<DownloadSignedArtifactResult>
}

// ─── Provider config (injected at runtime) ────────────────────────────────────

export interface AutentiProviderConfig {
  apiKey: string
  apiBaseUrl: string   // https://api.autenti.com/api/v1
  webhookSecret: string
  callbackBaseUrl: string
}

export interface MszafirProviderConfig {
  tsaUrl: string
  apiBaseUrl: string
  clientId: string
  clientSecret: string
  callbackBaseUrl: string
}

export interface CertumProviderConfig {
  apiBaseUrl: string
  apiKey: string
  webhookSecret: string
  callbackBaseUrl: string
}
