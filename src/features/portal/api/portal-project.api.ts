// =============================================================================
// Portal Projektu — API dla strony klienckiej
// =============================================================================
// Wszystkie funkcje wymagają session_id (UUID z project_portal_sessions).
// Komunikacja: supabase.rpc() z anon key + SECURITY DEFINER functions z migr. 035.
//
// Przepływ danych:
//   usePortalSession posiada session_id
//   → komponentu wywołuje funkcje z tego pliku
//   → tu wołamy supabase.rpc(...)
//   → SECURITY DEFINER function waliduje sesję WEWNĄTRZ bazy
//   → zwraca dane lub null/[] jeśli sesja wygasła/nieprawidłowa

import { supabase } from '@/shared/lib/supabase'
import type {
  CostApproval,
  ProjectMessage,
  ProjectTimelineEvent,
  RespondToApprovalInput,
} from '@/features/portal/model/project-portal.types'

// ─── Typ danych projektu widocznych przez portal ─────────────────────────────

export interface PortalProjectData {
  id: string
  number: string
  name: string
  status: 'offer' | 'active' | 'done' | 'cancelled'
  start_date: string | null
  end_date: string | null
  address?: string
}

// ─── Walidacja tokenu (Netlify function) ─────────────────────────────────────

export type PortalValidateStatus = 'ok' | 'invalid' | 'expired' | 'revoked' | 'not_found' | 'error'

export interface PortalValidateResponse {
  status: PortalValidateStatus
  session_id?: string
  expires_at?: string
  project_id?: string
  company_id?: string
  client_name?: string | null
  client_email?: string | null
  scope?: string[]
  project?: PortalProjectData | null
}

export async function validatePortalToken(rawToken: string): Promise<PortalValidateResponse> {
  const url = `/.netlify/functions/portal-validate?token=${encodeURIComponent(rawToken)}`
  const res = await fetch(url)
  const data = await res.json()
  return data as PortalValidateResponse
}

// ─── Dane projektu (przez RPC) ───────────────────────────────────────────────

export async function portalGetProject(sessionId: string): Promise<PortalProjectData | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('portal_get_project', { p_session_id: sessionId })
  if (error) {
    console.warn('[portal-project.api] portal_get_project error:', error.message)
    return null
  }
  return data as PortalProjectData | null
}

// ─── Oś czasu (widoczna dla klienta) ─────────────────────────────────────────

export async function portalGetTimeline(
  sessionId: string,
  limit = 50,
): Promise<ProjectTimelineEvent[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('portal_get_timeline', {
    p_session_id: sessionId,
    p_limit: limit,
  })
  if (error) {
    console.warn('[portal-project.api] portal_get_timeline error:', error.message)
    return []
  }
  return (data as ProjectTimelineEvent[]) ?? []
}

// ─── Akceptacje ───────────────────────────────────────────────────────────────

export async function portalGetApprovals(sessionId: string): Promise<CostApproval[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('portal_get_approvals', { p_session_id: sessionId })
  if (error) {
    console.warn('[portal-project.api] portal_get_approvals error:', error.message)
    return []
  }
  return (data as CostApproval[]) ?? []
}

export async function portalRespondApproval(
  sessionId: string,
  input: RespondToApprovalInput,
): Promise<'ok' | 'already_responded' | 'already_processed' | 'error'> {
  if (!supabase) return 'error'
  const { data, error } = await supabase.rpc('portal_respond_approval', {
    p_session_id:      sessionId,
    p_approval_id:     input.approval_id,
    p_new_status:      input.status,
    p_client_comment:  input.client_comment ?? null,
    p_idempotency_key: input.response_idempotency_key,
  })
  if (error) {
    console.warn('[portal-project.api] portal_respond_approval error:', error.message)
    return 'error'
  }
  return (data as string) as 'ok' | 'already_responded' | 'already_processed' | 'error'
}

// ─── Wiadomości ───────────────────────────────────────────────────────────────

export async function portalGetMessages(sessionId: string, limit = 100): Promise<ProjectMessage[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('portal_get_messages', {
    p_session_id: sessionId,
    p_limit: limit,
  })
  if (error) {
    console.warn('[portal-project.api] portal_get_messages error:', error.message)
    return []
  }
  return (data as ProjectMessage[]) ?? []
}

export async function portalSendMessage(
  sessionId: string,
  body: string,
  senderName?: string,
): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('portal_send_message', {
    p_session_id:  sessionId,
    p_body:        body,
    p_sender_name: senderName ?? null,
  })
  if (error) {
    console.warn('[portal-project.api] portal_send_message error:', error.message)
    return null
  }
  return data as string | null
}

export async function portalMarkMessagesRead(sessionId: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('portal_mark_messages_read', { p_session_id: sessionId })
}

// ─── Token operatora — tworzenie i zarządzanie ───────────────────────────────
// (używane przez stronę operatora, nie przez klienta)

import type { CreatePortalTokenInput, ProjectPortalToken } from '@/features/portal/model/project-portal.types'

export async function createProjectPortalToken(
  input: CreatePortalTokenInput & { company_id: string },
): Promise<{ raw_token: string; id: string } | null> {
  // Generujemy raw token po stronie frontendu, backend go hashuje
  // Tutaj token jest generowany po stronie API — w praktyce powinna to
  // robić osobna Netlify function, żeby hash był robiony server-side.
  // Na tym etapie: do Supabase wstawiamy już zahashowaną wartość.
  //
  // TODO Etap 3: Przenieść generowanie tokenów do dedykowanej Netlify function
  //   (portal-token-create.ts), która:
  //   1. Generuje kryptograficznie bezpieczny raw token (crypto.randomBytes(32).toString('hex'))
  //   2. Hashuje SHA-256
  //   3. Wstawia do project_portal_tokens
  //   4. Zwraca raw token TYLKO RAZ do operatora
  //
  // Na potrzeby MVP: generujemy raw token w przeglądarce, hashujemy SHA-256 (SubtleCrypto)
  // i wstawiamy bezpośrednio. Bezpieczeństwo: token_hash UNIQUE gwarantuje unikalność.

  if (!supabase) return null

  const rawBytes = crypto.getRandomValues(new Uint8Array(32))
  const rawToken = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const { data, error } = await supabase
    .from('project_portal_tokens')
    .insert({
      company_id:   input.company_id,
      project_id:   input.project_id,
      client_id:    input.client_id    ?? null,
      scope:        input.scope        ?? ['read_updates', 'read_messages', 'send_messages', 'read_documents', 'read_approvals', 'respond_approvals'],
      client_name:  input.client_name  ?? null,
      client_email: input.client_email ?? null,
      expires_at:   input.expires_at   ?? null,
      token_hash:   tokenHash,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.warn('[portal-project.api] createProjectPortalToken error:', error?.message)
    return null
  }

  return { raw_token: rawToken, id: data.id }
}

export async function revokeProjectPortalToken(
  tokenId: string,
  jwt: string,
): Promise<boolean> {
  const res = await fetch('/.netlify/functions/portal-revoke', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({ token_id: tokenId }),
  })
  return res.ok
}

export async function listProjectPortalTokens(projectId: string): Promise<ProjectPortalToken[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_portal_tokens')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as ProjectPortalToken[]
}
