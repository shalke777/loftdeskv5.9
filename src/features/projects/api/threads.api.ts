// =============================================================================
// Threads API — projekt-centryczny system wiadomości
// =============================================================================
// Obsługuje project_threads + project_messages dla strony operatora.
// Portal klienta używa odrębnych SECURITY DEFINER RPC z migr. 035.
//
// LEGACY:
//   - conversations / conversation_messages — stary model, nie migrujemy danych
//   - portal_messages — stary stos, nie migrujemy danych
//   Nowe wiadomości od Etapu 3+ idą wyłącznie przez project_threads / project_messages.

import { supabase, isDemoMode } from '@/shared/lib/supabase'
import { getDataScope, applyScope } from '@/shared/lib/dataScope'
import type {
  ProjectThread,
  ProjectMessage,
  ThreadType,
  ThreadVisibility,
  MessageVisibility,
  MessageSenderType,
} from '@/features/portal/model/project-portal.types'

// ─── Typy wejściowe / wyjściowe ───────────────────────────────────────────────

export interface CreateThreadInput {
  project_id: string
  type: ThreadType
  visibility: ThreadVisibility
  title?: string
  client_id?: string
}

export interface SendThreadMessageInput {
  thread_id: string
  project_id: string
  body: string
  /** Wymuś visibility — jeśli nie podano, dziedziczy po wątku */
  visibility: MessageVisibility
  sender_name?: string
  attachment_url?: string
  attachment_name?: string
  attachment_mime?: string
}

/** Thread wzbogacony o nazwę projektu — potrzebny w globalnym inboxie */
export interface InboxThread extends ProjectThread {
  project_name: string | null
  project_number: string | null
  project_status: string | null
}

// ─── Demo dane (fallback gdy isDemoMode) ─────────────────────────────────────

