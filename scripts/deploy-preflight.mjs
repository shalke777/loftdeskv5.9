#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'supabase/migrations/001_multi_tenant.sql',
  'supabase/migrations/002_rls_policies.sql',
  'supabase/migrations/006_company_onboarding.sql',
  'supabase/migrations/007_full_domain_rls.sql',
  'supabase/migrations/008_company_invitations_and_storage.sql',
  'supabase/migrations/009_invitation_acceptance_fn.sql',
  'supabase/migrations/010_portal_rls_hardening.sql',
  'supabase/migrations/011_cutover_support_views.sql',
  'scripts/rls-smoke.sql',
  'scripts/pre-cutover-snapshot.sql',
  'scripts/post-cutover-verify.sql',
  '.env.example',
]

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)))
if (missing.length) {
  console.error('Brak wymaganych plików do deployu / cutover:')
  for (const file of missing) console.error(` - ${file}`)
  process.exit(1)
}

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
const envVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_DATA_MODE']
const missingEnv = envVars.filter((key) => !envExample.includes(key))
if (missingEnv.length) {
  console.error('Brak wymaganych zmiennych w .env.example:')
  for (const key of missingEnv) console.error(` - ${key}`)
  process.exit(1)
}

console.log('Preflight OK: pliki migracji, smoke scripts i env.example są gotowe.')
