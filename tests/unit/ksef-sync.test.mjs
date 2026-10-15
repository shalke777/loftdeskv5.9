import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
  const code = path.endsWith('.ts')
    ? ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    : source
  const exports = {}
  vm.runInNewContext(code, {
    exports, console: { info() {}, warn() {}, error() {}, log() {} },
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
      return dependencies[name]
    },
    setTimeout(fn) { fn() }, ...globals,
  }, { filename: path })
  return exports
}

const invoice = {
  id: 'invoice-1', company_id: 'company-1', client_id: 'client-1', number: 'FV/1',
  ksef_status: 'ksef_pending', ksef_ref: null, items: [{ description: 'Etap prac', quantity: 1 }],
}

for (const statusCode of [null, 100, 150, 200, 450]) {
  test(`queue preserves processing and handles terminal status ${statusCode}`, async () => {
    const writes = []
    const reconcile = load('src/features/ksef/lib/reconcileInvoice.ts', {
      '@/features/invoices/api/invoices.api': { invoicesApi: { update: async (id, patch) => writes.push(patch) } },
      '@/services/ksef/ksef.service': { ksefService: { fetchUpo: async () => ({ statusCode, ksefReferenceNumber: statusCode === 200 ? 'final-ksef-number' : null }) } },
    })
    const { useKsefQueue } = load('src/features/ksef/hooks/useKsefQueue.ts', {
      '../lib/reconcileInvoice': reconcile,
      react: { useState: () => [null, () => {}], useCallback: fn => fn },
      '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
      '@/features/invoices/hooks/useInvoices': { useInvoices: () => ({ data: [invoice] }) },
      '@/features/clients/hooks/useClients': { useClients: () => ({ data: [{ id: 'client-1', name: 'Klient' }] }) },
      '@/features/auth/hooks/useAuth': { useAuth: () => ({ user: {} }), useCompanyId: () => 'company-1' },
      '@/features/settings/hooks/useSettings': { useSettings: () => ({ profile: { nip: '5260250274', company_name: 'Firma' } }) },
      '@/features/invoices/api/invoices.api': { invoicesApi: {
        get: async () => invoice,
        update: async (id, patch) => writes.push(patch),
      } },
      '@/services/ksef/ksef.service': { validateNip: () => true, ksefService: {
        sendInvoice: async () => ({ ksefRef: 'submission-ref' }),
        closeSession: async () => {}, appendHistory() {},
        fetchUpo: async () => ({ statusCode, ksefReferenceNumber: statusCode === 200 ? 'final-ksef-number' : null }),
      } },
      '@/features/ksef/lib/ksefEvents': { logKsefEvent: async () => {} },
    })
    const result = await useKsefQueue().processQueue({ env: 'test', referenceNumber: 'session-ref', sessionToken: 'token' })
    assert.equal(result.errors, statusCode === 450 ? 1 : 0)
    assert.equal(writes.some(patch => patch.ksef_ref === null), false)
    assert.equal(writes.at(-1).ksef_status, statusCode === 200 ? 'ksef_sent' : statusCode === 450 ? 'ksef_error' : 'ksef_pending')
    assert.equal(writes.some(patch => patch.ksef_number === 'final-ksef-number'), statusCode === 200)
  })
}

for (const method of ['list', 'get']) {
  test(`${method} retains KSeF number and rejection details`, async () => {
    const row = { ...invoice, ksef_number: 'final-number', ksef_last_error: 'Błąd walidacji', total_net: 100, total_gross: 108 }
    let selected
    const query = {
      select(cols) { selected = cols; return this }, order() { return this }, limit() { return this }, eq() { return this },
      then(resolve) { resolve({ data: [row], error: null }) },
      maybeSingle: async () => ({ data: row, error: null }),
    }
    const { invoicesApi } = load('src/features/invoices/api/invoices.api.ts', {
      '@/shared/lib/demoDb': { demoDb: {} },
      '@/features/invoices/lib/invoice.calculations': { calcInvoiceTotals() {} },
      '@/shared/lib/supabase': { isDemoMode: false, supabase: { from: () => query } },
      '@/shared/lib/legacySupabase': { sumInvoiceItems: () => ({ totalNet: 100, totalGross: 108 }) },
      '@/shared/lib/dataScope': { applyScope: q => q, getDataScope: async () => ({}), withScope() {} },
      '@/features/projects/api/projectDocuments.api': { projectDocumentsApi: {} },
    })
    const result = method === 'list' ? (await invoicesApi.list('company-1'))[0] : await invoicesApi.get('invoice-1', 'company-1')
    assert.equal(result.ksef_number, 'final-number')
    assert.equal(result.ksef_last_error, 'Błąd walidacji')
    if (method === 'list') assert.ok(selected.includes('ksef_number'))
  })
}

