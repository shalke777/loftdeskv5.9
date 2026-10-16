import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual provider callback without mounting the unrelated UI tree.
const source = ts.createSourceFile('providers.tsx', readFileSync(new URL('../../src/app/providers.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let callback
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'signOut' && ts.isArrowFunction(node.initializer)) callback = node.initializer.getText(source)
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(callback, 'AuthProvider must expose its logout action')
const compiled = ts.transpileModule(`(${callback})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

test('ordinary logout ends only this session and preserves the independent OAuth connection', async () => {
  const sessions = new Set(['browser', 'chatgpt', 'phone'])
  const state = []
  const signOut = vm.runInNewContext(compiled, {
    isDemoMode: false,
    supabase: { auth: { signOut: async ({ scope = 'global' } = {}) => {
      if (scope === 'global') sessions.clear()
      else if (scope === 'local') sessions.delete('browser')
      return { error: null }
    } } },
    setUser: value => state.push(value), setStoredUser: value => state.push(value),
  })
  await signOut()
  assert.deepEqual([...sessions], ['chatgpt', 'phone'])
  assert.deepEqual(state, [null, null])
})

test('failed logout does not claim success by clearing the displayed session', async () => {
  const failure = new Error('Authentication service unavailable')
  const state = []
  const signOut = vm.runInNewContext(compiled, {
    isDemoMode: false,
    supabase: { auth: { signOut: async () => ({ error: failure }) } },
    setUser: value => state.push(value), setStoredUser: value => state.push(value),
  })
  await assert.rejects(signOut(), failure)
  assert.deepEqual(state, [])
})
