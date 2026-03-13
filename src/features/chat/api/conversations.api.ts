// =============================================================================
// Conversations API — operator-side chat/rozmowy module
// Works dual-mode: demo (in-memory) or Supabase.
// =============================================================================

import { isDemoMode, supabase } from '@/shared/lib/supabase'

export interface Conversation {
  id: string
  company_id: string
  client_id: string | null
  project_id: string | null
  portal_token_id: string | null
  subject: string | null
  client_name?: string   // joined
  project_name?: string  // joined
  last_message_at: string | null
  last_message_preview?: string
  last_message_sender?: string
  unread_count: number
  archived: boolean
  created_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  company_id: string
  sender: 'operator' | 'client' | 'note'
  content: string
  attachment_url: string | null
  attachment_name: string | null
  read: boolean
  created_at: string
}

// ── in-memory demo store ──────────────────────────────────────────────────────

const demoConvs: Conversation[] = [
  {
    id: 'demo-conv-1',
    company_id: 'demo-company',
    client_id: 'demo-client-1',
    project_id: 'demo-project-1',
    portal_token_id: null,
    subject: 'Pytanie o termin realizacji',
    client_name: 'Jan Kowalski',
    project_name: 'Remont łazienki',
    last_message_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    last_message_preview: 'Kiedy możecie zacząć montaż płytek?',
    last_message_sender: 'client',
    unread_count: 2,
    archived: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-conv-2',
    company_id: 'demo-company',
    client_id: 'demo-client-2',
    project_id: null,
    portal_token_id: null,
    subject: 'Zapytanie o wycenę malowania',
    client_name: 'Anna Nowak',
    project_name: undefined,
    last_message_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    last_message_preview: 'Dziękuję za powiadomienie.',
    last_message_sender: 'operator',
    unread_count: 0,
    archived: false,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

const demoMessages: ConversationMessage[] = [
  { id: 'msg-1', conversation_id: 'demo-conv-1', company_id: 'demo-company', sender: 'client', content: 'Kiedy możecie zacząć montaż płytek?', attachment_url: null, attachment_name: null, read: false, created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'msg-2', conversation_id: 'demo-conv-1', company_id: 'demo-company', sender: 'operator', content: 'Zaczynamy w poniedziałek rano. Prosimy o udostępnienie mieszkania od godziny 8.', attachment_url: null, attachment_name: null, read: true, created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: 'msg-3', conversation_id: 'demo-conv-1', company_id: 'demo-company', sender: 'client', content: 'Świetnie, będę na miejscu. Czy potrzebny jest jakiś klucz?', attachment_url: null, attachment_name: null, read: false, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString() },
  { id: 'msg-4', conversation_id: 'demo-conv-2', company_id: 'demo-company', sender: 'operator', content: 'Wysłaliśmy wycenę na Pani email.', attachment_url: null, attachment_name: null, read: true, created_at: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString() },
  { id: 'msg-5', conversation_id: 'demo-conv-2', company_id: 'demo-company', sender: 'client', content: 'Dziękuję za powiadomienie.', attachment_url: null, attachment_name: null, read: true, created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
]

// ─────────────────────────────────────────────────────────────────────────────

export const conversationsApi = {
  async list(companyId: string): Promise<Conversation[]> {
    if (isDemoMode || !supabase) return demoConvs.filter((c) => !c.archived)

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        clients(name),
        projects(name)
      `)
      .eq('company_id', companyId)
      .eq('archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) throw error
    return (data ?? []).map((row: any) => ({
      ...row,
      client_name: row.clients?.name ?? null,
      project_name: row.projects?.name ?? null,
    }))
  },

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    if (isDemoMode || !supabase) {
      return demoMessages.filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as ConversationMessage[]
  },

  async sendMessage(input: {
    conversationId: string
    companyId: string
    content: string
    sender: 'operator' | 'note'
    attachmentUrl?: string
    attachmentName?: string
  }): Promise<ConversationMessage> {
    if (isDemoMode || !supabase) {
      const msg: ConversationMessage = {
        id: `msg-demo-${Date.now()}`,
        conversation_id: input.conversationId,
        company_id: input.companyId,
        sender: input.sender,
        content: input.content,
        attachment_url: input.attachmentUrl ?? null,
        attachment_name: input.attachmentName ?? null,
        read: true,
        created_at: new Date().toISOString(),
      }
      demoMessages.push(msg)
      const conv = demoConvs.find((c) => c.id === input.conversationId)
      if (conv) {
        conv.last_message_at = msg.created_at
        conv.last_message_preview = input.content
        conv.last_message_sender = input.sender
      }
      return msg
    }

    // Insert message — no user_id column in this table
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: input.conversationId,
        company_id: input.companyId,
        sender: input.sender,
        content: input.content,
        attachment_url: input.attachmentUrl ?? null,
        attachment_name: input.attachmentName ?? null,
        read: true,
      })
      .select('*')
      .single()

    if (error) throw error

    // Keep conversation snapshot up-to-date
    await supabase
      .from('conversations')
      .update({
        last_message_at: data.created_at,
        last_message_preview: input.content.slice(0, 160),
        last_message_sender: input.sender,
      })
      .eq('id', input.conversationId)

    return data as ConversationMessage
  },

  async markRead(conversationId: string, companyId: string): Promise<void> {
    if (isDemoMode || !supabase) {
      demoMessages
        .filter((m) => m.conversation_id === conversationId && m.sender === 'client')
        .forEach((m) => { m.read = true })
      const conv = demoConvs.find((c) => c.id === conversationId)
      if (conv) conv.unread_count = 0
      return
    }

    await supabase
      .from('conversation_messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .eq('sender', 'client')

    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)
      .eq('company_id', companyId)
  },

  async create(input: {
    companyId: string
    clientId?: string | null
    projectId?: string | null
    subject?: string
  }): Promise<Conversation> {
    if (isDemoMode || !supabase) {
      const conv: Conversation = {
        id: `demo-conv-${Date.now()}`,
        company_id: input.companyId,
        client_id: input.clientId ?? null,
        project_id: input.projectId ?? null,
        portal_token_id: null,
        subject: input.subject ?? null,
        last_message_at: null,
        unread_count: 0,
        archived: false,
        created_at: new Date().toISOString(),
      }
      demoConvs.unshift(conv)
      return conv
    }

    // Insert conversation — no user_id column in this table
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        company_id: input.companyId,
        client_id: input.clientId ?? null,
        project_id: input.projectId ?? null,
        subject: input.subject ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    return data as Conversation
  },

  async uploadAttachment(file: File, companyId: string): Promise<{ url: string; name: string }> {
    if (isDemoMode || !supabase) {
      return { url: URL.createObjectURL(file), name: file.name }
    }
    const safeName = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
    const contentType = file.type || 'application/octet-stream'
    const path = `${companyId}/chat/${Date.now()}_${safeName}`
    const { error } = await supabase.storage
      .from('company-files')
      .upload(path, file, { upsert: false, contentType })
    if (error) throw error
    const { data } = supabase.storage.from('company-files').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name }
  },
}
