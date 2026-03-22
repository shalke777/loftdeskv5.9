// Typy TypeScript dla modelu Portal Projektu (migration 034)
// Odpowiadają bezpośrednio tabelom z 034_project_portal.sql
// UWAGA: Nowe kolumny expense_invoices opisane jako ExpenseInvoiceV2 poniżej.

// ─── Typy pomocnicze ──────────────────────────────────────────────────────────

export type PortalScope =
  | 'read_updates'
  | 'read_messages'
  | 'send_messages'
  | 'read_documents'
  | 'read_approvals'
  | 'respond_approvals';

export type ThreadType =
  | 'general'
  | 'approvals'
  | 'documents'
  | 'payments'
  | 'technical'
  | 'internal';

export type ThreadVisibility = 'internal' | 'client_shared' | 'approval';

export type MessageSenderType = 'operator' | 'client' | 'system';

export type MessageVisibility = 'internal' | 'client_shared';

export type ApprovalStatus =
  | 'pending_client'
  | 'accepted'
  | 'rejected'
  | 'questioned'
  | 'cancelled';

export type TimelineActorType = 'operator' | 'client' | 'system';

export type TimelineVisibility = 'internal' | 'client_shared';

export type TimelineReferenceType =
  | 'expense'
  | 'thread'
  | 'message'
  | 'document'
  | 'approval'
  | 'portal_token'
  | 'project';

export type ExpenseSourceType = 'camera' | 'gallery' | 'pdf' | 'manual';

export type ExpenseCostType =
  | 'internal_cost'
  | 'client_billable'
  | 'client_approval_required';

export type ExpenseApprovalStatus =
  | 'not_sent'
  | 'pending_client'
  | 'accepted'
  | 'rejected'
  | 'questioned';

export type ParserSource = 'ai' | 'regex' | 'manual';

// ─── project_portal_tokens ────────────────────────────────────────────────────

export interface ProjectPortalToken {
  id: string;
  company_id: string;
  project_id: string;
  client_id: string | null;
  /** SHA-256 hex — nigdy plaintext w odpowiedzi API dla klienta */
  token_hash: string;
  scope: PortalScope[];
  client_name: string | null;
  client_email: string | null;
  active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
}

/** Formularz tworzenia nowego tokenu (token_hash generuje backend) */
export interface CreatePortalTokenInput {
  project_id: string;
  client_id?: string;
  scope?: PortalScope[];
  client_name?: string;
  client_email?: string;
  expires_at?: string | null;
}

// ─── project_portal_sessions ─────────────────────────────────────────────────

export interface ProjectPortalSession {
  id: string;
  portal_token_id: string;
  project_id: string;
  company_id: string;
  expires_at: string;
  created_at: string;
}

/** Odpowiedź z portal-validate (Netlify function) */
export interface PortalSessionResponse {
  session_id: string;
  project_id: string;
  company_id: string;
  client_name: string | null;
  client_email: string | null;
  scope: PortalScope[];
  expires_at: string;
}

// ─── project_threads ─────────────────────────────────────────────────────────

