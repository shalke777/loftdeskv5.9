// =============================================================================
// client-notifications.api.ts — API powiadomień klienta
// =============================================================================
// Strona klienta: odczyt + mark-as-read (przez RLS).
// Strona operatora: tworzenie powiadomień (fire-and-forget helper).
// =============================================================================

import { supabase, isDemoMode } from '@/shared/lib/supabase'

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type ClientNotificationType =
  | 'approval_requested'
  | 'approval_status_changed'
  | 'new_message'
  | 'document_shared'

export interface ClientNotification {
  id: string
  company_id: string
  project_id: string
  client_account_id: string
  type: ClientNotificationType
  title: string
  body: string | null
  reference_type: string | null
  reference_id: string | null
  read_at: string | null
  created_at: string
  // Joined fields (optional, from query)
  project_name?: string | null
}

// ─── Client-side API (RLS: client role) ───────────────────────────────────────

export const clientNotificationsApi = {
  /** Lista powiadomień klienta (najnowsze pierwsze, max 50) */
  async list(): Promise<ClientNotification[]> {
    if (!supabase || isDemoMode) return []
    const { data, error } = await supabase
      .from('client_notifications')
      .select(`
        id, company_id, project_id, client_account_id,
        type, title, body, reference_type, reference_id,
        read_at, created_at,
        projects!inner(name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return ((data ?? []) as any[]).map(row => ({
      ...row,
      project_name: row.projects?.name ?? null,
      projects: undefined,
    })) as ClientNotification[]
  },

  /** Liczba nieprzeczytanych powiadomień */
  async unreadCount(): Promise<number> {
    if (!supabase || isDemoMode) return 0
    const { count, error } = await supabase
      .from('client_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    if (error) throw error
    return count ?? 0
  },

  /** Oznacz jedno powiadomienie jako przeczytane */
  async markRead(notificationId: string): Promise<void> {
    if (!supabase || isDemoMode) return
    const { error } = await supabase
      .from('client_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null)
    if (error) throw error
  },

  /** Oznacz wszystkie powiadomienia jako przeczytane */
  async markAllRead(): Promise<void> {
    if (!supabase || isDemoMode) return
    const { error } = await supabase
      .from('client_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (error) throw error
  },
}

// ─── Operator-side: tworzenie powiadomień (fire-and-forget) ───────────────────

interface CreateNotificationParams {
  companyId: string
  projectId: string
  type: ClientNotificationType
  title: string
  body?: string
  referenceType?: 'approval' | 'thread' | 'message' | 'document' | 'project'
  referenceId?: string
}

/**
 * Tworzy powiadomienia dla WSZYSTKICH klientów z dostępem do danego projektu.
 * Fire-and-forget — nigdy nie blokuje głównego flow.
 * Wywołuj z kontekstu operatora (RLS: cn_operator_insert).
 */
export async function createClientNotification(params: CreateNotificationParams): Promise<void> {
  if (!supabase || isDemoMode) return

  // 1. Znajdź klientów z dostępem do projektu
  const { data: accessRecords, error: accessErr } = await supabase
    .from('project_client_access')
    .select('client_account_id')
    .eq('project_id', params.projectId)
    .eq('company_id', params.companyId)

  if (accessErr || !accessRecords?.length) return

  // 2. Deduplikuj client_account_id (na wypadek duplikatów w access)
  const clientIds = [...new Set(accessRecords.map(r => r.client_account_id))]

  // 3. Wstaw powiadomienie dla każdego klienta
  const rows = clientIds.map(clientAccountId => ({
    company_id: params.companyId,
    project_id: params.projectId,
    client_account_id: clientAccountId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    reference_type: params.referenceType ?? null,
    reference_id: params.referenceId ?? null,
  }))

  const { error } = await supabase
    .from('client_notifications')
    .insert(rows)

  if (error) {
    console.warn('[client-notifications] insert failed:', error.message)
  }
}
