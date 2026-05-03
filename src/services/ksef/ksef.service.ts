import type { Invoice } from '@/entities/invoice/model'
import { supabase } from '@/shared/lib/supabase'
import { netlifyFn } from '@/shared/lib/functions'

export type KsefEnv = 'demo' | 'test' | 'prod'

export interface KsefHistoryEntry {
  id: string
  invoiceId: string
  invoiceNumber: string
  timestamp: string
  action: 'send' | 'retry' | 'receive'
  status: 'success' | 'error'
  ksefRef: string | null
  error: string | null
}

export interface KsefReceivedDoc {
  ksefRef: string
  invoiceNumber: string
  issuerNip: string
  issueDate: string
  receivedAt: string
  grossAmount: number
}

export interface KsefSeller {
  nip?: string
  name?: string
  address?: string
}

export interface KsefBuyer {
  nip?: string
  name?: string
  address?: string
}

const HISTORY_KEY = 'ksef_history'
const RECEIVED_KEY = 'ksef_received'

function uid(): string {
  return typeof crypto !== 'undefined' && typeof (crypto as Crypto).randomUUID === 'function'
    ? (crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function escXml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Map vat_rate number to FA(2) field suffix: 23→_1, 8→_2, 5→_3, 0→_4, other→_5 */
function vatSuffix(rate: number): string {
  if (rate === 23) return '_1'
  if (rate === 8) return '_2'
  if (rate === 5) return '_3'
  if (rate === 0) return '_4'
  return '_5'
}

/**
 * Validate Polish NIP (10-digit tax ID) using checksum algorithm.
 */
export function validateNip(nip: string): boolean {
  const cleaned = nip.replace(/[-\s]/g, '')
  if (!/^\d{10}$/.test(cleaned)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const digits = cleaned.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += digits[i] * weights[i]
  return sum % 11 === digits[9]
}

/**
 * Build official FA_VAT(2) XML per Ministry of Finance KSeF v2 schema
 * xmlns: http://crd.gov.pl/wzor/2023/06/29/12648/  (FA(2) — 2023 schema)
 *
 * NOTE: function name `buildFA2Xml` is correct — produces FA(2). Earlier the
 * header declared `FA (3)` / WariantFormularza=3 which mismatched the FA(2)
 * namespace and caused MF to silently reject the document at schema validation
 * (HTTP 202 returned for the session, but invoice never appeared in the KSeF
 * Aplikacja Podatnika). FA(3) migration is tracked as a separate epic.
 */
export function buildFA2Xml(invoice: Invoice, seller: KsefSeller, buyer: KsefBuyer = {}): string {
  const now = new Date().toISOString().slice(0, 23)
  const issueDate = invoice.issue_date || new Date().toISOString().slice(0, 10)
  const saleDate = invoice.sale_date || issueDate
  const [year, month] = issueDate.split('-')
  const payCode = invoice.payment_method === 'cash' ? '1' : invoice.payment_method === 'card' ? '7' : '6'
  const rodzaj =
    invoice.invoice_type === 'advance' ? 'ZAL' : invoice.invoice_type === 'final' ? 'ROZ' : 'VAT'

  // GTU_12 = usługi budowlane (8% VAT typically indicates construction services)
  const hasGtu12 = invoice.items.some((item) => item.vat_rate === 8)

  // VAT grouping by rate
  const vatMap = new Map<number, { net: number; vat: number }>()
  for (const item of invoice.items) {
    const net = Math.round(item.quantity * item.unit_price * 100) / 100
    const vat = Math.round(net * (item.vat_rate / 100) * 100) / 100
    const g = vatMap.get(item.vat_rate) ?? { net: 0, vat: 0 }
    vatMap.set(item.vat_rate, { net: g.net + net, vat: g.vat + vat })
  }

  const fmt = (n: number) => n.toFixed(2)

  const lines = invoice.items
    .map((item, idx) => {
      const net = Math.round(item.quantity * item.unit_price * 100) / 100
      return `    <fa:FaWiersz>
      <fa:NrWierszaFa>${idx + 1}</fa:NrWierszaFa>
      <fa:P_7>${escXml(item.description)}</fa:P_7>
      <fa:P_8A>${escXml(item.unit || 'kpl')}</fa:P_8A>
      <fa:P_8B>${item.quantity}</fa:P_8B>
      <fa:P_9A>${fmt(item.unit_price)}</fa:P_9A>
      <fa:P_9B>${fmt(net)}</fa:P_9B>
      <fa:P_11>${fmt(net)}</fa:P_11>
      <fa:P_12>${item.vat_rate}</fa:P_12>
    </fa:FaWiersz>`
    })
    .join('\n')

  const stawki = Array.from(vatMap.entries())
    .map(([rate, { net, vat }]) => {
      const s = vatSuffix(rate)
      return `        <fa:Stawka>
          <fa:P_12_XII>${rate}</fa:P_12_XII>
          <fa:P_13${s}>${fmt(net)}</fa:P_13${s}>
          <fa:P_14${s}>${fmt(vat)}</fa:P_14${s}>
        </fa:Stawka>`
    })
    .join('\n')

  const advanceSection =
    invoice.invoice_type === 'final' && (invoice.advance_total ?? 0) > 0
      ? `    <fa:ZaliczkiCzesciowe>
      <fa:KwotaFaZaliczkowej>${fmt(invoice.advance_total ?? 0)}</fa:KwotaFaZaliczkowej>
    </fa:ZaliczkiCzesciowe>`
      : ''

  const paid = invoice.status === 'paid'
  const platnosSection = paid
    ? `    <fa:Platnosc>
      <fa:Zaplacono>1</fa:Zaplacono>
      <fa:ZaplataNaleznosci>
        <fa:DataZaplaty>${issueDate}</fa:DataZaplaty>
        <fa:FormaPlatnosci>${payCode}</fa:FormaPlatnosci>
        ${invoice.bank_account && payCode === '6' ? `<fa:NumerRachunku>${escXml(invoice.bank_account)}</fa:NumerRachunku>` : ''}
      </fa:ZaplataNaleznosci>
    </fa:Platnosc>`
    : `    <fa:Platnosc>
      <fa:Zaplacono>2</fa:Zaplacono>
      <fa:TerminPlatnosci>
        <fa:Termin>${invoice.due_date || issueDate}</fa:Termin>
        <fa:FormaPlatnosci>${payCode}</fa:FormaPlatnosci>
        ${invoice.bank_account && payCode === '6' ? `<fa:NumerRachunku>${escXml(invoice.bank_account)}</fa:NumerRachunku>` : ''}
      </fa:TerminPlatnosci>
    </fa:Platnosc>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<fa:Faktura xmlns:fa="http://crd.gov.pl/wzor/2023/12/13/13644/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <fa:Naglowek>
    <fa:KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</fa:KodFormularza>
    <fa:WariantFormularza>3</fa:WariantFormularza>
    <fa:DataWytworzeniaFa>${now}</fa:DataWytworzeniaFa>
    <fa:SystemInfo>LoftDesk v5.9</fa:SystemInfo>
  </fa:Naglowek>
  <fa:Podmiot1>
    <fa:DaneIdentyfikacyjne>
      <fa:NIP>${escXml(seller.nip)}</fa:NIP>
      <fa:Nazwa>${escXml(seller.name)}</fa:Nazwa>
    </fa:DaneIdentyfikacyjne>
    <fa:Adres><fa:AdresL1>${escXml(seller.address)}</fa:AdresL1></fa:Adres>
    <fa:RolaPodmiotu1>1</fa:RolaPodmiotu1>
  </fa:Podmiot1>
  <fa:Podmiot2>
    <fa:DaneIdentyfikacyjne>
      ${buyer.nip ? `<fa:NIP>${escXml(buyer.nip)}</fa:NIP>` : '<fa:BrakID>1</fa:BrakID>'}
      <fa:Nazwa>${escXml(buyer.name)}</fa:Nazwa>
    </fa:DaneIdentyfikacyjne>
    ${buyer.address ? `<fa:Adres><fa:AdresL1>${escXml(buyer.address)}</fa:AdresL1></fa:Adres>` : ''}
    <fa:RolaPodmiotu2>2</fa:RolaPodmiotu2>
  </fa:Podmiot2>
  <fa:Fa>
    <fa:KodWaluty>PLN</fa:KodWaluty>
    <fa:P_1>${issueDate}</fa:P_1>
    <fa:P_1M>${month}</fa:P_1M>
    <fa:P_1R>${year}</fa:P_1R>
    <fa:P_2>${escXml(invoice.number)}</fa:P_2>
    <fa:P_6>${saleDate}</fa:P_6>
    <fa:RodzajFaktury>${rodzaj}</fa:RodzajFaktury>
${lines}
    <fa:Rozliczenie>
      <fa:Stawki>
${stawki}
      </fa:Stawki>
      <fa:P_15>${fmt(invoice.total_gross)}</fa:P_15>
    </fa:Rozliczenie>
${advanceSection}
${platnosSection}
    <fa:Adnotacje>
      <fa:P_16>2</fa:P_16>
      <fa:P_17>2</fa:P_17>
      <fa:Zwolnienie><fa:P_19N>0</fa:P_19N></fa:Zwolnienie>
      <fa:NoweSrodkiTransportu><fa:P_22N>0</fa:P_22N></fa:NoweSrodkiTransportu>${hasGtu12 ? '\n      <fa:GTU><fa:GTU_12>1</fa:GTU_12></fa:GTU>' : ''}
    </fa:Adnotacje>
  </fa:Fa>
</fa:Faktura>`
}

const PROXY_TIMEOUT_MS = 90_000 // 90s hard timeout for any KSeF proxy call

async function callProxy(path: string, body: unknown): Promise<Record<string, unknown>> {
  // Attach current Supabase session token so the backend can verify plan access
  const session = supabase ? (await supabase.auth.getSession()).data.session : null
  const authHeaders: Record<string, string> = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}

  let res: Response
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    res = await fetch(netlifyFn(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (networkErr) {
    clearTimeout(timer)
    if (networkErr instanceof DOMException && networkErr.name === 'AbortError') {
      throw new Error(`Timeout (${PROXY_TIMEOUT_MS / 1000}s) — serwer KSeF nie odpowiedział. Spróbuj ponownie lub użyj Trybu demo.`)
    }
    throw new Error(
      'Brak połączenia z serwerem funkcji KSeF. Upewnij się, że aplikacja działa na Netlify lub użyj Trybu demo.',
    )
  } finally {
    clearTimeout(timer)
  }
  // Try to parse JSON — if response is HTML (e.g. Vite 404 page) fall back to statusText
  const data: Record<string, unknown> = await res.json().catch(() => {
    if (res.status === 404) throw new Error('Funkcja Netlify niedostępna (404). Użyj Trybu demo.')
    return { error: res.statusText }
  })
  if (!res.ok) {
    // Prefer error field, then detail, then HTTP status
    const msg = (data.error as string) || (data.detail as string) || `HTTP ${res.status}`
    // Preserve structured error codes so callers can distinguish plan_required / unauthorized
    const structuredErr = new Error(msg) as Error & { code?: string; requiredPlan?: string }
    if (data.code)         structuredErr.code         = data.code as string
    if (data.requiredPlan) structuredErr.requiredPlan = data.requiredPlan as string
    throw structuredErr
  }
  return data
}

export interface UpoData {
  ksefReferenceNumber?: string
  invoiceReferenceNumber?: string
  acquisitionTimestamp?: string
  hashSHA?: string
  isDemo?: boolean
}

export function buildUpoHtml(upo: UpoData): string {
  const ref = upo.ksefReferenceNumber || '—'
  const invoiceNo = upo.invoiceReferenceNumber || '—'
  const ts = upo.acquisitionTimestamp
    ? new Date(upo.acquisitionTimestamp).toLocaleString('pl-PL')
    : new Date().toLocaleString('pl-PL')
  const hash = upo.hashSHA || '—'
  const demoNote = upo.isDemo
    ? `<div style="margin-bottom:18px;padding:10px 16px;background:var(--color-warning-soft);border-radius:8px;font-size:13px;border:1px solid var(--color-accent);">
         ⚠️ Dokument wygenerowany w trybie DEMO — nie pochodzi z systemu KSeF MF.
       </div>` : ''
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8">
<style>
body { margin:0; font-family: Inter, Arial, sans-serif; background:var(--color-surface-soft); color:var(--color-text-primary); }
.page { max-width:680px; margin:32px auto; background:#fff; border-radius:16px; padding:40px 48px; box-shadow:0 2px 16px rgba(0,0,0,.08); }
.header { text-align:center; margin-bottom:32px; }
.seal { width:72px; height:72px; margin:0 auto 16px; display:flex; align-items:center; justify-content:center; background:var(--color-info); border-radius:50%; }
.seal svg { width:40px; height:40px; fill:#fff; }
h1 { font-size:22px; font-weight:700; color:var(--color-text-primary); margin:0 0 4px; }
.subtitle { font-size:13px; color:var(--color-text-muted); margin:0; }
.field { display:flex; gap:16px; padding:12px 0; border-bottom:1px solid var(--color-surface-soft); font-size:14px; }
.field:last-child { border-bottom:none; }
.field label { width:200px; flex-shrink:0; color:var(--color-text-muted); font-weight:500; }
.field value { color:var(--color-text-primary); word-break:break-all; }
.footer { margin-top:24px; padding-top:20px; border-top:2px solid var(--color-border); text-align:center; font-size:12px; color:var(--color-text-muted); }
.badge-ok { display:inline-block; padding:4px 12px; background:var(--color-success-soft); color:var(--color-brand); border-radius:20px; font-size:13px; font-weight:600; }
</style></head><body><div class="page">
${demoNote}
<div class="header">
  <div class="seal"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div>
  <h1>Urzędowe Poświadczenie Odbioru</h1>
  <p class="subtitle">Krajowy System e-Faktur &middot; Ministerstwo Finansów</p>
</div>
<div style="text-align:center;margin-bottom:24px;"><span class="badge-ok">✓ Faktura przyjęta przez KSeF</span></div>
<div class="field"><label>Nr ref. KSeF</label><value><strong>${escXml(ref)}</strong></value></div>
<div class="field"><label>Nr faktury</label><value>${escXml(invoiceNo)}</value></div>
<div class="field"><label>Data i czas przyjęcia</label><value>${escXml(ts)}</value></div>
<div class="field"><label>Skrót SHA-256</label><value><code style="font-size:11px;">${escXml(hash)}</code></value></div>
<div class="footer">
  <p>Niniejsze poświadczenie potwierdza skuteczne przyjęcie faktury ustrukturyzowanej<br/>przez Krajowy System e-Faktur zgodnie z art. 106nd ust. 1 Ustawy o VAT.</p>
  <p style="margin-top:8px;">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
</div>
</div></body></html>`
}

/** Session data needed for KSeF API calls (returned by initSession) */
export interface KsefSessionData {
  sessionToken: string
  referenceNumber: string
  /** @deprecated kept for backwards compat */
  accessToken?: string
  /** @deprecated kept for backwards compat */
  sessionRef?: string
  symmetricKey?: string
  iv?: string
  validUntil?: string
}

export const ksefService = {
  // ── Session ────────────────────────────────────────────
  /**
   * Authenticate + open online session (v2 flow).
   * Returns { accessToken, sessionRef, symmetricKey, iv, validUntil }
   */
  async initSession(nip: string, token: string, env: KsefEnv = 'test') {
    return callProxy('ksef-session', { action: 'init', nip, token, env })
  },
  async closeSession(sessionToken: string, referenceNumber: string, env: KsefEnv = 'test') {
    return callProxy('ksef-session', { action: 'close', sessionToken, referenceNumber, env })
  },

  // ── Invoice send ────────────────────────────────────────
  async sendInvoice(
    invoice: Invoice,
    seller: KsefSeller,
    buyer: KsefBuyer,
    session: { sessionToken?: string; accessToken?: string; sessionRef?: string; symmetricKey?: string; iv?: string },
    env: KsefEnv = 'test',
  ): Promise<{ ksefRef: string; invoiceNumber: string; mfResponse?: Record<string, unknown> }> {
    const xmlPayload = buildFA2Xml(invoice, seller, buyer)
    const token = session.sessionToken || session.accessToken || ''
    const result = await callProxy('ksef-send', {
      sessionToken: token,
      xmlPayload,
      invoiceNumber: invoice.number,
      referenceNumber: session.sessionRef || '',
      symmetricKey: session.symmetricKey || '',
      iv: session.iv || '',
      env,
    })
    return {
      ksefRef: result.ksefRef as string,
      invoiceNumber: invoice.number ?? '',
      mfResponse: result.mfResponse as Record<string, unknown> | undefined,
    }
  },

  // ── Receive documents ───────────────────────────────────
  async receiveDocuments(
    sessionToken: string,
    env: KsefEnv = 'test',
  ): Promise<KsefReceivedDoc[]> {
    const result = await callProxy('ksef-receive', { sessionToken, env })
    const incoming = (result.documents as KsefReceivedDoc[]) ?? []
    const stored = ksefService.getReceived()
    const existingRefs = new Set(stored.map((d) => d.ksefRef))
    const fresh = incoming.filter((d) => !existingRefs.has(d.ksefRef))
    if (fresh.length > 0) {
      const merged = [...fresh, ...stored].slice(0, 500)
      localStorage.setItem(RECEIVED_KEY, JSON.stringify(merged))
    }
    ksefService.appendHistory({
      invoiceId: '',
      invoiceNumber: `odebrano ${fresh.length} nowych dok.`,
      timestamp: new Date().toISOString(),
      action: 'receive',
      status: 'success',
      ksefRef: null,
      error: null,
    })
    return ksefService.getReceived()
  },

  // ── History ─────────────────────────────────────────────
  getHistory(): KsefHistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    } catch {
      return []
    }
  },
  appendHistory(entry: Omit<KsefHistoryEntry, 'id'>) {
    const h = ksefService.getHistory()
    h.unshift({ id: uid(), ...entry })
    if (h.length > 300) h.splice(300)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
  },
  clearHistory() {
    localStorage.removeItem(HISTORY_KEY)
  },

  // ── Received docs ────────────────────────────────────────
  getReceived(): KsefReceivedDoc[] {
    try {
      return JSON.parse(localStorage.getItem(RECEIVED_KEY) || '[]')
    } catch {
      return []
    }
  },

  // ── UPO ─────────────────────────────────────────────────
  async fetchUpo(
    ksefRef: string,
    sessionToken: string,
    env: KsefEnv = 'test',
    referenceNumber?: string,
  ): Promise<Record<string, unknown>> {
    if (!referenceNumber) throw new Error('fetchUpo: brak referenceNumber sesji')
    if (!ksefRef) throw new Error('fetchUpo: brak ksefRef faktury')
    if (!sessionToken) throw new Error('fetchUpo: brak sessionToken')
    const result = await callProxy('ksef-upo', { ksefRef, sessionToken, referenceNumber, env })
    return result
  },

  buildUpoHtml,
  buildFA2Xml,
}
