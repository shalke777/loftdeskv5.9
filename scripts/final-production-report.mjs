import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const mustExist = [
  'docs/v5.2-final-production-runbook.md',
  'docs/v5.2-release-gates.md',
  'tests/manual/v5.2-final-production-checklist.md',
  'scripts/pre-cutover-snapshot.sql',
  'scripts/post-cutover-verify.sql',
  'scripts/rls-smoke.sql',
  'supabase/migrations/015_production_audit_and_indexes.sql',
  'supabase/migrations/016_release_views_and_portal_guards.sql',
]

const rows = mustExist.map((file) => ({ file, ok: fs.existsSync(path.join(root, file)) }))
const missing = rows.filter((row) => !row.ok)
console.log('LoftDesk v5.2 final production report')
for (const row of rows) console.log(`- ${row.ok ? 'OK ' : 'MISS'} ${row.file}`)
if (missing.length) {
  console.error(`\nBrakuje ${missing.length} elementów final production pack.`)
  process.exitCode = 1
} else {
  console.log('\nFinal production pack jest kompletny.')
}
