import { generateId } from '@/shared/lib/generateId'
import type { Client } from '@/entities/client/model'
import type { Estimate, EstimateItem } from '@/entities/estimate/model'
import type { Invoice, InvoiceItem } from '@/entities/invoice/model'
import type { Contract, ContractTranche } from '@/entities/contract/model'
import type { Project } from '@/entities/project/model'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { calcTotals } from '@/features/estimates/lib/estimate.calculations'
import { calcInvoiceTotals } from '@/features/invoices/lib/invoice.calculations'

export type DemoRole = 'owner' | 'admin' | 'manager' | 'worker' | 'accountant'

export interface DemoUser {
  id: string
  email: string
  password: string
  full_name: string
  company_id: string
  company_name: string
  role: DemoRole
  plan: keyof typeof PLAN_DEFS
  nip?: string
  address?: string
  city?: string
  postal_code?: string
  phone?: string
  iban?: string
  ksef_env: 'demo' | 'test' | 'prod'
  ksef_nip: string | null
  ksef_token: string | null
}

export interface PortalThreadMessage {
  id: string
  token_id: string
  sender: 'client' | 'company'
  content: string
  read: boolean
  created_at: string
}

export interface ClientTokenRecord {
  id: string
  token: string
  company_id: string
  user_id: string
  cost_estimate_id: string
  client_name: string
  active: boolean
  expires_at: string
  created_at: string
}

export interface DemoInvitation {
  id: string
  company_id: string
  email: string
  role: DemoRole
  token: string
  invited_by: string | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  created_at: string
}

interface DemoState {
  users: DemoUser[]
  clients: Client[]
  estimates: Estimate[]
  invoices: Invoice[]
  contracts: Contract[]
  projects: Project[]
  portalTokens: ClientTokenRecord[]
  portalMessages: PortalThreadMessage[]
  invitations: DemoInvitation[]
}

const STORAGE_KEY = 'loftdesk-v4-demo-db'
const now = () => new Date().toISOString()
const dateOnly = () => new Date().toISOString().slice(0, 10)
const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

const seedUsers: DemoUser[] = [
  { id: 'd1', email: 'adam@budowlanka.pl', password: 'demo123', full_name: 'Adam Wiśniewski', company_id: 'cmp-wisniewski', company_name: 'Wiśniewski Budowlanka', role: 'owner', plan: 'pro', nip: '7820012345', address: 'ul. Budowlana 15, 60-800 Poznań', city: 'Poznań', postal_code: '60-800', iban: 'PL61109010140000071219812874', ksef_env: 'demo', ksef_nip: '7820012345', ksef_token: 'TEST_TOKEN_2025' },
  { id: 'd1a', email: 'koordynator@budowlanka.pl', password: 'demo123', full_name: 'Katarzyna Koordynator', company_id: 'cmp-wisniewski', company_name: 'Wiśniewski Budowlanka', role: 'manager', plan: 'pro', nip: '7820012345', address: 'ul. Budowlana 15, 60-800 Poznań', city: 'Poznań', postal_code: '60-800', iban: 'PL61109010140000071219812874', ksef_env: 'demo', ksef_nip: '7820012345', ksef_token: 'TEST_TOKEN_2025' },
  { id: 'd2', email: 'marta@marex.pl', password: 'demo456', full_name: 'Marta Zielińska', company_id: 'cmp-marex', company_name: 'MAREX Wykończenia', role: 'owner', plan: 'free', nip: '5260001521', address: 'ul. Rzemieślnicza 8, 00-100 Warszawa', city: 'Warszawa', postal_code: '00-100', ksef_env: 'demo', ksef_nip: '5260001521', ksef_token: null },
  { id: 'd3', email: 'biuro@loftdesk.pl', password: 'admin123', full_name: 'LoftDesk Admin', company_id: 'cmp-loftdesk-admin', company_name: 'LoftDesk Admin', role: 'admin', plan: 'admin', ksef_env: 'demo', ksef_nip: null, ksef_token: null },
]