export interface ProjectThread {
  id: string;
  company_id: string;
  project_id: string;
  client_id: string | null;
  type: ThreadType;
  visibility: ThreadVisibility;
  title: string | null;
  created_by: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender: MessageSenderType | null;
  unread_count_operator: number;
  unread_count_client: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateThreadInput {
  project_id: string;
  type: ThreadType;
  visibility: ThreadVisibility;
  title?: string;
  client_id?: string;
}

// ─── project_messages ────────────────────────────────────────────────────────

export interface ProjectMessage {
  id: string;
  thread_id: string;
  company_id: string;
  project_id: string;
  sender_type: MessageSenderType;
  sender_user_id: string | null;
  sender_name: string | null;
  body: string;
  visibility: MessageVisibility;
  has_attachments: boolean;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  read_by_operator: boolean;
  read_by_client: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendMessageInput {
  thread_id: string;
  project_id: string;
  body: string;
  visibility: MessageVisibility;
  sender_name?: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_mime?: string;
}

// ─── project_timeline_events ─────────────────────────────────────────────────

export type TimelineEventType =
  | 'cost_added'
  | 'cost_updated'
  | 'cost_deleted'
  | 'cost_approval_sent'
  | 'cost_approved'
  | 'cost_rejected'
  | 'cost_questioned'
  | 'cost_approval_status_changed'
  | 'message_sent'
  | 'client_replied'
  | 'document_added'
  | 'document_removed'
  | 'portal_activated'
  | 'portal_revoked'
  | 'project_status_changed'
  | 'project_created'
  | 'note_added'
  // pozwalamy na rozszerzenie bez zmiany typów
  | (string & Record<never, never>);

export interface ProjectTimelineEvent {
  id: string;
  company_id: string;
  project_id: string;
  event_type: TimelineEventType;
  visibility: TimelineVisibility;
  actor_type: TimelineActorType;
  actor_id: string | null;
  actor_name: string | null;
  title: string;
  description: string | null;
  reference_id: string | null;
  reference_type: TimelineReferenceType | null;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Parametry przekazywane do create_timeline_event() lub RPC */
export interface CreateTimelineEventInput {
  company_id: string;
  project_id: string;
  event_type: TimelineEventType;
  visibility: TimelineVisibility;
  title: string;
  description?: string;
  actor_type?: TimelineActorType;
  actor_id?: string;
  actor_name?: string;
  reference_id?: string;
  reference_type?: TimelineReferenceType;
  payload?: Record<string, unknown>;
}

// ─── cost_approvals ──────────────────────────────────────────────────────────

export interface CostApproval {
  id: string;
  company_id: string;
  project_id: string;
  expense_id: string;
  thread_id: string | null;
  portal_token_id: string | null;
  status: ApprovalStatus;
  snapshot_amount_gross: number | null;
  snapshot_description: string | null;
  snapshot_vendor: string | null;
  snapshot_invoice_number: string | null;
  message_to_client: string | null;
  client_comment: string | null;
  response_idempotency_key: string | null;
  sent_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Operator wysyła prośbę o akceptację */
export interface SendApprovalRequestInput {
  expense_id: string;
  project_id: string;
  portal_token_id: string;
  thread_id?: string;
  message_to_client?: string;
}

/** Klient odpowiada na prośbę o akceptację (przez portal) */
export interface RespondToApprovalInput {
  approval_id: string;
  status: Extract<ApprovalStatus, 'accepted' | 'rejected' | 'questioned'>;
  client_comment?: string;
  /** UUID generowany po stronie klienta — zapobiega double-tap */
  response_idempotency_key: string;
}

// ─── Rozszerzone expense_invoices (po migr. 034) ─────────────────────────────

/** Nowe kolumny dodane w migr. 034 */
export interface ExpenseInvoicePortalFields {
  source_type: ExpenseSourceType;
  cost_type: ExpenseCostType;
  approval_status: ExpenseApprovalStatus;
  approval_sent_at: string | null;
  extraction_confidence: number | null;  // 0.00–1.00
  extraction_warnings: unknown[];
  requires_user_confirmation: boolean;
  parser_source: ParserSource;
  possible_duplicate: boolean;
  duplicate_of_expense_id: string | null;
  category: string | null;
  currency: string;
  sale_date: string | null;
  payment_due_date: string | null;
}

/** Istniejący interfejs + pola portalu */
export type ExpenseInvoiceV2 = {
  id: string;
  company_id: string;
  project_id: string | null;
  project_name?: string;
  file_url: string | null;
  file_name: string | null;
  invoice_number: string | null;
  vendor: string | null;
  vendor_nip: string | null;
  issue_date: string | null;
  amount_net: number | null;
  amount_vat: number | null;
  amount_gross: number | null;
  description: string | null;
  status: 'new' | 'parsed' | 'review' | 'assigned' | 'error';
  duplicate_of: string | null;
  parse_raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
} & ExpenseInvoicePortalFields;

// ─── Parser AI — kształt odpowiedzi ──────────────────────────────────────────

export interface ParsedInvoiceAI {
  invoice_number: string | null;
  vendor: string | null;
  vendor_nip: string | null;
  issue_date: string | null;        // ISO 8601
  sale_date: string | null;
  payment_due_date: string | null;
  amount_net: number | null;
  amount_vat: number | null;
  amount_gross: number | null;
  currency: string;
  category: string | null;
  description: string | null;
  confidence: number;               // 0.00–1.00
  warnings: string[];
  requires_confirmation: boolean;
  parser_source: ParserSource;
  raw_text?: string;
}
