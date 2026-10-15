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
    const { useKsefQueue } = load('src/features/ksef/hooks/useKsefQueue.ts', {
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
    assert.equal(writes.some(patch => patch.ksef_ref === null), statusCode === 450)
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
    './ksef-http': { ksefFetch: async () => ({ ok: true, json: () => ({ invoices: [{
      referenceNumber: 'submission-ref', invoicingDate: '2026-10-15T12:00:00Z', status: { code: 150 },
    }] }) }) },
    './ksef-mock': {}, './ksef-auth': { requireKsefAccess: async () => ({}) },
  })
  const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ ksefRef: 'submission-ref', sessionToken: 'token', referenceNumber: 'session-ref' }) })
  const data = JSON.parse(response.body)
  assert.equal(data.ksefReferenceNumber, null)
  assert.equal(data.acquisitionTimestamp, null)
  assert.equal(data.statusCode, 150)
})
