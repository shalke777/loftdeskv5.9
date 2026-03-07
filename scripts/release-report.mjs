import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const docs = [
  'docs/v5.0-deliverables.md',
  'docs/v5.0-staging-release-plan.md',
  'tests/manual/v5.0-release-checklist.md',
  'scripts/pre-cutover-snapshot.sql',
  'scripts/post-cutover-verify.sql',
  'scripts/rls-smoke.sql',
]

const missing = docs.filter((item) => !fs.existsSync(path.join(root, item)))
if (missing.length) {
  console.error('Missing release artifacts:', missing.join(', '))
  process.exit(1)
}

console.log('LoftDesk v5.0 release pack looks complete.')
for (const item of docs) console.log(`- ${item}`)
