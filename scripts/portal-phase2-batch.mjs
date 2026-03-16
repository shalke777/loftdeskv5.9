#!/usr/bin/env node
// =============================================================================
// portal-phase2-batch.mjs
// LoftDesk v5.9 — Operacyjny rollout batcha Fazy 2 migracji legacy portalu
// =============================================================================
//
// WYMAGANIA:
//   node >= 18 (fetch wbudowany)
//
// ZMIENNE ŚRODOWISKOWE (wymagane):
//   SUPABASE_URL          — np. https://xyzxyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY
//   NETLIFY_URL           — np. https://app.loftdesk.pl
//   OPERATOR_JWT          — Bearer token zalogowanego operatora
//                           (pobierz z DevTools → Application → localStorage → supabase.auth.token
//                            lub z odpowiedzi /auth/v1/token przy logowaniu)
//
// UŻYCIE:
//   # Instalacja zależności (jednorazowo):
//   node -e "require('node:child_process').execSync('npm install @supabase/supabase-js', {stdio:'inherit'})"
//
//   # Dry-run dla wszystkich firm:
//   DRY_RUN=true node scripts/portal-phase2-batch.mjs
//
//   # Realny batch — tylko wybrane firmy (podaj UUID-y po przecinku):
//   COMPANY_IDS=uuid1,uuid2 node scripts/portal-phase2-batch.mjs
//
//   # Realny batch — wszystkie firmy:
//   node scripts/portal-phase2-batch.mjs
//
//   # Małe batche (bezpieczniejsze dla pierwszego przejścia):
//   BATCH_LIMIT=5 DRY_RUN=true node scripts/portal-phase2-batch.mjs
//
// FLAGI:
//   DRY_RUN=true        — dry run (domyślnie false)
//   BATCH_LIMIT=N       — max rekordów na firmę (domyślnie 10 dla 1. rundy)
//   COMPANY_IDS=a,b,c   — lista UUID firm (domyślnie: wszystkie z ready > 0)
//   SKIP_CONFIRM=true   — pomiń interaktywne potwierdzenie (dla CI/CD)
//
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import * as readline from 'node:readline'

// ── Konfiguracja ──────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.SUPABASE_URL
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY
const NETLIFY_URL      = (process.env.NETLIFY_URL ?? 'https://app.loftdesk.pl').replace(/\/$/, '')
const OPERATOR_JWT     = process.env.OPERATOR_JWT
const IS_DRY_RUN       = process.env.DRY_RUN === 'true'
const BATCH_LIMIT      = Number(process.env.BATCH_LIMIT ?? '10')
const COMPANY_IDS_RAW  = process.env.COMPANY_IDS ?? ''
const SKIP_CONFIRM     = process.env.SKIP_CONFIRM === 'true'

// ── Walidacja środowiska ──────────────────────────────────────────────────────

const missing = []
if (!SUPABASE_URL)  missing.push('SUPABASE_URL')
if (!SERVICE_KEY)   missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (!NETLIFY_URL)   missing.push('NETLIFY_URL')
if (!OPERATOR_JWT)  missing.push('OPERATOR_JWT')

if (missing.length) {
  console.error('\n[ERROR] Brak wymaganych zmiennych środowiskowych:')
  missing.forEach(v => console.error(`  - ${v}`))
  console.error('\nUstaw je przed uruchomieniem:\n')
  console.error('  export SUPABASE_URL=https://...')
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=eyJ...')
  console.error('  export NETLIFY_URL=https://app.loftdesk.pl')
  console.error('  export OPERATOR_JWT=eyJ...  # JWT zalogowanego operatora\n')
  process.exit(1)
}

// ── Supabase (service role — tylko do odczytu listy firm) ─────────────────────

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── Pomocniki ─────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`  ${msg}`) }
function warn(msg) { console.warn(`  ⚠  ${msg}`) }
function ok(msg)   { console.log(`  ✓  ${msg}`) }
function err(msg)  { console.error(`  ✗  ${msg}`) }

async function confirm(question) {
  if (SKIP_CONFIRM) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`\n${question} [y/N]: `, ans => {
      rl.close()
      resolve(ans.trim().toLowerCase() === 'y')
    })
  })
}

