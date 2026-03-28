// =============================================================================
// operator-notifications.api.ts — API powiadomień operatora
// =============================================================================
// Powiadomienia generowane przez Postgres triggery (migration 070):
//   - client_message:            klient wysłał wiadomość
//   - client_approval_response:  klient zaakceptował / odrzucił / zakwestionował koszt
// =============================================================================

import { supabase, isDemoMode } from '@/shared/lib/supabase'

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type OperatorNotificationType =
  | 'client_message'
  | 'client_approval_response'

export interface OperatorNotification {
  id: string
  company_id: string
  project_id: string | null
  type: OperatorNotificationType
  title: string
  body: string | null
  reference_type: string | null
  reference_id: string | null
  read_at: string | null
  created_at: string
  project_name?: string | null
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const operatorNotificationsApi = {
  /** Lista powiadomień operatora (najnowsze pierwsze, max 50) */
  async list(): Promise<OperatorNotification[]> {
    if (!supabase || isDemoMode) return []
    const { data, error } = await supabase
      .from('operator_notifications')
      .select(`
        id, company_id, project_id,
        type, title, body, reference_type, reference_id,
        read_at, created_at,
        projects(name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return ((data ?? []) as any[]).map(row => ({
      ...row,
      project_name: row.projects?.name ?? null,
      projects: undefined,
    })) as OperatorNotification[]
  },

  /** Liczba nieprzeczytanych powiadomień (dla badge w topbarze) */
  async unreadCount(): Promise<number> {
    if (!supabase || isDemoMode) return 0
    const { count, error } = await supabase
      .from('operator_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    if (error) throw error
    return count ?? 0
  },

  /** Oznacz wszystkie powiadomienia operatora jako przeczytane */
  async markAllRead(): Promise<void> {
    if (!supabase || isDemoMode) return
    const { error } = await supabase
      .from('operator_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (error) throw error
  },
}
