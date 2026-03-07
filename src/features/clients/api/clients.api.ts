import type { Client } from '@/entities/client/model'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { applyScope, getDataScope, withScope } from '@/shared/lib/dataScope'

export const clientsApi = {
  async list(companyId: string): Promise<Client[]> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.clients.list(companyId))
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('clients').select('*').order('created_at', { ascending: false }), scope)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row: any) => ({ id: row.id, company_id: row.company_id ?? companyId, name: row.name, email: row.email ?? '', phone: row.phone ?? '', city: row.city ?? row.address ?? '', address: row.address ?? '', postal_code: row.postal_code ?? '', nip: row.nip ?? '', contact_person: row.contact_person ?? '', created_at: row.created_at }))
  },
  async create(input: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.clients.create(input))
    const scope = await getDataScope(input.company_id)
    const payload = withScope(scope, { name: input.name, email: input.email || null, phone: input.phone || null, city: input.city || null, address: input.address || null, postal_code: input.postal_code || null, nip: input.nip || null, contact_person: input.contact_person || null })
    const { data, error } = await supabase.from('clients').insert(payload).select('*').single()
    if (error) throw error
    return { id: data.id, company_id: data.company_id ?? input.company_id, name: data.name, email: data.email ?? '', phone: data.phone ?? '', city: data.city ?? '', address: data.address ?? '', postal_code: data.postal_code ?? '', nip: data.nip ?? '', contact_person: data.contact_person ?? '', created_at: data.created_at }
  },
  async update(id: string, input: Partial<Client>, companyId?: string): Promise<Client | null> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.clients.update(id, input))
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('clients').update(input).eq('id', id).select('*').single(), scope)
    const { data, error } = await query
    if (error) throw error
    return { id: data.id, company_id: data.company_id ?? companyId ?? '', name: data.name, email: data.email ?? '', phone: data.phone ?? '', city: data.city ?? '', address: data.address ?? '', postal_code: data.postal_code ?? '', nip: data.nip ?? '', contact_person: data.contact_person ?? '', created_at: data.created_at }
  },
  async delete(id: string, companyId?: string) {
    if (isDemoMode || !supabase) { demoDb.clients.delete(id); return Promise.resolve() }
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('clients').delete().eq('id', id), scope)
    const { error } = await query
    if (error) throw error
  },
}
