import { demoDb } from '@/shared/lib/demoDb'
import { documentationStore } from '@/shared/lib/documentationStore'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'

export interface PortalThreadMessage {
  id: string
  author: 'client' | 'company'
  text: string
  created_at: string
  read: boolean
}

export interface PortalApprovalItem {
  id: string
  title: string
  description: string
  status: 'pending_client' | 'accepted' | 'rejected' | 'revision_requested'
  type: string
}

export interface PortalProtocolItem {
  id: string
  title: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  summary: string
}

export interface PortalStandardItem {
  id: string
  title: string
  content: string
  accepted: boolean
}

export interface PortalEstimateItem {
  id: string
  name: string
  description?: string
  unit: string
  quantity: number
  unit_price: number
  vat_rate: number
}

export interface PortalPayload {
  token: string
  tokenId: string
  expiresAt: string
  expired: boolean
  active: boolean
  estimateId: string
  estimateNumber: string
  estimateName: string
  estimateStatus: 'draft' | 'sent' | 'accepted' | 'rejected'
  customerName: string
  totalGross: number
  contractorName: string
  contractorEmail: string
  messages: PortalThreadMessage[]
  approvals: PortalApprovalItem[]
  protocols: PortalProtocolItem[]
  standards: PortalStandardItem[]
  items?: PortalEstimateItem[]
  notes?: string
  validUntil?: string | null
}

export interface CompanyPortalToken {
  id: string
  token: string
  estimate_id: string
  estimate_number: string
  estimate_name: string
  client_name: string
  active: boolean
  expires_at: string
  url: string
}

function buildPortalUrl(token: string) {
  return `/portal/${token}`
}

/** Call a Supabase SECURITY DEFINER RPC function (works with anon key, no Netlify needed) */
async function portalRpc(fn: string, params: Record<string, unknown>) {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')
  const { data, error } = await (supabase as any).rpc(fn, params)
  if (error) throw new Error(error.message ?? `Błąd funkcji ${fn}`)
  return data as Record<string, unknown>
}