for (const statusCode of [100, 150, 200, 450]) {
  test(`confirmation preview requires final acceptance: ${statusCode}`, async () => {
    const state = []
    let rendered = false
    const { useKsefUpo } = load('src/features/ksef/hooks/useKsefUpo.ts', {
      '@/features/auth/hooks/useAuth': { useCompanyId: () => 'company-1' },
      '@/features/invoices/api/invoices.api': { invoicesApi: { findKsefSubmission: async () => ({ ksef_session_ref: 'original-session', ksef_env: 'test' }) } },
      react: { useState: () => [null, value => state.push(value)], useCallback: fn => fn },
      '@/services/ksef/ksef.service': { ksefService: {
        fetchUpo: async () => ({ statusCode, ksefReferenceNumber: statusCode === 200 ? 'final-number' : null }),
        buildUpoHtml: () => { rendered = true; return '<html />' },
      } },
    })
    await useKsefUpo().fetchAndShow('submission-ref', 'FV/1', 'token', 'test', false, 'session-ref')
    assert.equal(rendered, statusCode === 200)
    if (statusCode !== 200) assert.ok(state.some(v => typeof v === 'string' && v.includes('Brak potwierdzenia')))
  })
}

test('status proxy does not fabricate final number or acquisition date', async () => {
  const { handler } = load('netlify/functions/ksef-upo.js', {
    './ksef-http': { ksefFetch: async () => ({ ok: true, json: () => ({
      referenceNumber: 'submission-ref', invoicingDate: '2026-10-15T12:00:00Z', status: { code: 150 },
    }) }) },
    './ksef-mock': {}, './ksef-auth': { requireKsefAccess: async () => ({}) },
  })
  const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ ksefRef: 'submission-ref', sessionToken: 'token', referenceNumber: 'session-ref' }) })
  const data = JSON.parse(response.body)
  assert.equal(data.ksefReferenceNumber, null)
  assert.equal(data.acquisitionTimestamp, null)
  assert.equal(data.statusCode, 150)
})

for (const code of [100, 150, 200, 440, 450, 500]) {
  test(`reload reconciliation uses the original session and preserves reference: ${code}`, async () => {
    const saved = { ...invoice, ksef_ref: 'original-ref', ksef_session_ref: 'original-session', ksef_env: 'test' }
    let requested
    let patch
    const { reconcileInvoice } = load('src/features/ksef/lib/reconcileInvoice.ts', {
      '@/features/invoices/api/invoices.api': { invoicesApi: { update: async (id, data) => { patch = data } } },
      '@/services/ksef/ksef.service': { ksefService: { fetchUpo: async (...args) => {
        requested = args
        return { statusCode: code, ksefReferenceNumber: code === 200 ? 'final-number' : null }
      } } },
    })
    const result = await reconcileInvoice(saved, { env: 'test', sessionToken: 'new-token', referenceNumber: 'new-session' }, 'company-1')
    assert.equal(requested[3], 'original-session')
    assert.equal(requested[1], 'new-token')
    assert.equal(patch.ksef_ref, 'original-ref')
    assert.equal(patch.ksef_status_code, code)
    assert.ok(patch.ksef_checked_at)
    assert.equal(result.status, code === 200 ? 'sent' : code >= 400 ? 'error' : 'pending')
  })
}

