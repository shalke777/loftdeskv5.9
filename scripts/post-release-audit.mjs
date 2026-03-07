import fs from 'node:fs'
const targets = [
  'docs/v5.2-final-production-runbook.md',
  'tests/manual/v5.2-final-production-checklist.md',
  'scripts/post-cutover-verify.sql',
  'scripts/rls-smoke.sql',
]
const missing = targets.filter((file) => !fs.existsSync(file))
console.log('LoftDesk v5.2 post-release audit')
if (missing.length) {
  console.error('Braki w pakiecie audit:', missing.join(', '))
  process.exitCode = 1
} else {
  console.log('Pakiet audit obecny. Zachowaj checklistę i raport po wydaniu.')
}