const seedState: DemoState = {
  users: seedUsers,
  clients: [
    { id: 'c1', company_id: 'cmp-wisniewski', name: 'Budrem Sp. z o.o.', email: 'biuro@budrem.pl', phone: '601234567', city: 'Poznań', address: 'ul. Leśna 12', postal_code: '60-001', nip: '7821001122', contact_person: 'Marek Nowak', created_at: now() },
    { id: 'c2', company_id: 'cmp-wisniewski', name: 'Jan Kowalski', email: 'j.kowalski@gmail.com', phone: '502987654', city: 'Warszawa', address: 'ul. Słoneczna 5', postal_code: '02-200', nip: '', contact_person: 'Jan Kowalski', created_at: now() },
    { id: 'cm1', company_id: 'cmp-marex', name: 'Novum Invest', email: 'biuro@novum.pl', phone: '123456789', city: 'Kraków', address: 'ul. Przemysłowa 1', postal_code: '30-100', nip: '6772003344', contact_person: 'Anna Urban', created_at: now() },
  ],
  projects: [
    { id: 'p1', company_id: 'cmp-wisniewski', client_id: 'c1', number: 'PRJ/2026/001', name: 'Wykończenie Budrem', status: 'active', start_date: dateOnly(), end_date: null, address: 'Poznań, ul. Nowa 8', notes: 'Klucze u pana Marka.', created_at: now() },
    { id: 'p2', company_id: 'cmp-wisniewski', client_id: 'c2', number: 'PRJ/2026/002', name: 'Remont łazienki – Kowalski', status: 'done', start_date: dateOnly(), end_date: null, address: 'Warszawa, ul. Słoneczna 5', notes: 'Oferta wygrana, projekt gotowy do fakturowania.', created_at: now() },
  ],
  estimates: [
    { id: 'ke1', company_id: 'cmp-wisniewski', client_id: 'c2', number: 'KE/2026/001', name: 'Remont łazienki – Kowalski', status: 'accepted', total_net: 3830, total_gross: 4710.9, notes: 'Termin realizacji 2 tygodnie', valid_until: plusDays(14), created_at: now(), items: [
      { id: 'i1', name: 'Układanie płytek 60x60', description: 'Łazienka', unit: 'm²', quantity: 12, unit_price: 180, vat_rate: 23, sort_order: 1 },
      { id: 'i2', name: 'Montaż kabiny prysznicowej', description: '', unit: 'szt', quantity: 1, unit_price: 1200, vat_rate: 23, sort_order: 2 },
      { id: 'i3', name: 'Materiały', description: 'klej, fuga', unit: 'kpl', quantity: 1, unit_price: 650, vat_rate: 23, sort_order: 3 },
    ] },
    { id: 'ke2', company_id: 'cmp-wisniewski', client_id: 'c1', number: 'KE/2026/002', name: 'Wykończenie mieszkania – Budrem', status: 'draft', total_net: 12825, total_gross: 15774.75, notes: 'Projekt powiązany z realizacją', valid_until: plusDays(10), created_at: now(), items: [
      { id: 'i4', name: 'Tynkowanie ścian', description: '', unit: 'm²', quantity: 120, unit_price: 35, vat_rate: 23, sort_order: 1 },
      { id: 'i5', name: 'Wylewka podłogowa', description: '', unit: 'm²', quantity: 85, unit_price: 55, vat_rate: 23, sort_order: 2 },
    ] },
  ],
  invoices: [
    { id: 'f1', company_id: 'cmp-wisniewski', client_id: 'c1', project_id: 'p1', contract_id: 'u1', number: 'FV/2026/001', invoice_type: 'standard', status: 'paid', issue_date: dateOnly(), sale_date: dateOnly(), due_date: dateOnly(), payment_method: 'transfer', bank_account: 'PL61109010140000071219812874', total_net: 9800, total_gross: 12054, ksef_status: 'ksef_sent', ksef_ref: 'PL2026KSF0000123', notes: 'Etap I', created_at: now(), items: [{ id: 'ii1', description: 'Roboty wykończeniowe – etap I', unit: 'kpl', quantity: 1, unit_price: 9800, vat_rate: 23, sort_order: 1, tranche_label: 'Etap I' }] },
    { id: 'f2', company_id: 'cmp-wisniewski', client_id: 'c2', project_id: null, contract_id: null, number: 'FV/2026/002', invoice_type: 'standard', status: 'unpaid', issue_date: dateOnly(), sale_date: dateOnly(), due_date: plusDays(14).slice(0,10), payment_method: 'transfer', bank_account: 'PL61109010140000071219812874', total_net: 4500, total_gross: 4860, ksef_status: 'ksef_pending', ksef_ref: null, notes: 'Malowanie klatki schodowej', created_at: now(), items: [{ id: 'ii2', description: 'Malowanie ścian klatki schodowej', unit: 'm²', quantity: 180, unit_price: 25, vat_rate: 8, sort_order: 1, tranche_label: '' }] },
    { id: 'f3', company_id: 'cmp-wisniewski', client_id: 'c1', project_id: 'p1', contract_id: 'u1', number: 'FV/2026/003', invoice_type: 'standard', status: 'unpaid', issue_date: dateOnly(), sale_date: dateOnly(), due_date: plusDays(14).slice(0,10), payment_method: 'transfer', bank_account: 'PL61109010140000071219812874', total_net: 6500, total_gross: 7995, ksef_status: 'ksef_pending', ksef_ref: null, notes: 'Etap II – instalacja elektryczna', created_at: now(), items: [{ id: 'ii3', description: 'Instalacja elektryczna – etap II', unit: 'kpl', quantity: 1, unit_price: 6500, vat_rate: 23, sort_order: 1, tranche_label: 'Etap II' }] },
  ],
  contracts: [
    { id: 'u1', company_id: 'cmp-wisniewski', client_id: 'c1', project_id: 'p1', number: 'UMW/2026/001', status: 'signed', sign_date: dateOnly(), value: 28000, value_net: 22764, vat_rate: 23, start_date: null, end_date: null, location: '', notes: '3 transze płatności', template_name: 'Szablon podstawowy', template_content: '', custom_paragraphs: [], created_at: now(), tranches: [
      { id: 'tr1', label: 'Zaliczka', amount: 8000, due_date: dateOnly(), status: 'paid' },
      { id: 'tr2', label: 'Etap I', amount: 10000, due_date: plusDays(14).slice(0,10), status: 'invoiced' },
      { id: 'tr3', label: 'Końcowa', amount: 10000, due_date: plusDays(30).slice(0,10), status: 'planned' },
    ] },
  ],
  portalTokens: [
    { id: 'tok1', token: 'demo-token', company_id: 'cmp-wisniewski', user_id: 'd1', cost_estimate_id: 'ke1', client_name: 'Jan Kowalski', active: true, expires_at: plusDays(7), created_at: now() },
  ],
  portalMessages: [
    { id: 'pm1', token_id: 'tok1', sender: 'company', content: 'Dzień dobry, przesyłamy kosztorys do akceptacji.', read: true, created_at: now() },
    { id: 'pm2', token_id: 'tok1', sender: 'client', content: 'Dziękuję, proszę o doprecyzowanie malowania.', read: false, created_at: now() },
  ],
  invitations: [
    { id: 'inv1', company_id: 'cmp-wisniewski', email: 'ekipa@budowlanka.pl', role: 'worker', token: 'invite-demo-worker', invited_by: 'd1', status: 'pending', expires_at: plusDays(5), created_at: now() },
  ],
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function isBrowser() { return typeof window !== 'undefined' }
function nextNumber(prefix: string, itemsLength: number) { return `${prefix}/${new Date().getFullYear()}/${String(itemsLength + 1).padStart(3, '0')}` }
function titleize(value: string) { return value.split('-').filter(Boolean).map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1)).join(' ') }
function calcEstimate(items: EstimateItem[]) { return calcTotals(items) }
function normalizeEstimateItems(items: any[] = []) { return items.map((item, index) => ({ id: item.id || generateId(), name: item.name || item.description || 'Pozycja', description: item.description || '', unit: item.unit || 'kpl', quantity: Number(item.quantity || 1), unit_price: Number(item.unit_price || 0), vat_rate: Number(item.vat_rate ?? 23), sort_order: Number(item.sort_order ?? index + 1) })) }
function normalizeInvoiceItems(items: any[] = []) { return items.map((item, index) => ({ id: item.id || generateId(), description: item.description || item.name || 'Pozycja', unit: item.unit || 'kpl', quantity: Number(item.quantity || 1), unit_price: Number(item.unit_price || 0), vat_rate: Number(item.vat_rate ?? 23), sort_order: Number(item.sort_order ?? index + 1), tranche_label: item.tranche_label || '' })) }
function normalizeTranches(items: any[] = []) { return items.map((item, index) => ({ id: item.id || generateId(), label: item.label || `Transza ${index + 1}`, amount: Number(item.amount || 0), due_date: item.due_date || null, status: item.status || 'planned' })) }
function normalizeState(state: DemoState): DemoState {
  return {
    ...state,
    clients: (state.clients ?? []).map((item) => ({ ...item, address: item.address || '', postal_code: item.postal_code || '', nip: item.nip || '', contact_person: item.contact_person || '', city: item.city || '' })),
    estimates: (state.estimates ?? []).map((item) => { const items = normalizeEstimateItems(item.items); const totals = calcEstimate(items); return { ...item, items, total_net: Number(item.total_net ?? totals.net), total_gross: Number(item.total_gross ?? totals.gross) } }),
    invoices: (state.invoices ?? []).map((item) => { const items = normalizeInvoiceItems(item.items); const totals = calcInvoiceTotals(items as InvoiceItem[]); return { ...item, contract_id: item.contract_id ?? null, invoice_type: item.invoice_type ?? 'standard', sale_date: item.sale_date ?? item.issue_date ?? null, payment_method: item.payment_method ?? 'transfer', bank_account: item.bank_account ?? null, items, total_net: Number(item.total_net ?? totals.totalNet), total_gross: Number(item.total_gross ?? totals.totalGross) } }),
    contracts: (state.contracts ?? []).map((item) => ({ ...item, template_name: item.template_name || 'Szablon własny', template_content: item.template_content || '', tranches: normalizeTranches(item.tranches) })),
    projects: (state.projects ?? []),
    portalTokens: state.portalTokens ?? [],
    portalMessages: state.portalMessages ?? [],
    invitations: state.invitations ?? [],
    users: state.users ?? [],
  }
}

