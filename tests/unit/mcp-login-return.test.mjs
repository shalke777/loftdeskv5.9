import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const output = ts.transpileModule(read('src/features/auth/lib/mcpLoginReturn.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
vm.runInNewContext(output, { exports, URLSearchParams, encodeURIComponent })
const { mcpLoginReturn } = exports
const authorizationId = 'abcdefghijklmnopqrstuv0123456789'

test('consent login resumes only a valid local authorization request', () => {
  assert.equal(mcpLoginReturn('/oauth/consent', `?authorization_id=${authorizationId}&next=https://evil.example`), `/oauth/consent?authorization_id=${authorizationId}`)
  for (const [path, search] of [
    ['/login', `?authorization_id=${authorizationId}`],
    ['//evil.example', `?authorization_id=${authorizationId}`],
    ['/oauth/consent', '?authorization_id=short'],
    ['/oauth/consent', '?authorization_id=https://evil.example'],
    ['/oauth/consent', `?authorization_id=${authorizationId}&authorization_id=${authorizationId}`],
    ['/oauth/consent', ''],
  ]) assert.equal(mcpLoginReturn(path, search), null)
})

// Run the real submit handler: a helper-only test would miss the lost redirect.
const source = ts.createSourceFile('LoginForm.tsx', read('src/features/auth/components/LoginForm.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let handler
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(source) === 'onClick' && node.initializer && ts.isJsxExpression(node.initializer) && ts.isArrowFunction(node.initializer.expression)) handler = node.initializer.expression.getText(source)
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(handler)
const compiled = ts.transpileModule(`(${handler})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

async function login(pathname, search, fail = false) {
  const redirects = [], errors = []
  let invites = 0
  const callback = vm.runInNewContext(compiled, {
    email: 'owner@example.test', password: 'test-only', isDemoMode: false,
    mcpLoginReturn, setLoading: () => {}, signInDemo: () => {},
    authApi: { signIn: async () => { if (fail) throw new Error('Sign-in failed') } },
    finalizeInviteIfNeeded: async () => { invites++; return '/settings' },
    toast: { success: () => {}, error: message => errors.push(message) },
    translateError: () => 'Sign-in failed', console: { error: () => {} },
    window: { location: { pathname, search, assign: value => redirects.push(value) } },
  })
  await callback()
  return { redirects, invites, errors }
}

test('signing in from consent returns to consent instead of the dashboard or invitations', async () => {
  const result = await login('/oauth/consent', `?authorization_id=${authorizationId}`)
  assert.deepEqual(result.redirects, [`/oauth/consent?authorization_id=${authorizationId}`])
  assert.equal(result.invites, 0)
})

test('normal login retains the existing invitation routing', async () => {
  const result = await login('/login', '')
  assert.deepEqual(result.redirects, ['/settings'])
  assert.equal(result.invites, 1)
})

test('failed authentication never proceeds to consent', async () => {
  const result = await login('/oauth/consent', `?authorization_id=${authorizationId}`, true)
  assert.deepEqual(result.redirects, [])
  assert.equal(result.errors.length, 1)
})