const demoThreads: ProjectThread[] = [
  {
    id: 'demo-thread-1',
    company_id: 'demo-company',
    project_id: 'demo-project-1',
    client_id: null,
    type: 'general',
    visibility: 'client_shared',
    title: 'Pytania i odpowiedzi',
    created_by: null,
    last_message_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    last_message_preview: 'Kiedy możecie zacząć prace?',
    last_message_sender: 'client',
    unread_count_operator: 2,
    unread_count_client: 0,
    archived: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-thread-2',
    company_id: 'demo-company',
    project_id: 'demo-project-1',
    client_id: null,
    type: 'internal',
    visibility: 'internal',
    title: 'Notatki wewnętrzne',
    created_by: null,
    last_message_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    last_message_preview: 'Sprawdź faktury od dostawcy',
    last_message_sender: 'operator',
    unread_count_operator: 0,
    unread_count_client: 0,
    archived: false,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

const demoMessages: ProjectMessage[] = [
  {
    id: 'demo-msg-1',
    thread_id: 'demo-thread-1',
    company_id: 'demo-company',
    project_id: 'demo-project-1',
    sender_type: 'operator',
    sender_user_id: null,
    sender_name: 'Operator',
    body: 'Dzień dobry! Czy ma Pan/Pani jakieś pytania dotyczące projektu?',
    visibility: 'client_shared',
    has_attachments: false,
    attachment_url: null,
    attachment_name: null,
    attachment_mime: null,
    read_by_operator: true,
    read_by_client: true,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-msg-2',
    thread_id: 'demo-thread-1',
    company_id: 'demo-company',
    project_id: 'demo-project-1',
    sender_type: 'client',
    sender_user_id: null,
    sender_name: 'Jan Klient',
    body: 'Kiedy możecie zacząć prace?',
    visibility: 'client_shared',
    has_attachments: false,
    attachment_url: null,
    attachment_name: null,
    attachment_mime: null,
    read_by_operator: false,
    read_by_client: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
]

// ─── API ──────────────────────────────────────────────────────────────────────

export const threadsApi = {
  // ---------------------------------------------------------------------------
  // Wątki projektu
  // ---------------------------------------------------------------------------

  async listThreads(projectId: string, companyId?: string): Promise<ProjectThread[]> {
    if (isDemoMode || !supabase) {
      return demoThreads.filter(t => t.project_id === projectId)
    }
    const scope = await getDataScope(companyId)
    const { data, error } = await applyScope(
      supabase
        .from('project_threads')
        .select('*')
        .eq('project_id', projectId)
        .eq('archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      scope,
    )
    if (error) throw error
    return (data ?? []) as ProjectThread[]
  },

  /** Globalny inbox — wszystkie wątki firmy, wzbogacone o nazwę projektu */
  async listInboxThreads(companyId?: string): Promise<InboxThread[]> {
    if (isDemoMode || !supabase) {
      return demoThreads.map(t => ({
        ...t,
        project_name: 'Remont łazienki',
        project_number: 'PRJ/2024/001',
        project_status: 'active',
      }))
    }
    const scope = await getDataScope(companyId)
    const { data, error } = await applyScope(
      supabase
        .from('project_threads')
        .select(`
          *,
          projects!inner(name, number, status)
        `)
        .eq('archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      scope,
    )
    if (error) throw error
    return ((data ?? []) as any[]).map(row => ({
      ...row,
      project_name:   row.projects?.name   ?? null,
      project_number: row.projects?.number ?? null,
      project_status: row.projects?.status ?? null,
      projects: undefined, // usuń zagnieżdżony obiekt
    })) as InboxThread[]
  },

  async getThread(threadId: string, companyId?: string): Promise<ProjectThread | null> {
    if (isDemoMode || !supabase) {
      return demoThreads.find(t => t.id === threadId) ?? null
    }
    const scope = await getDataScope(companyId)
    const { data, error } = await applyScope(
      supabase.from('project_threads').select('*').eq('id', threadId).maybeSingle(),
      scope,
    )
    if (error) throw error
    return (data as ProjectThread | null)
  },

  /**
   * Pobiera istniejący lub tworzy nowy wątek client_shared dla projektu.
   *
   * Stosowany przy przepływie Wycena → Portal → Chat: kliknięcie "Otwórz chat
   * z klientem" na karcie wyceny automatycznie zakłada jeden (i tylko jeden)
   * wątek ogólny widoczny dla klienta, jeśli jeszcze nie istnieje.
   */
  async getOrCreateClientSharedThread(
    projectId: string,
    clientId: string | null,
    title: string,
    companyId?: string,
  ): Promise<ProjectThread> {
    const existing = await threadsApi.listThreads(projectId, companyId)
    const found = existing.find(
      (t) => t.visibility === 'client_shared' && t.type === 'general',
    )
    if (found) return found
    return threadsApi.createThread(
      { project_id: projectId, type: 'general', visibility: 'client_shared', title, client_id: clientId ?? undefined },
      companyId,
    )
  },

  /**
   * Tworzy nowy wątek dla projektu.
   *
   * Zasady:
   *  - jeden wątek 'approvals' na projekt (nie blokujemy tutaj — kod klienta powinien sprawdzić)
   *  - internal wątek: tworzony przez operatora, klient nigdy nie widzi
   *  - client_shared: może być wiele (general, documents, payments, technical...)
   */
  async createThread(
    input: CreateThreadInput,
    companyId?: string,
  ): Promise<ProjectThread> {
    if (isDemoMode || !supabase) {
      const thread: ProjectThread = {
        id: `demo-thread-${Date.now()}`,
        company_id: 'demo-company',
        ...input,
        created_by: null,
        last_message_at: null,
        last_message_preview: null,
        last_message_sender: null,
        unread_count_operator: 0,
        unread_count_client: 0,
        archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        client_id: input.client_id ?? null,
        type: input.type,
        visibility: input.visibility,
        title: input.title ?? null,
      }
      demoThreads.unshift(thread)
      return thread
    }
    const scope = await getDataScope(companyId)
    const payload = {
      company_id: scope.companyId,
      project_id: input.project_id,
      type: input.type,
      visibility: input.visibility,
      title: input.title ?? null,
      client_id: input.client_id ?? null,
      created_by: scope.userId,
    }
    const { data, error } = await supabase
      .from('project_threads')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as ProjectThread
  },

  // ---------------------------------------------------------------------------
  // Wiadomości
  // ---------------------------------------------------------------------------

  async listMessages(threadId: string, companyId?: string, limit = 100): Promise<ProjectMessage[]> {
    if (isDemoMode || !supabase) {
      return demoMessages.filter(m => m.thread_id === threadId)
    }
    const scope = await getDataScope(companyId)
    const { data, error } = await applyScope(
      supabase
        .from('project_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit),
      scope,
    )
    if (error) throw error
    return (data ?? []) as ProjectMessage[]
  },

  /**
   * Wysyła wiadomość operatora + aktualizuje statystyki wątku.
   *
   * Unread logic:
   *   visibility = 'client_shared' → unread_count_client++
   *   visibility = 'internal'      → nie inkrementuj unread klienta
   */
  async sendMessage(
    input: SendThreadMessageInput,
    companyId?: string,
    senderName?: string,
  ): Promise<ProjectMessage> {
    if (isDemoMode || !supabase) {
      const msg: ProjectMessage = {
        id: `demo-msg-${Date.now()}`,
        thread_id: input.thread_id,
        company_id: 'demo-company',
        project_id: input.project_id,
        sender_type: 'operator',
        sender_user_id: null,
        sender_name: senderName ?? 'Operator',
        body: input.body,
        visibility: input.visibility,
        has_attachments: false,
        attachment_url: input.attachment_url ?? null,
        attachment_name: input.attachment_name ?? null,
        attachment_mime: input.attachment_mime ?? null,
        read_by_operator: true,
        read_by_client: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoMessages.push(msg)
      return msg
    }

    const scope = await getDataScope(companyId)
    const preview = input.body.trim().slice(0, 80) + (input.body.length > 80 ? '…' : '')

    // 1. Wstaw wiadomość
    const { data: msg, error: msgErr } = await supabase
      .from('project_messages')
      .insert({
        thread_id:       input.thread_id,
        company_id:      scope.companyId,
        project_id:      input.project_id,
        sender_type:     'operator' as MessageSenderType,
        sender_user_id:  scope.userId,
        sender_name:     senderName ?? null,
        body:            input.body.trim(),
        visibility:      input.visibility,
        has_attachments: !!(input.attachment_url),
        attachment_url:  input.attachment_url ?? null,
        attachment_name: input.attachment_name ?? null,
        attachment_mime: input.attachment_mime ?? null,
        read_by_operator: true,   // operator właśnie to napisał
        read_by_client:   false,
      })
      .select('*')
      .single()
    if (msgErr) throw msgErr

    // 2. Aktualizuj thread stats
    const threadUpdate: Record<string, unknown> = {
      last_message_at:      new Date().toISOString(),
      last_message_preview: preview,
      last_message_sender:  'operator',
    }
    // Inkrementuj unread klienta tylko jeśli wiadomość jest dla niego widoczna
    if (input.visibility === 'client_shared') {
      // RPC increment aby uniknąć race condition
      await supabase.rpc('increment_thread_unread', {
        p_thread_id: input.thread_id,
        p_side:      'client',
      }).maybeSingle() // ignoruj błąd jeśli RPC nie istnieje
    }
    await supabase
      .from('project_threads')
      .update(threadUpdate)
      .eq('id', input.thread_id)

    return msg as ProjectMessage
  },

  // ---------------------------------------------------------------------------
  // Mark as read
  // ---------------------------------------------------------------------------

  /**
   * Oznacza wiadomości jako przeczytane po wskazanej stronie.
   *
   * side = 'operator': wszystkie wiadomości klienta → read_by_operator = true,
   *                    unread_count_operator = 0
   * side = 'client':   wszystkie wiadomości operatora (client_shared) → read_by_client = true,
   *                    unread_count_client = 0
   *
   * Uwaga: NIGDY nie wywołuj w pętli. Użyj hooka useMarkThreadRead który
   * chroni przed podwójnym wywołaniem przez ref.
   */
  async markThreadRead(
    threadId: string,
    side: 'operator' | 'client',
    companyId?: string,
  ): Promise<void> {
    if (isDemoMode || !supabase) return

    const scope = await getDataScope(companyId)

    if (side === 'operator') {
      await supabase
        .from('project_messages')
        .update({ read_by_operator: true })
        .eq('thread_id', threadId)
        .eq('company_id', scope.companyId)
        .neq('sender_type', 'operator')
        .eq('read_by_operator', false)

      await supabase
        .from('project_threads')
        .update({ unread_count_operator: 0 })
        .eq('id', threadId)
        .eq('company_id', scope.companyId)
    } else {
      // client — wywoływane przez portal_mark_messages_read RPC (migr. 035), nie stąd
      await supabase
        .from('project_messages')
        .update({ read_by_client: true })
        .eq('thread_id', threadId)
        .eq('company_id', scope.companyId)
        .eq('visibility', 'client_shared')
        .neq('sender_type', 'client')
        .eq('read_by_client', false)

      await supabase
        .from('project_threads')
        .update({ unread_count_client: 0 })
        .eq('id', threadId)
        .eq('company_id', scope.companyId)
    }
  },
}