function read(): DemoState {
  if (!isBrowser()) return normalizeState(clone(seedState))
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const state = normalizeState(clone(seedState))
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return state
  }
  try {
    const parsed = normalizeState(JSON.parse(raw) as DemoState)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    return parsed
  } catch {
    const state = normalizeState(clone(seedState))
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return state
  }
}
function writeState(state: DemoState) { if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))) }

export const demoDb = {
  reset() { writeState(clone(seedState)) },
  exportState() { return JSON.stringify(read(), null, 2) },
  importState(raw: string) { writeState(JSON.parse(raw) as DemoState); return true },
  users: {
    list() { return read().users },
    byEmail(email: string) { return read().users.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null },
    createCompanyOwner(input: string | { email?: string; companyName?: string; fullName?: string; password?: string; nip?: string }) {
      const state = read(); const raw = typeof input === 'string' ? { email: input } : (input ?? {}); const safe = (raw.email || '').trim().toLowerCase() || `owner-${Math.random().toString(36).slice(2)}@loftdesk.pl`; const companySlugBase = (raw.companyName || safe.split('@')[0] || 'nowa-firma').toLowerCase(); const companySlug = companySlugBase.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nowa-firma'; const companyName = (raw.companyName || titleize(companySlug)).trim() || 'Nowa Firma'; const fullName = (raw.fullName || titleize(safe.split('@')[0] || 'właściciel')).trim() || 'Nowy Właściciel';
      const uniqueSuffix = generateId().split('-')[0]
      const record: DemoUser = { id: generateId(), email: safe, password: raw.password || 'password123', full_name: fullName, company_id: `cmp-${companySlug}-${uniqueSuffix}`, company_name: companyName, role: 'owner', plan: 'free', ksef_env: 'test', ksef_nip: raw.nip || null, ksef_token: null }
      state.users.push(record); writeState(state); return record
    },
  },
  members: { list(companyId: string) { return read().users.filter((item) => item.company_id === companyId) }, invite(companyId: string, email: string, role: DemoRole) { return demoDb.invitations.invite(companyId, null, email, role) } },
  dashboard(companyId: string) {
    const state = read(); const user = state.users.find((item) => item.company_id === companyId); const projects = state.projects.filter((item) => item.company_id === companyId); const estimates = state.estimates.filter((item) => item.company_id === companyId); const invoices = state.invoices.filter((item) => item.company_id === companyId); const contracts = state.contracts.filter((item) => item.company_id === companyId); const clients = state.clients.filter((item) => item.company_id === companyId)
    return { plan: user?.plan ?? 'free', companyName: user?.company_name ?? 'LoftDesk Demo', clientsCount: clients.length, projectsCount: projects.length, estimatesCount: estimates.length, invoicesCount: invoices.length, activeProjects: projects.filter((item) => item.status === 'active').length, paidRevenue: invoices.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.total_gross, 0), pipeline: estimates.reduce((sum, item) => sum + item.total_gross, 0), overdueCount: invoices.filter((item) => item.status === 'overdue').length, recentActivity: ['Wysłano kosztorys do klienta.', 'Dodano projekt realizacyjny.', 'Zaktualizowano umowę i status płatności.'], upcoming: projects.slice(0, 3).map((item) => `${item.name} · ${item.status}`), contractsCount: contracts.length, ksefReady: Boolean(user?.ksef_token) }
  },
  companyProfile(companyId: string) { return read().users.find((item) => item.company_id === companyId) ?? null },
  companyProfileUpdate(companyId: string, input: Partial<Pick<DemoUser, 'company_name' | 'nip' | 'address' | 'city' | 'postal_code' | 'phone' | 'iban' | 'ksef_env' | 'ksef_nip' | 'ksef_token'>>) { const state = read(); state.users = state.users.map((item) => item.company_id === companyId ? { ...item, ...input } : item); writeState(state); return state.users.find((item) => item.company_id === companyId) ?? null },
  companyPlanUpdate(companyId: string, plan: DemoUser['plan']) { const state = read(); state.users = state.users.map((item) => item.company_id === companyId ? { ...item, plan } : item); writeState(state); return state.users.find((item) => item.company_id === companyId) ?? null },
  companies() { const state = read(); return Array.from(new Set(state.users.map((item) => item.company_id))).map((companyId) => { const owner = state.users.find((item) => item.company_id === companyId); return { company_id: companyId, company_name: owner?.company_name ?? companyId, plan: owner?.plan ?? 'free', members: state.users.filter((item) => item.company_id === companyId).length, clients: state.clients.filter((item) => item.company_id === companyId).length, projects: state.projects.filter((item) => item.company_id === companyId).length, estimates: state.estimates.filter((item) => item.company_id === companyId).length, invoices: state.invoices.filter((item) => item.company_id === companyId).length, pending_invitations: state.invitations.filter((item) => item.company_id === companyId && item.status === 'pending').length, portal_links: state.portalTokens.filter((item) => item.company_id === companyId && item.active).length, ksefReady: Boolean(owner?.ksef_token) } }) },
  onboardingSummary(companyId: string) {
    const state = read()
    const user = state.users.find((u) => u.company_id === companyId)
    if (!user) return null
    const clients = state.clients.filter((c) => c.company_id === companyId)
    const estimates = state.estimates.filter((e) => e.company_id === companyId)
    const invoices = state.invoices.filter((i) => i.company_id === companyId)
    const projects = state.projects.filter((p) => p.company_id === companyId)
    const contracts = state.contracts.filter((c) => c.company_id === companyId)
    const team = state.users.filter((u) => u.company_id === companyId)
    const checks = {
      companyProfile: Boolean(user.company_name),
      nip: Boolean(user.ksef_nip),
      team: team.length > 1,
      firstClient: clients.length > 0,
      firstEstimate: estimates.length > 0,
      firstInvoice: invoices.length > 0,
      projects: projects.length > 0,
      contracts: contracts.length > 0,
      portal: state.portalTokens.some((t) => t.company_id === companyId && t.active),
      ksef: Boolean(user.ksef_token),
    }
    const total = Object.keys(checks).length
    const done = Object.values(checks).filter(Boolean).length
    return { companyName: user.company_name, plan: user.plan as 'free' | 'pro' | 'business' | 'admin', role: user.role, progress: Math.round((done / total) * 100), done, total, checks, counts: { team: team.length, clients: clients.length, estimates: estimates.length, invoices: invoices.length, projects: projects.length, contracts: contracts.length } }
  },
  clients: {
    list(companyId: string) { return read().clients.filter((item) => item.company_id === companyId) },
    get(id: string) { return read().clients.find((item) => item.id === id) ?? null },
    create(input: Omit<Client, 'id' | 'created_at'>) { const state = read(); const record: Client = { ...input, id: generateId(), created_at: now() }; state.clients.unshift(record); writeState(state); return record },
    update(id: string, input: Partial<Client>) { const state = read(); state.clients = state.clients.map((item) => item.id === id ? { ...item, ...input } : item); writeState(state); return state.clients.find((item) => item.id === id) ?? null },
    delete(id: string) { const state = read(); state.clients = state.clients.filter((item) => item.id !== id); writeState(state) },
  },
  estimates: {
    list(companyId: string) { return read().estimates.filter((item) => item.company_id === companyId) },
    get(id: string) { return read().estimates.find((item) => item.id === id) ?? null },
    create(input: Omit<Estimate, 'id' | 'number' | 'created_at' | 'total_net' | 'total_gross'> & { total_net?: number; total_gross?: number }) { const state = read(); const items = normalizeEstimateItems(input.items); const totals = calcEstimate(items); const record: Estimate = { ...input, items, total_net: totals.net, total_gross: totals.gross, id: generateId(), number: nextNumber('KE', state.estimates.filter((x) => x.company_id === input.company_id).length), created_at: now() } as Estimate; state.estimates.unshift(record); writeState(state); return record },
    update(id: string, input: Partial<Estimate>) { const state = read(); state.estimates = state.estimates.map((item) => { if (item.id !== id) return item; const items = normalizeEstimateItems(input.items ?? item.items); const totals = calcEstimate(items); return { ...item, ...input, items, total_net: totals.net, total_gross: totals.gross } }); writeState(state); return state.estimates.find((item) => item.id === id) ?? null },
    delete(id: string) { const state = read(); state.estimates = state.estimates.filter((item) => item.id !== id); writeState(state) },
    createPortalToken(estimateId: string, userId: string, companyId: string, clientName: string) { const state = read(); const token = Math.random().toString(36).slice(2, 12); const record: ClientTokenRecord = { id: generateId(), token, company_id: companyId, user_id: userId, cost_estimate_id: estimateId, client_name: clientName, active: true, expires_at: plusDays(7), created_at: now() }; state.portalTokens.unshift(record); writeState(state); return record },
  },
  invoices: {
    list(companyId: string) { return read().invoices.filter((item) => item.company_id === companyId) },
    get(id: string) { return read().invoices.find((item) => item.id === id) ?? null },
    create(input: Omit<Invoice, 'id' | 'number' | 'created_at' | 'total_net' | 'total_gross'> & { total_net?: number; total_gross?: number }) { const state = read(); const items = normalizeInvoiceItems(input.items); const totals = calcInvoiceTotals(items as InvoiceItem[]); const record: Invoice = { ...input, items, total_net: totals.totalNet, total_gross: totals.totalGross, id: generateId(), number: nextNumber('FV', state.invoices.filter((x) => x.company_id === input.company_id).length), created_at: now() } as Invoice; state.invoices.unshift(record); writeState(state); return record },
    update(id: string, input: Partial<Invoice>) { const state = read(); state.invoices = state.invoices.map((item) => { if (item.id !== id) return item; const items = normalizeInvoiceItems(input.items ?? item.items); const totals = calcInvoiceTotals(items as InvoiceItem[]); return { ...item, ...input, items, total_net: totals.totalNet, total_gross: totals.totalGross } }); writeState(state); return state.invoices.find((item) => item.id === id) ?? null },
    delete(id: string) { const state = read(); state.invoices = state.invoices.filter((item) => item.id !== id); writeState(state) },
    markPaid(id: string) { const state = read(); state.invoices = state.invoices.map((item) => item.id === id ? { ...item, status: 'paid', ksef_status: item.ksef_status ?? 'ksef_pending' } : item); writeState(state) },
    sendToKsef(id: string) { const state = read(); state.invoices = state.invoices.map((item) => item.id === id ? { ...item, ksef_status: 'ksef_pending', ksef_ref: null } : item); writeState(state) },
    createFromEstimate(companyId: string, estimateId: string) { const state = read(); const estimate = state.estimates.find((item) => item.id === estimateId && item.company_id === companyId); if (!estimate) throw new Error('Estimate not found'); return demoDb.invoices.create({ company_id: companyId, client_id: estimate.client_id, project_id: null, contract_id: null, invoice_type: 'standard', status: 'unpaid', issue_date: dateOnly(), sale_date: dateOnly(), due_date: plusDays(7).slice(0,10), payment_method: 'transfer', bank_account: null, ksef_status: 'ksef_pending', ksef_ref: null, notes: `Wygenerowano z kosztorysu ${estimate.number}`, items: estimate.items.map((item, index) => ({ id: generateId(), description: item.name + (item.description ? ` — ${item.description}` : ''), unit: item.unit, quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate, sort_order: index + 1, tranche_label: '' })) }) },
    createFromProject(companyId: string, config: { projectId: string; vatRate?: number; tranches?: Array<{ id: string; label: string; amount: number; due_date: string }> }) { const { projectId, vatRate = 23, tranches = [] } = config; const state = read(); const project = state.projects.find((item) => item.id === projectId && item.company_id === companyId); if (!project) throw new Error('Project not found'); const items = tranches.length > 0 ? tranches.map((tr, idx) => ({ id: generateId(), description: tr.label || `Transza ${idx + 1}`, unit: 'kpl', quantity: 1, unit_price: tr.amount, vat_rate: vatRate, sort_order: idx + 1, tranche_label: tr.label || `Transza ${idx + 1}` })) : [{ id: generateId(), description: `Rozliczenie projektu ${project.name}`, unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: vatRate, sort_order: 1, tranche_label: '' }]; return demoDb.invoices.create({ company_id: companyId, client_id: project.client_id, project_id: project.id, contract_id: null, invoice_type: 'standard', status: 'unpaid', issue_date: dateOnly(), sale_date: dateOnly(), due_date: plusDays(7).slice(0,10), payment_method: 'transfer', bank_account: null, ksef_status: 'ksef_pending', ksef_ref: null, notes: `Faktura z projektu ${project.number}`, items }) },
  },
  contracts: {
    list(companyId: string) { return read().contracts.filter((item) => item.company_id === companyId) },
    get(id: string) { return read().contracts.find((item) => item.id === id) ?? null },
    create(input: Omit<Contract, 'id' | 'number' | 'created_at'>) { const state = read(); const record: Contract = { ...input, id: generateId(), number: nextNumber('UMW', state.contracts.filter((x) => x.company_id === input.company_id).length), created_at: now(), tranches: normalizeTranches(input.tranches) }; state.contracts.unshift(record); writeState(state); return record },
    update(id: string, input: Partial<Contract>) { const state = read(); state.contracts = state.contracts.map((item) => item.id === id ? { ...item, ...input, tranches: normalizeTranches(input.tranches ?? item.tranches) } : item); writeState(state); return state.contracts.find((item) => item.id === id) ?? null },
    createFromEstimate(companyId: string, estimateId: string) { const state = read(); const estimate = state.estimates.find((item) => item.id === estimateId && item.company_id === companyId); if (!estimate) throw new Error('Estimate not found'); return demoDb.contracts.create({ company_id: companyId, client_id: estimate.client_id, project_id: null, estimate_id: estimateId, status: 'unsigned', sign_date: null, value: estimate.total_gross, value_net: estimate.total_net, vat_rate: estimate.items[0]?.vat_rate ?? 23, start_date: null, end_date: null, location: '', notes: `Wygenerowano z kosztorysu ${estimate.number}`, template_name: `Umowa · ${estimate.number}`, template_content: '', custom_paragraphs: [], tranches: [{ id: generateId(), label: 'Zaliczka', amount: Math.round(estimate.total_gross * 0.3 * 100) / 100, percent: 30, due_date: plusDays(3).slice(0,10), status: 'planned', condition: 'Przed rozpoczęciem robót' }, { id: generateId(), label: 'Płatność końcowa', amount: Math.round(estimate.total_gross * 0.7 * 100) / 100, percent: 70, due_date: plusDays(30).slice(0,10), status: 'planned', condition: 'Po odbiorze końcowym' }] }) },
    sign(id: string) { const state = read(); state.contracts = state.contracts.map((item) => item.id === id ? { ...item, status: 'signed', sign_date: item.sign_date ?? dateOnly() } : item); writeState(state) },
    delete(id: string) { const state = read(); state.contracts = state.contracts.filter((item) => item.id !== id); writeState(state) },
  },
  projects: {
    list(companyId: string) { return read().projects.filter((item) => item.company_id === companyId) },
    get(id: string) { return read().projects.find((item) => item.id === id) ?? null },
    create(input: Omit<Project, 'id' | 'number' | 'created_at'>) { const state = read(); const record: Project = { ...input, id: generateId(), number: nextNumber('PRJ', state.projects.filter((x) => x.company_id === input.company_id).length), created_at: now() }; state.projects.unshift(record); writeState(state); return record },
    update(id: string, input: Partial<Project>) { const state = read(); state.projects = state.projects.map((item) => item.id === id ? { ...item, ...input } : item); writeState(state); return state.projects.find((item) => item.id === id) ?? null },
    updateStatus(id: string, status: Project['status']) { return demoDb.projects.update(id, { status }) },
    createFromEstimate(companyId: string, estimateId: string) { const state = read(); const estimate = state.estimates.find((item) => item.id === estimateId && item.company_id === companyId); if (!estimate) throw new Error('Estimate not found'); return demoDb.projects.create({ company_id: companyId, client_id: estimate.client_id, name: estimate.name, status: 'offer', start_date: null, end_date: null, address: '', notes: `Projekt utworzony z kosztorysu ${estimate.number}` }) },
    delete(id: string) { const state = read(); state.projects = state.projects.filter((item) => item.id !== id); writeState(state) },
  },
  invitations: {
    list(companyId: string) { return read().invitations.filter((item) => item.company_id === companyId) },
    pendingByEmail(email: string) { const safe = email.trim().toLowerCase(); return read().invitations.filter((item) => item.email.toLowerCase() === safe && item.status === 'pending') },
    invite(companyId: string, invitedBy: string | null, email: string, role: DemoRole) { const state = read(); const existing = state.invitations.find((item) => item.company_id === companyId && item.email.toLowerCase() === email.trim().toLowerCase() && item.status === 'pending'); if (existing) return existing; const record = { id: generateId(), company_id: companyId, email: email.trim().toLowerCase(), role, token: `invite-${Math.random().toString(36).slice(2, 12)}`, invited_by: invitedBy, status: 'pending' as const, expires_at: plusDays(7), created_at: now() }; state.invitations.unshift(record); writeState(state); return record },
    revoke(id: string) { const state = read(); state.invitations = state.invitations.map((item) => item.id === id ? { ...item, status: 'revoked' as const } : item); writeState(state) },
    accept(token: string, userEmail?: string) { const state = read(); const invite = state.invitations.find((item) => item.token === token && item.status === 'pending'); if (!invite) return null; const owner = state.users.find((item) => item.company_id === invite.company_id) ?? state.users[0]; const safeEmail = (userEmail || invite.email).trim().toLowerCase(); let user = state.users.find((item) => item.email.toLowerCase() === safeEmail); if (!user) { user = { id: generateId(), email: safeEmail, password: 'password123', full_name: titleize(safeEmail.split('@')[0] || 'pracownik'), company_id: invite.company_id, company_name: owner.company_name, role: invite.role, plan: owner.plan, ksef_env: owner.ksef_env, ksef_nip: owner.ksef_nip, ksef_token: owner.ksef_token }; state.users.push(user) } else { user.company_id = invite.company_id; user.company_name = owner.company_name; user.role = invite.role; user.plan = owner.plan } state.invitations = state.invitations.map((item) => item.id === invite.id ? { ...item, status: 'accepted' as const } : item); writeState(state); return user },
  },
  portal: {
    listForCompany(companyId: string) { const state = read(); return state.portalTokens.filter((item) => item.company_id === companyId).map((item) => ({ ...item, estimate_number: state.estimates.find((estimate) => estimate.id === item.cost_estimate_id)?.number ?? '—', estimate_name: state.estimates.find((estimate) => estimate.id === item.cost_estimate_id)?.name ?? 'Kosztorys', url: `/portal/${item.token}` })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) },
    deactivateToken(id: string) { const state = read(); state.portalTokens = state.portalTokens.map((item) => item.id === id ? { ...item, active: false } : item); writeState(state); return true },
    get(token: string) { const state = read(); const tokenRow = state.portalTokens.find((item) => item.token === token && item.active); if (!tokenRow) return null; const estimate = state.estimates.find((item) => item.id === tokenRow.cost_estimate_id); const contractor = state.users.find((item) => item.id === tokenRow.user_id); const messages = state.portalMessages.filter((item) => item.token_id === tokenRow.id); if (!estimate) return null; const expired = new Date(tokenRow.expires_at).getTime() < Date.now(); return { token: { id: tokenRow.id, client_name: tokenRow.client_name, expires_at: tokenRow.expires_at, expired, active: tokenRow.active }, estimate, contractor: contractor ? { company: contractor.company_name, full_name: contractor.full_name, email: contractor.email, phone: '', logo_base64: null } : null, messages } },
    renameClient(token: string, clientName: string) { const state = read(); const tokenRow = state.portalTokens.find((item) => item.token === token && item.active); if (!tokenRow) throw new Error('Token not found'); tokenRow.client_name = clientName.trim() || tokenRow.client_name; writeState(state); return tokenRow },
    sendMessage(token: string, content: string) { const state = read(); const tokenRow = state.portalTokens.find((item) => item.token === token && item.active); if (!tokenRow) throw new Error('Token not found'); const record: PortalThreadMessage = { id: generateId(), token_id: tokenRow.id, sender: 'client', content, read: false, created_at: now() }; state.portalMessages.push(record); writeState(state); return record },
    decide(token: string, decision: 'accepted' | 'rejected') { const state = read(); const tokenRow = state.portalTokens.find((item) => item.token === token && item.active); if (!tokenRow) throw new Error('Token not found'); state.estimates = state.estimates.map((item) => item.id === tokenRow.cost_estimate_id ? { ...item, status: decision } : item); state.portalMessages.push({ id: generateId(), token_id: tokenRow.id, sender: 'client', content: decision === 'accepted' ? 'Klient zaakceptował kosztorys w portalu.' : 'Klient odrzucił kosztorys w portalu.', read: false, created_at: now() }); writeState(state); return state.estimates.find((item) => item.id === tokenRow.cost_estimate_id) ?? null },
  },
}