export const portalApi = {
  async get(token: string): Promise<PortalPayload> {
    if (isDemoMode || !supabase) {
      const payload = demoDb.portal.get(token)
      if (!payload) throw new Error('Portal token not found')
      const approvals = documentationStore.decisions.listForClient(payload.estimate.company_id, payload.estimate.client_id, undefined).map((item) => ({ id: item.id, title: item.title, description: item.description || '', status: item.status, type: item.decision_type }))
      const protocols = documentationStore.protocols.listForClient(payload.estimate.company_id, payload.estimate.client_id, undefined).map((item) => ({ id: item.id, title: item.title, status: item.status, summary: item.summary || '' }))
      const standards = documentationStore.standards.listForClient(payload.estimate.company_id, payload.estimate.client_id, undefined).map((item) => ({ id: item.id, title: item.title, content: item.content, accepted: Boolean(item.accepted_by_client) }))
      return {
        token,
        tokenId: payload.token.id,
        expiresAt: payload.token.expires_at,
        expired: payload.token.expired,
        active: payload.token.active,
        estimateId: payload.estimate.id,
        estimateNumber: payload.estimate.number,
        estimateName: payload.estimate.name,
        estimateStatus: payload.estimate.status,
        customerName: payload.token.client_name,
        totalGross: payload.estimate.total_gross,
        contractorName: payload.contractor?.company ?? 'LoftDesk',
        contractorEmail: payload.contractor?.email ?? '',
        messages: payload.messages.map((message) => ({
          id: message.id,
          author: message.sender,
          text: message.content,
          created_at: message.created_at,
          read: message.read,
        })),
        approvals,
        protocols,
        standards,
        items: payload.estimate.items,
      }
    }
    // Supabase mode — SECURITY DEFINER function (works with anon key, no Netlify env vars needed)
    const data = await portalRpc('portal_get_by_token', { p_token: token })
    if (data?.error === 'not_found') throw new Error('Portal token not found')
    if (data?.error === 'expired') {
      return {
        token, tokenId: '', expiresAt: new Date().toISOString(),
        expired: true, active: false,
        estimateId: '', estimateNumber: '', estimateName: '',
        estimateStatus: 'sent' as const, customerName: 'Klient',
        totalGross: 0, contractorName: 'LoftDesk', contractorEmail: '',
        messages: [], approvals: [], protocols: [], standards: [],
      }
    }
    const tok = (data?.token ?? {}) as any
    const est = (data?.estimate ?? {}) as any
    const contractor = (data?.contractor ?? {}) as any
    return {
      token,
      tokenId: tok.id ?? '',
      expiresAt: tok.expires_at ?? '',
      expired: false,
      active: true,
      estimateId: est.id ?? '',
      estimateNumber: est.number ?? '',
      estimateName: est.name ?? '',
      estimateStatus: est.status ?? 'sent',
      customerName: tok.client_name ?? 'Klient',
      totalGross: Number(est.total_gross ?? 0),
      contractorName: contractor.company ?? contractor.full_name ?? 'LoftDesk',
      contractorEmail: contractor.email ?? '',
      messages: ((data?.messages ?? []) as any[]).map((m) => ({
        id: m.id,
        author: (m.sender === 'company' ? 'company' : 'client') as 'client' | 'company',
        text: m.content,
        created_at: m.created_at,
        read: Boolean(m.read),
      })),
      approvals: [],
      protocols: [],
      standards: [],
      items: ((est.items ?? []) as any[]).map((it) => ({
        id: it.id,
        name: it.name ?? it.description ?? '',
        description: it.description,
        unit: it.unit ?? 'm²',
        quantity: Number(it.quantity ?? 0),
        unit_price: Number(it.unit_price ?? 0),
        vat_rate: Number(it.vat_rate ?? 23),
      })),
      notes: est.notes ?? undefined,
      validUntil: est.valid_until ?? null,
    }
  },
  async sendMessage(token: string, message: string) {
    if (!message.trim()) throw new Error('Wiadomość nie może być pusta')
    if (isDemoMode || !supabase) {
      const saved = demoDb.portal.sendMessage(token, message.trim())
      return { token, message: saved.content, ok: true }
    }
    const data = await portalRpc('portal_send_message', { p_token: token, p_content: message.trim(), p_sender: 'client' })
    if (data?.error) throw new Error(String(data.error))
    return { token, message: message.trim(), ok: true }
  },
  async sendCompanyMessage(token: string, message: string) {
    if (!message.trim()) throw new Error('Wiadomość nie może być pusta')
    if (isDemoMode || !supabase) {
      const saved = demoDb.portal.sendMessage(token, message.trim())
      return { token, message: saved.content, ok: true }
    }
    const data = await portalRpc('portal_send_message', { p_token: token, p_content: message.trim(), p_sender: 'company' })
    if (data?.error) throw new Error(String(data.error))
    return { token, message: message.trim(), ok: true }
  },
  async saveClientName(token: string, clientName: string) {
    if (!clientName.trim()) throw new Error('Podaj imię lub nazwę klienta')
    demoDb.portal.renameClient(token, clientName)
    return { ok: true }
  },
  async decide(token: string, decision: 'accepted' | 'rejected') {
    if (isDemoMode || !supabase) {
      demoDb.portal.decide(token, decision)
      return { ok: true, status: decision }
    }
    const data = await portalRpc('portal_decide', { p_token: token, p_decision: decision })
    if (data?.error) throw new Error(String(data.error))
    return { ok: true, status: decision }
  },

  async decideApproval(id: string, decision: 'accepted' | 'rejected' | 'revision_requested', comment?: string) {
    documentationStore.decisions.decide(id, decision, comment)
    return { ok: true }
  },
  async decideProtocol(id: string, decision: 'accepted' | 'rejected') {
    documentationStore.protocols.decide(id, decision)
    return { ok: true }
  },
  async acceptStandard(id: string) {
    documentationStore.standards.accept(id)
    return { ok: true }
  },
  async listCompanyTokens(companyId: string): Promise<CompanyPortalToken[]> {
    if (isDemoMode || !supabase) {
      return demoDb.portal.listForCompany(companyId).map((item) => ({
        id: item.id,
        token: item.token,
        estimate_id: item.cost_estimate_id,
        estimate_number: item.estimate_number,
        estimate_name: item.estimate_name,
        client_name: item.client_name,
        active: item.active,
        expires_at: item.expires_at,
        url: buildPortalUrl(item.token),
      }))
    }
    const scope = await getDataScope(companyId)
    const table = supabase.from('client_tokens').select('id, token, cost_estimate_id, client_name, active, expires_at, cost_estimates(number, name)').order('created_at', { ascending: false })
    const query = scope.mode === 'multi-tenant' ? table.eq('company_id', scope.companyId) : table.eq('user_id', scope.userId)
    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation') || String((error as any).status ?? '').startsWith('4')) return []
      throw error
    }
    return (data ?? []).map((item: any) => ({
      id: item.id,
      token: item.token,
      estimate_id: item.cost_estimate_id,
      estimate_number: Array.isArray(item.cost_estimates) ? item.cost_estimates[0]?.number ?? '' : item.cost_estimates?.number ?? '',
      estimate_name: Array.isArray(item.cost_estimates) ? item.cost_estimates[0]?.name ?? '' : item.cost_estimates?.name ?? '',
      client_name: item.client_name,
      active: Boolean(item.active),
      expires_at: item.expires_at,
      url: buildPortalUrl(item.token),
    }))
  },
  async createCompanyToken(companyId: string, estimateId: string, userId: string, clientName: string) {
    if (isDemoMode || !supabase) {
      const created = demoDb.estimates.createPortalToken(estimateId, userId, companyId, clientName)
      return { id: created.id, token: created.token, url: buildPortalUrl(created.token) }
    }
    const scope = await getDataScope(companyId)
    const token = `pt-${Math.random().toString(36).slice(2, 12)}`
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const payload = scope.mode === 'multi-tenant'
      ? { company_id: scope.companyId, user_id: userId, cost_estimate_id: estimateId, client_name: clientName.trim() || 'Klient', token, active: true, expires_at: expiresAt }
      : { user_id: scope.userId, cost_estimate_id: estimateId, client_name: clientName.trim() || 'Klient', token, active: true, expires_at: expiresAt }
    const { data, error } = await supabase.from('client_tokens').insert(payload).select('id, token').single()
    if (error) throw error
    return { id: data.id, token: data.token, url: buildPortalUrl(data.token) }
  },
  async deactivateCompanyToken(companyId: string, tokenId: string) {
    if (isDemoMode || !supabase) {
      demoDb.portal.deactivateToken(tokenId)
      return { ok: true }
    }
    const scope = await getDataScope(companyId)
    const table = supabase.from('client_tokens').update({ active: false }).eq('id', tokenId)
    const query = scope.mode === 'multi-tenant' ? table.eq('company_id', scope.companyId) : table.eq('user_id', scope.userId)
    const { error } = await query
    if (error) throw error
    return { ok: true }
  },
}
