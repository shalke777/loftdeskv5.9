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

// Typ odpowiedzi z portal-token-create.ts
interface PortalTokenCreateResponse {
  status: 'ok' | 'error'
  raw_token: string
  token_id: string
  portal_url: string
  expires_at: string | null
  scope: string[]
}

/**
 * Tworzy nowy token portalu klienta przez Netlify function portal-token-create.
 *
 * - raw token oraz SHA-256 są generowane WYŁĄCZNIE po stronie serwera
 * - do DB trafia tylko token_hash — nigdy plaintext
 * - raw token wraca tylko raz w tej odpowiedzi; po odświeżeniu strony jest niedostępny
 * - poprzedni aktywny token dla projektu jest automatycznie unieważniany (auto-revoke)
 */
export async function createProjectPortalToken(
  input: CreatePortalTokenInput & { company_id: string },
): Promise<{ raw_token: string; id: string }> {
  if (!supabase) throw new Error('Klient Supabase nie jest zainicjowany')

  // JWT operatora — wymagany przez portal-token-create.
  // getSession() zwraca cached token, który może być wygasły.
  // Sprawdzamy expires_at i wymuszamy refresh jeśli token wygasł lub zaraz wygaśnie.
  const { data: sessionData } = await supabase.auth.getSession()
  let jwt = sessionData.session?.access_token
  const expiresAt = (sessionData.session?.expires_at ?? 0) * 1000

  if (!jwt || Date.now() >= expiresAt - 15_000) {
    // Token wygasł lub wygaśnie za <15s — odśwież przez refresh_token
    const { data: freshData, error: refreshErr } = await supabase.auth.refreshSession()
    if (refreshErr || !freshData.session?.access_token) {
      throw new Error('Brak aktywnej sesji — zaloguj się ponownie')
    }
    jwt = freshData.session.access_token
  }

  const res = await fetch('/.netlify/functions/portal-token-create', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      company_id:   input.company_id,
      project_id:   input.project_id,
      scope:        input.scope        ?? null,
      client_name:  input.client_name  ?? null,
      client_email: input.client_email ?? null,
      expires_at:   input.expires_at   ?? null,
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>
    const errCode = (errBody.error as string | undefined) ?? String(res.status)
    console.warn('[portal-project.api] createProjectPortalToken error:', res.status, errCode)
    if (res.status === 401) throw new Error('Brak aktywnej sesji — zaloguj się ponownie')
    if (res.status === 403) throw new Error('Brak uprawnień do generowania linku portalu')
    if (res.status === 404) throw new Error('Projekt nie istnieje lub nie należy do tej firmy')
    throw new Error(`Błąd serwera (${res.status}): ${errCode}`)
  }

  const data = await res.json() as PortalTokenCreateResponse
  if (data.status !== 'ok') throw new Error('Serwer zwrócił nieoczekiwaną odpowiedź')

  return { raw_token: data.raw_token, id: data.token_id }
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
