import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function queue(invoices, overrides = {}) {
  const updates = []
  const source = readFileSync('src/features/ksef/hooks/useKsefQueue.ts', 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const api = { update: async (...args) => updates.push(args), get: async () => ({ ...invoices[0], items: [{}] }) }
  const service = { appendHistory() {}, sendInvoice: async () => ({ ksefRef: 'ref' }), closeSession: async () => {}, fetchUpo: async () => ({ statusCode: 100 }), ...overrides }
  const modules = {
    react: { useState: v => [v, () => {}], useCallback: f => f, useRef: v => ({ current: v }) },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/features/invoices/hooks/useInvoices': { useInvoices: () => ({ data: invoices }) },
    '@/features/clients/hooks/useClients': { useClients: () => ({ data: [{ id: 'client', name: 'Buyer' }] }) },
    '@/features/auth/hooks/useAuth': { useAuth: () => ({ user: {} }), useCompanyId: () => 'company' },
    '@/features/settings/hooks/useSettings': { useSettings: () => ({ profile: { nip: '123', company_name: 'Seller' } }) },
    '@/features/invoices/api/invoices.api': { invoicesApi: api },
    '@/services/ksef/ksef.service': { ksefService: service, validateNip: () => true },
    '@/features/ksef/lib/ksefEvents': { logKsefEvent: async () => {} },
  }
  const context = { exports: {}, require: n => { assert.ok(modules[n], n); return modules[n] }, console, setTimeout: f => f() }
  vm.runInNewContext(compiled, context)
  return { hook: context.exports.useKsefQueue(), updates }
}
const invoice = { id: 'invoice', company_id: 'company', client_id: 'client', number: 'TEST', ksef_status: 'ksef_pending' }
const session = { env: 'test', referenceNumber: 'session', sessionToken: 'token' }

test('existing reference is skipped without changing invoice status', async () => {
  const { hook, updates } = queue([{ ...invoice, ksef_ref: 'existing', ksef_status: 'ksef_error' }])
  const result = await hook.processQueue(session)
  assert.equal(result.skipped, 1)
  assert.equal(updates.length, 0)
})
test('intermediate response retains sent reference and is not a rejection', async () => {
  const { hook, updates } = queue([invoice])
  const result = await hook.processQueue(session)
  assert.equal(result.errors, 0)
  assert.equal(result.sent, 1)
  assert.equal(updates.length, 1)
  assert.equal(updates[0][1].ksef_ref, 'ref')
})
test('rejection preserves reference to prevent blind resubmission', async () => {
  const { hook, updates } = queue([invoice], { fetchUpo: async () => ({ statusCode: 450 }) })
  const result = await hook.processQueue(session)
  assert.equal(result.errors, 1)
  assert.equal(updates.at(-1)[1].ksef_status, 'ksef_error')
  assert.equal(Object.hasOwn(updates.at(-1)[1], 'ksef_ref'), false)
})
test('concurrent invocation cannot send twice and lock releases afterwards', async () => {
  let release
  let sends = 0
  const gate = new Promise(r => { release = r })
  const { hook } = queue([invoice], { sendInvoice: async () => { sends++; await gate; return { ksefRef: 'ref' } } })
  const first = hook.processQueue(session)
  await assert.rejects(hook.processQueue(session), /już przetwarzana/)
  release()
  await first
  assert.equal(sends, 1)
  await hook.processQueue(session)
  assert.equal(sends, 2)
})
