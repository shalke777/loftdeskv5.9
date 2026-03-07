import type { ClientDecision, DocumentationOverview, HandoverChecklistItem, HandoverProtocol, PhotoDocumentation, TechnicalStandard } from '@/entities/documentation/model'

interface DocumentationState extends DocumentationOverview {}

const STORAGE_KEY = 'loftdesk-v5-documentation-store'
const now = () => new Date().toISOString()

const seedState: DocumentationState = {
  decisions: [
    {
      id: 'dec-1', company_id: 'cmp-wisniewski', project_id: 'p1', client_id: 'c1', related_estimate_id: 'ke2',
      title: 'Zmiana materiału na płytkę premium', description: 'Klient ma zdecydować, czy akceptuje dopłatę do płytki premium w strefie wejścia.',
      decision_type: 'material', status: 'pending_client', requested_at: now(), decided_at: null, client_comment: '',
    },
    {
      id: 'dec-2', company_id: 'cmp-wisniewski', project_id: 'p2', client_id: 'c2', related_estimate_id: 'ke1',
      title: 'Akceptacja przesunięcia terminu odbioru o 2 dni', description: 'Potwierdzenie przesunięcia końcowego odbioru ze względu na dostawę armatury.',
      decision_type: 'timeline', status: 'accepted', requested_at: now(), decided_at: now(), client_comment: 'Akceptuję przesunięcie.',
    },
  ],
  protocols: [
    {
      id: 'prot-1', company_id: 'cmp-wisniewski', project_id: 'p1', client_id: 'c1', title: 'Protokół odbioru etapu I', status: 'sent',
      protocol_date: new Date().toISOString().slice(0, 10), summary: 'Odbiór etapu przygotowawczego i zatwierdzenie prac tynkarskich.',
      notes: 'Klient ma potwierdzić brak uwag do jakości ścian.',
      checklist: [
        { id: 'chk-1', label: 'Ściany przygotowane do malowania', accepted: true },
        { id: 'chk-2', label: 'Brak uszkodzeń stolarki', accepted: true },
        { id: 'chk-3', label: 'Klient zaakceptował zakres etapu I', accepted: false },
      ],
    },
  ],
  photos: [
    {
      id: 'photo-1', company_id: 'cmp-wisniewski', project_id: 'p1', client_id: 'c1', title: 'Stan przed rozpoczęciem prac', category: 'before',
      taken_at: now(), image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', note: 'Zdjęcie wejściowe do dokumentacji projektu.',
    },
    {
      id: 'photo-2', company_id: 'cmp-wisniewski', project_id: 'p1', client_id: 'c1', title: 'Postęp prac - gładzie', category: 'progress',
      taken_at: now(), image_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80', note: 'Ściany po pierwszym szlifowaniu.',
    },
  ],
  standards: [
    {
      id: 'std-1', company_id: 'cmp-wisniewski', project_id: 'p1', client_id: 'c1', title: 'Standard odbioru łazienki inwestora', category: 'client_standard',
      source_label: 'Wytyczne klienta', content: 'Fugi równe, silikon transparentny, narożniki bez wyszczerbień, armatura wypoziomowana, protokół zdjęciowy po zakończeniu.',
      requires_client_acceptance: true, accepted_by_client: false,
    },
    {
      id: 'std-2', company_id: 'cmp-wisniewski', project_id: null, client_id: null, title: 'Regulamin dokumentacji fotograficznej', category: 'regulation',
      source_label: 'Wewnętrzny standard firmy', content: 'Każdy etap powinien mieć minimum 3 zdjęcia: przed, w trakcie i po zakończeniu. Zdjęcia powinny zawierać datę i opis.',
      requires_client_acceptance: false, accepted_by_client: false,
    },
  ],
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function isBrowser() { return typeof window !== 'undefined' }
function readState(): DocumentationState {
  if (!isBrowser()) return clone(seedState)
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState))
    return clone(seedState)
  }
  try {
    const parsed = JSON.parse(raw) as DocumentationState
    return { decisions: parsed.decisions ?? [], protocols: parsed.protocols ?? [], photos: parsed.photos ?? [], standards: parsed.standards ?? [] }
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState))
    return clone(seedState)
  }
}
function writeState(state: DocumentationState) { if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
function byCompany<T extends { company_id: string }>(items: T[], companyId: string) { return items.filter((item) => item.company_id === companyId) }
function normalizeChecklist(checklist: HandoverChecklistItem[] = []) { return checklist.map((item, index) => ({ id: item.id || crypto.randomUUID(), label: item.label || `Pozycja ${index + 1}`, accepted: Boolean(item.accepted) })) }

export const documentationStore = {
  getOverview(companyId: string): DocumentationOverview {
    const state = readState()
    return { decisions: byCompany(state.decisions, companyId), protocols: byCompany(state.protocols, companyId), photos: byCompany(state.photos, companyId), standards: byCompany(state.standards, companyId) }
  },
  decisions: {
    list(companyId: string) { return documentationStore.getOverview(companyId).decisions },
    listForClient(companyId: string, clientId?: string | null, projectId?: string | null) {
      return documentationStore.getOverview(companyId).decisions.filter((item) => (!clientId || item.client_id === clientId) && (!projectId || item.project_id === projectId))
    },
    create(input: Omit<ClientDecision, 'id' | 'requested_at' | 'decided_at'>) {
      const state = readState(); const record: ClientDecision = { ...input, id: crypto.randomUUID(), requested_at: now(), decided_at: null, client_comment: input.client_comment ?? '' }
      state.decisions.unshift(record); writeState(state); return record
    },
    update(id: string, input: Partial<ClientDecision>) {
      const state = readState(); state.decisions = state.decisions.map((item) => item.id === id ? { ...item, ...input } : item); writeState(state); return state.decisions.find((item) => item.id === id) ?? null
    },
    decide(id: string, status: ClientDecision['status'], comment?: string) { return documentationStore.decisions.update(id, { status, client_comment: comment ?? '', decided_at: now() }) },
    remove(id: string) { const state = readState(); state.decisions = state.decisions.filter((item) => item.id !== id); writeState(state) },
  },
  protocols: {
    list(companyId: string) { return documentationStore.getOverview(companyId).protocols },
    listForClient(companyId: string, clientId?: string | null, projectId?: string | null) {
      return documentationStore.getOverview(companyId).protocols.filter((item) => (!clientId || item.client_id === clientId) && (!projectId || item.project_id === projectId))
    },
    create(input: Omit<HandoverProtocol, 'id'>) {
      const state = readState(); const record: HandoverProtocol = { ...input, id: crypto.randomUUID(), checklist: normalizeChecklist(input.checklist) }
      state.protocols.unshift(record); writeState(state); return record
    },
    update(id: string, input: Partial<HandoverProtocol>) {
      const state = readState(); state.protocols = state.protocols.map((item) => item.id === id ? { ...item, ...input, checklist: normalizeChecklist(input.checklist ?? item.checklist) } : item); writeState(state); return state.protocols.find((item) => item.id === id) ?? null
    },
    decide(id: string, status: HandoverProtocol['status']) { return documentationStore.protocols.update(id, { status }) },
    remove(id: string) { const state = readState(); state.protocols = state.protocols.filter((item) => item.id !== id); writeState(state) },
  },
  photos: {
    list(companyId: string) { return documentationStore.getOverview(companyId).photos },
    create(input: Omit<PhotoDocumentation, 'id'>) {
      const state = readState(); const record: PhotoDocumentation = { ...input, id: crypto.randomUUID() }
      state.photos.unshift(record); writeState(state); return record
    },
    update(id: string, input: Partial<PhotoDocumentation>) {
      const state = readState(); state.photos = state.photos.map((item) => item.id === id ? { ...item, ...input } : item); writeState(state); return state.photos.find((item) => item.id === id) ?? null
    },
    remove(id: string) { const state = readState(); state.photos = state.photos.filter((item) => item.id !== id); writeState(state) },
  },
  standards: {
    list(companyId: string) { return documentationStore.getOverview(companyId).standards },
    listForClient(companyId: string, clientId?: string | null, projectId?: string | null) {
      return documentationStore.getOverview(companyId).standards.filter((item) => (!item.requires_client_acceptance || !item.accepted_by_client) && (!clientId || item.client_id === clientId || item.client_id == null) && (!projectId || item.project_id === projectId || item.project_id == null))
    },
    create(input: Omit<TechnicalStandard, 'id'>) {
      const state = readState(); const record: TechnicalStandard = { ...input, id: crypto.randomUUID() }
      state.standards.unshift(record); writeState(state); return record
    },
    update(id: string, input: Partial<TechnicalStandard>) {
      const state = readState(); state.standards = state.standards.map((item) => item.id === id ? { ...item, ...input } : item); writeState(state); return state.standards.find((item) => item.id === id) ?? null
    },
    accept(id: string) { return documentationStore.standards.update(id, { accepted_by_client: true }) },
    remove(id: string) { const state = readState(); state.standards = state.standards.filter((item) => item.id !== id); writeState(state) },
  },
}