test('a success code without an assigned number is still unverified', async () => {
  let patch
  const { reconcileInvoice } = load('src/features/ksef/lib/reconcileInvoice.ts', {
    '@/features/invoices/api/invoices.api': { invoicesApi: { update: async (id, data) => { patch = data } } },
    '@/services/ksef/ksef.service': { ksefService: { fetchUpo: async () => ({ statusCode: 200, ksefReferenceNumber: null }) } },
  })
  const result = await reconcileInvoice({ ...invoice, ksef_ref: 'ref', ksef_session_ref: 'session', ksef_env: 'test' }, { env: 'test' }, 'company-1')
  assert.equal(result.status, 'pending')
  assert.equal(patch.ksef_number, null)
})

test('reconciliation refuses an environment/company mismatch or missing original session', async () => {
  const { reconcileInvoice } = load('src/features/ksef/lib/reconcileInvoice.ts', {
    '@/features/invoices/api/invoices.api': {}, '@/services/ksef/ksef.service': {},
  })
  const saved = { ...invoice, ksef_ref: 'ref', ksef_session_ref: 'original-session', ksef_env: 'test' }
  await assert.rejects(reconcileInvoice(saved, { env: 'prod' }, 'company-1'))
  await assert.rejects(reconcileInvoice(saved, { env: 'test' }, 'other-company'))
  await assert.rejects(reconcileInvoice({ ...saved, ksef_session_ref: null }, { env: 'test' }, 'company-1'))
})

for (const stored of [{ ksef_ref: 'known-ref', ksef_number: null }, { ksef_ref: null, ksef_number: 'known-number' }]) {
  test(`ordinary send action cannot erase an existing KSeF identity: ${JSON.stringify(stored)}`, async () => {
    let updated = false
    const query = {
      select() { return this }, eq() { return this },
      single: async () => ({ data: stored, error: null }),
      update() { updated = true; return this },
    }
    const { invoicesApi } = load('src/features/invoices/api/invoices.api.ts', {
      '@/shared/lib/demoDb': {}, '@/features/invoices/lib/invoice.calculations': {},
      '@/shared/lib/supabase': { isDemoMode: false, supabase: { from: () => query } },
      '@/shared/lib/legacySupabase': {},
      '@/shared/lib/dataScope': { applyScope: q => q, getDataScope: async () => ({}), withScope() {} },
      '@/features/projects/api/projectDocuments.api': {},
    })
    await assert.rejects(invoicesApi.sendToKsef('invoice-1', 'company-1'), /referencję KSeF/)
    assert.equal(updated, false)
  })
}

test('polling isolates per-invoice errors and schedules the next verification', async () => {
  const checked = []
  const states = []
  const timers = []
  let cleanup
  const { useKsefReconciliation } = load('src/features/ksef/hooks/useKsefReconciliation.ts', {
    react: { useState: () => [null, v => states.push(v)], useEffect: fn => { cleanup = fn() } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/features/auth/hooks/useAuth': { useCompanyId: () => 'company-1' },
    '@/features/invoices/api/invoices.api': { invoicesApi: { listKsefUnverified: async () => [{ id: 'bad' }, { id: 'good' }] } },
    '../lib/reconcileInvoice': { reconcileInvoice: async inv => { checked.push(inv.id); if (inv.id === 'bad') throw new Error('MF temporarily unavailable') } },
  }, { setTimeout: (fn, delay) => { timers.push({ fn, delay }); return 1 }, clearTimeout() {} })
  useKsefReconciliation({ env: 'test' }, false)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(checked, ['bad', 'good'])
  assert.match(states.at(-1), /MF temporarily unavailable/)
  assert.equal(timers[0].delay, 15000)
  cleanup()
})

test('demo sessions do not query production invoices for reconciliation', () => {
  let queried = false
  const { useKsefReconciliation } = load('src/features/ksef/hooks/useKsefReconciliation.ts', {
    react: { useState: () => [null, () => {}], useEffect: fn => fn() },
    '@tanstack/react-query': { useQueryClient: () => ({}) },
    '@/features/auth/hooks/useAuth': { useCompanyId: () => 'company-1' },
    '@/features/invoices/api/invoices.api': { invoicesApi: { listKsefUnverified: () => { queried = true } } },
    '../lib/reconcileInvoice': {},
  })
  useKsefReconciliation({ env: 'prod', isDemo: true }, false)
  assert.equal(queried, false)
})