/** Wywołuje portal-migrate-batch Netlify function */
async function callBatch(company_id, dry_run, limit) {
  const url = `${NETLIFY_URL}/.netlify/functions/portal-migrate-batch`
  const body = JSON.stringify({ company_id, dry_run, limit })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPERATOR_JWT}`,
    },
    body,
  })

  const json = await res.json().catch(() => ({ error: 'invalid_json', raw: res.statusText }))
  return { status: res.status, data: json }
}

/** Pobiera listę firm z ready > 0 z v_portal_migration_status */
async function getCompaniesWithReady() {
  const { data, error } = await sb
    .from('v_portal_migration_status')
    .select('company_id')
    .eq('action', 'ready')

  if (error) throw new Error(`Błąd pobierania listy firm: ${error.message}`)

  const unique = [...new Set((data ?? []).map(r => r.company_id))]
  return unique
}

/** Pobiera per-firma statystyki z v_portal_migration_status */
async function getCompanyStats(company_id) {
  const { data, error } = await sb
    .from('v_portal_migration_status')
    .select('action')
    .eq('company_id', company_id)

  if (error) throw new Error(`Błąd statystyk firmy ${company_id}: ${error.message}`)

  const rows = data ?? []
  return {
    ready: rows.filter(r => r.action === 'ready').length,
    done: rows.filter(r => r.action === 'done').length,
    no_email: rows.filter(r => r.action === 'no_email').length,
    skipped: rows.filter(r => r.action === 'skipped').length,
    expired_token: rows.filter(r => r.action === 'expired_token').length,
    total: rows.length,
  }
}

/** Pobiera no_email rekordy dla firmy — do checklisty ręcznej */
async function getNoEmailRecords(company_id) {
  const { data } = await sb
    .from('project_portal_tokens')
    .select('id, project_id, client_name, active, expires_at, created_at')
    .eq('company_id', company_id)
    .is('client_email', null)
    .eq('active', true)
    .is('revoked_at', null)

  return data ?? []
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('  LoftDesk Portal Phase 2 — Batch Rollout')
  console.log(`  Tryb:  ${IS_DRY_RUN ? 'DRY RUN (brak mutacji, brak maili)' : '⚡ REALNY BATCH'}`)
  console.log(`  Limit: ${BATCH_LIMIT} rekordów / firma`)
  console.log(`  URL:   ${NETLIFY_URL}`)
  console.log('═'.repeat(70) + '\n')

  // ── 1. Ustal listę firm ──────────────────────────────────────────────────
  let companyIds

  if (COMPANY_IDS_RAW) {
    companyIds = COMPANY_IDS_RAW.split(',').map(s => s.trim()).filter(Boolean)
    log(`Tryb manualny — przetwarzam ${companyIds.length} firmy/firm: ${companyIds.join(', ')}`)
  } else {
    log('Pobieranie listy firm z ready > 0 z v_portal_migration_status...')
    companyIds = await getCompaniesWithReady()
    log(`Firmy z pending/ready: ${companyIds.length}`)
  }

  if (companyIds.length === 0) {
    console.log('\n✓ Brak firm z rekordami ready. Migracja zakończona lub nie uruchomiono 049.')
    console.log('  Sprawdź za pomocą portal-phase2-rollout.sql (STEP 8) kryterium Fazy 3.\n')
    process.exit(0)
  }

  // ── 2. Statystyki przed startem ───────────────────────────────────────────
  console.log('\n── STATYSTYKI PRZED ROLLOUT ────────────────────────────────────────────\n')
  const statsTable = []
  for (const cid of companyIds) {
    const stats = await getCompanyStats(cid)
    statsTable.push({ company_id: cid, ...stats })
    log(`${cid}  ready=${stats.ready}  done=${stats.done}  no_email=${stats.no_email}  skipped=${stats.skipped}`)
  }

  if (!IS_DRY_RUN && !SKIP_CONFIRM) {
    const proceed = await confirm(
      `Zamierzasz uruchomić REALNY batch dla ${companyIds.length} firm (limit=${BATCH_LIMIT} / firmę).\n  Zostaną wysłane emaile z magic linkami do aktywnych klientów.\n  Kontynuować?`
    )
    if (!proceed) {
      console.log('\n  Anulowano.\n')
      process.exit(0)
    }
  }

  // ── 3. Rollout firma po firmie ────────────────────────────────────────────
  const report = []

  for (const company_id of companyIds) {
    console.log(`\n── ${company_id} ──────────────────────────────────────────────────────────\n`)

    // Dry-run zawsze najpierw (nawet jeśli IS_DRY_RUN=false, robimy dry-run diagnostic)
    log('Dry-run...')
    const dryResult = await callBatch(company_id, true, BATCH_LIMIT)

    if (dryResult.status !== 200) {
      err(`Dry-run failed: HTTP ${dryResult.status} — ${JSON.stringify(dryResult.data)}`)
      report.push({ company_id, status: 'blocked', reason: `dry-run HTTP ${dryResult.status}: ${JSON.stringify(dryResult.data)}` })
      continue
    }

    const dry = dryResult.data
    log(`Dry-run OK: candidates=${dry.total_candidates ?? 0}  already_done=${dry.already_done ?? 0}  no_email=${dry.no_email ?? 0}`)

    if (dry.total_candidates === 0) {
      ok(`Firma ${company_id}: brak kandydatów do migracji (already_done=${dry.already_done})`)
      report.push({ company_id, status: 'already_complete', ...dry })
      continue
    }

    // Masked emails in dry-run
    if (dry.tokens && dry.tokens.length > 0) {
      log('Kandydaci (emaile zamaskowane):')
      for (const t of dry.tokens) {
        log(`  projekt=${t.project_id}  email=${t.client_email}  ma_konto=${t.has_account}`)
      }
    }

    if (IS_DRY_RUN) {
      ok(`DRY RUN — firma ${company_id}: ${dry.total_candidates} rekordów gotowych do migracji`)
      report.push({ company_id, status: 'dry_run_ok', ...dry })
      continue
    }

    // Realny batch
    log('Uruchamiam realny batch...')
    const realResult = await callBatch(company_id, false, BATCH_LIMIT)

    if (realResult.status !== 200) {
      err(`Batch failed: HTTP ${realResult.status} — ${JSON.stringify(realResult.data)}`)
      report.push({ company_id, status: 'batch_error', reason: `HTTP ${realResult.status}`, data: realResult.data })
      continue
    }

    const real = realResult.data

    if (real.migrated > 0) {
      ok(`Zmigrowano: ${real.migrated}`)
    }
    if (real.skipped > 0) {
      warn(`Skipped: ${real.skipped} — sprawdź logi Netlify Function i uruchom STEP 5 w rollout.sql`)
    }
    if (real.errors && real.errors.length > 0) {
      warn('Błędy per token:')
      for (const e of real.errors) {
        warn(`  token=${e.token_id}  projekt=${e.project_id}  powód=${e.reason}`)
      }
    }

    // Statystyki po batchu
    const statsAfter = await getCompanyStats(company_id)
    log(`Stan po batchu: ready=${statsAfter.ready}  done=${statsAfter.done}  skipped=${statsAfter.skipped}`)

    const firmaDone = statsAfter.ready === 0 && statsAfter.skipped === 0
    const firmaStatus = firmaDone
      ? 'migration_complete_waiting_window'
      : statsAfter.skipped > 0
        ? 'needs_manual_cleanup'
        : 'partial_more_needed'

    if (firmaDone) {
      ok(`Firma ${company_id}: migracja zakończona — START 30-dniowego okna obserwacyjnego`)
    } else if (statsAfter.ready > 0) {
      warn(`Firma ${company_id}: nadal ${statsAfter.ready} ready — uruchom batch ponownie`)
    }

    // no_email checklist
    const noEmail = await getNoEmailRecords(company_id)
    if (noEmail.length > 0) {
      warn(`no_email rekordy (${noEmail.length} szt.) — wymagają ręcznego zaproszenia:`)
      for (const r of noEmail) {
        warn(`  token=${r.id}  projekt=${r.project_id}  klient=${r.client_name ?? 'brak nazwy'}`)
      }
    }

    report.push({
      company_id,
      status: firmaStatus,
      migrated: real.migrated,
      skipped: real.skipped,
      already_done: real.already_done,
      no_email_count: noEmail.length,
      ready_after: statsAfter.ready,
      errorsDetail: real.errors ?? [],
    })
  }

  // ── 4. Raport końcowy ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('  RAPORT KOŃCOWY')
  console.log('═'.repeat(70) + '\n')

  let allComplete   = true
  let anyBlocked    = false
  let anyManual     = false

  for (const r of report) {
    const icon =
      r.status === 'migration_complete_waiting_window' ? '✓' :
      r.status === 'already_complete'                  ? '✓' :
      r.status === 'dry_run_ok'                        ? '~' :
      r.status === 'needs_manual_cleanup'              ? '⚠' :
      r.status === 'partial_more_needed'               ? '🔄' :
      r.status === 'blocked'                           ? '✗' : '?'

    console.log(`  ${icon}  ${r.company_id}  →  ${r.status}`)
    if (r.reason) log(`      powód: ${r.reason}`)
    if (r.migrated != null) log(`      migrated=${r.migrated}  skipped=${r.skipped}  already_done=${r.already_done}  no_email=${r.no_email_count}`)

    if (!['migration_complete_waiting_window', 'already_complete'].includes(r.status)) {
      allComplete = false
    }
    if (r.status === 'blocked') anyBlocked = true
    if (r.status === 'needs_manual_cleanup' || (r.no_email_count > 0)) anyManual = true
  }

  console.log('\n── REKOMENDACJA ──────────────────────────────────────────────────────────\n')

  if (IS_DRY_RUN) {
    console.log('  ~ DRY RUN zakończony — uruchom bez DRY_RUN=true aby wykonać realne batche.')
  } else if (anyBlocked) {
    console.log('  ✗ BLOCKED — MANUAL ACTION REQUIRED')
    console.log('    Jedna lub więcej firm ma błędy krytyczne. Sprawdź logi Netlify.')
    console.log('    Uruchom STEP 5 w portal-phase2-rollout.sql dla klasyfikacji skipped.')
  } else if (!allComplete) {
    console.log('  🔄 CONTINUE MIGRATION')
    console.log('    Nie wszystkie firmy zostały w pełni zmigrowane.')
    console.log('    Uruchom skrypt ponownie lub zwiększ BATCH_LIMIT.')
    if (anyManual) {
      console.log('    ⚠ Część rekordów wymaga ręcznej interwencji (no_email lub skipped klasa B/C).')
    }
  } else {
    console.log('  ✓ MIGRATION COMPLETE — START OBSERVATION WINDOW')
    console.log('    Wszystkie firmy z ready > 0 zostały zmigrowane.')
    console.log('    Rozpocznij 30-dniowe okno obserwacyjne.')
    console.log('    Kryterium Fazy 3: uruchom STEP 8 w portal-phase2-rollout.sql')
    if (anyManual) {
      console.log('\n    ⚠ Rekordy no_email wymagają ręcznego zaproszenia przez ProjectPortalCTA.')
    }
  }

  console.log('\n── NASTĘPNE KROKI ────────────────────────────────────────────────────────\n')
  console.log('  1. Uruchom STEP 6 w scripts/portal-phase2-rollout.sql — kontrola duplikatów')
  console.log('  2. Uruchom STEP 2 codziennie przez 30 dni — monitoring aktywności tokenów')
  console.log('  3. Rekordy no_email: zaproś ręcznie przez ProjectPortalCTA')
  console.log('  4. Rekordy skipped klasy A: zresetuj i uruchom batch ponownie')
  console.log('  5. Po 30 dniach bez aktywności: uruchom STEP 8 — kryterium Fazy 3')
  console.log('  6. Fazy 3 NIE wdrażaj bez spełnienia obu kryteriów!\n')
}

main().catch(e => {
  console.error('\n[FATAL]', e.message ?? e)
  process.exit(1)
})
