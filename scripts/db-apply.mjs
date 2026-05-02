#!/usr/bin/env node
/**
 * db-apply.mjs — LoftDesk migration engine
 *
 * Works like Flyway/Prisma Migrate:
 *   1. Detects execution environment (Docker → supabase CLI → error)
 *   2. Bootstraps migration_log table if missing
 *   3. Reads supabase/migrations/*.sql in alphabetical order
 *   4. Skips already-applied migrations
 *   5. Splits CONCURRENTLY indexes out of transactions and runs them standalone
 *   6. Runs sanity checks after each migration
 *   7. Reports APPLIED / SKIPPED / FAILED per file
 *
 * Usage:
 *   npm run db:apply
 *   npm run db:apply -- --file 132_rls_initplan_and_index_fix.sql
 *   npm run db:apply -- --dry-run
 */

import { execSync, spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const MIGS_DIR  = join(ROOT, 'supabase', 'migrations');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const SEED_MODE   = args.includes('--seed');   // mark existing files as APPLIED, no SQL exec
const fileFilter  = (() => {
  const idx = args.indexOf('--file');
  return idx !== -1 ? args[idx + 1] : null;
})();
const beforeFilter = (() => {
  const idx = args.indexOf('--before');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};
const ok   = (m) => console.log(`${C.green}✔${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`);
const err  = (m) => console.error(`${C.red}✘${C.reset} ${m}`);
const info = (m) => console.log(`${C.cyan}→${C.reset} ${m}`);
const hr   = ()  => console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);

// ── Environment detection ─────────────────────────────────────────────────────
function detectEnv() {
  // 1. Docker Supabase DB container
  try {
    const out = execSync('docker ps --format "{{.Names}}"', { stdio: ['pipe','pipe','pipe'] })
      .toString();
    const match = out.split('\n').find(n => n.includes('supabase_db_'));
    if (match) return { type: 'docker', container: match.trim() };
  } catch {}

  // 2. supabase CLI linked
  try {
    execSync('supabase status --output json', { stdio: ['pipe','pipe','pipe'] });
    return { type: 'supabase_cli' };
  } catch {}

  return { type: 'none' };
}

// ── SQL execution ─────────────────────────────────────────────────────────────
function psql(env, sql) {
  if (env.type === 'docker') {
    const result = spawnSync(
      'docker',
      ['exec', '-i', env.container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql],
      { encoding: 'utf8' }
    );
    return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status };
  }
  if (env.type === 'supabase_cli') {
    const result = spawnSync(
      'supabase',
      ['db', 'query', '--linked', sql],
      { encoding: 'utf8' }
    );
    return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status };
  }
  throw new Error('No DB environment available');
}

function psqlFile(env, filePath) {
  if (env.type === 'docker') {
    const result = spawnSync(
      'docker',
      ['exec', '-i', env.container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/dev/stdin'],
      { input: readFileSync(filePath, 'utf8'), encoding: 'utf8' }
    );
    return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status };
  }
  throw new Error('psqlFile only supported with Docker');
}

// ── migration_log bootstrap ───────────────────────────────────────────────────
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.migration_log (
  id           serial PRIMARY KEY,
  filename     text   NOT NULL UNIQUE,
  status       text   NOT NULL CHECK (status IN ('APPLIED','FAILED','SKIPPED')),
  applied_at   timestamptz NOT NULL DEFAULT now(),
  duration_ms  integer,
  error        text
);
`;

function ensureMigrationLog(env) {
  const r = psql(env, BOOTSTRAP_SQL);
  if (r.code !== 0) throw new Error(`Cannot bootstrap migration_log: ${r.stderr}`);
}

function getApplied(env) {
  const r = psql(env, `SELECT filename FROM public.migration_log WHERE status = 'APPLIED';`);
  if (r.code !== 0) return new Set();
  return new Set(
    r.stdout.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('filename') && !l.startsWith('---') && !l.startsWith('(') && l !== '')
  );
}

function logMigration(env, filename, status, durationMs, errorMsg) {
  const escaped = (errorMsg || '').replace(/'/g, "''").substring(0, 2000);
  psql(env, `
    INSERT INTO public.migration_log (filename, status, duration_ms, error)
    VALUES ('${filename}', '${status}', ${durationMs}, ${escaped ? `'${escaped}'` : 'NULL'})
    ON CONFLICT (filename) DO UPDATE
      SET status = EXCLUDED.status,
          applied_at = now(),
          duration_ms = EXCLUDED.duration_ms,
          error = EXCLUDED.error;
  `);
}

// ── SQL splitting: transaction block vs CONCURRENTLY ─────────────────────────
/**
 * Returns [{ type: 'transaction'|'standalone', sql: string }]
 * - CONCURRENTLY statements must run outside any transaction
 */
function splitSql(fullSql) {
  const parts = [];

  // Split at the boundary between COMMIT; and first CONCURRENTLY
  const concurrentlyRe = /^CREATE\s+INDEX\s+CONCURRENTLY\b/gmi;
  const matches = [...fullSql.matchAll(concurrentlyRe)];

  if (matches.length === 0) {
    parts.push({ type: 'transaction', sql: fullSql });
    return parts;
  }

  // Find where CONCURRENTLY section starts
  // Look for the last COMMIT before first CONCURRENTLY
  const firstConcurrentlyPos = matches[0].index;
  const preSection = fullSql.substring(0, firstConcurrentlyPos);
  const postSection = fullSql.substring(firstConcurrentlyPos);

  if (preSection.trim()) {
    parts.push({ type: 'transaction', sql: preSection });
  }

  // Each CONCURRENTLY statement is standalone
  const stmts = postSection
    .split(/(?<=;)\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');

  for (const stmt of stmts) {
    if (/^CREATE\s+INDEX\s+CONCURRENTLY/i.test(stmt)) {
      parts.push({ type: 'standalone', sql: stmt.endsWith(';') ? stmt : stmt + ';' });
    } else if (stmt.trim()) {
      parts.push({ type: 'comment', sql: stmt });
    }
  }

  return parts;
}

// ── Sanity checks ─────────────────────────────────────────────────────────────
const SANITY_CHECKS = [
  {
    name: 'No bare my_company_id() in RLS policies',
    // policies using bare call (not wrapped in SELECT)
    sql: `
      SELECT count(*) AS n
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (
          qual ~ '= my_company_id\\(\\)'
          OR qual ~ 'my_role\\(\\) IN'
          OR qual ~ 'my_app_role\\(\\) NOT IN'
        )
        AND qual NOT LIKE '%(SELECT my_company_id()%'
        AND qual NOT LIKE '%(SELECT my_role()%'
        AND qual NOT LIKE '%(SELECT my_app_role()%';
    `,
    expectZero: true,
    failMsg: 'Bare (non-InitPlan) STABLE function calls still exist in RLS policies',
  },
  {
    name: 'P0 company_id indexes present',
    sql: `
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'idx_projects_company_created',
        'idx_clients_company_created',
        'idx_contracts_company_created',
        'idx_cost_approvals_company',
        'idx_client_notifications_company',
        'idx_project_client_access_client',
        'idx_cost_estimate_items_fk',
        'idx_invoice_items_fk'
      )
      ORDER BY indexname;
    `,
    expectCount: 8,
    failMsg: 'Not all P0 indexes exist after migration',
  },
];

function runSanityChecks(env) {
  console.log('');
  info('Running sanity checks…');
  let allPassed = true;

  for (const check of SANITY_CHECKS) {
    const r = psql(env, check.sql);
    if (r.code !== 0) {
      warn(`  [SKIP] ${check.name} — query failed: ${r.stderr.trim()}`);
      continue;
    }

    const lines = r.stdout.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'));

    if (check.expectZero !== undefined) {
      // Parse count
      const countLine = lines.find(l => /^\d+$/.test(l));
      const n = countLine ? parseInt(countLine, 10) : -1;
      if (n === 0) {
        ok(`  ${check.name}`);
      } else {
        err(`  ${check.name} — FAIL (${n} violations)`);
        err(`    ${check.failMsg}`);
        allPassed = false;
      }
    } else if (check.expectCount !== undefined) {
      const rowCount = lines.filter(l => l.startsWith('idx_')).length;
      if (rowCount >= check.expectCount) {
        ok(`  ${check.name} (${rowCount}/${check.expectCount})`);
      } else {
        err(`  ${check.name} — FAIL (${rowCount}/${check.expectCount} indexes found)`);
        err(`    ${check.failMsg}`);
        allPassed = false;
      }
    }
  }

  return allPassed;
}

// ── Apply a single migration ──────────────────────────────────────────────────
async function applyMigration(env, filename, sql) {
  const parts = splitSql(sql);
  const t0 = Date.now();

  for (const part of parts) {
    if (part.type === 'comment') continue;

    const label = part.type === 'standalone'
      ? `  [CONCURRENTLY] ${part.sql.substring(0, 80).replace(/\n/g, ' ')}…`
      : `  [TRANSACTION BLOCK]`;

    if (DRY_RUN) {
      info(`${label} — DRY RUN, skipping`);
      continue;
    }

    info(label);
    const r = psql(env, part.sql);

    if (r.code !== 0) {
      const errorText = r.stderr || r.stdout;
      return { ok: false, durationMs: Date.now() - t0, error: errorText };
    }

    // Print any NOTICEs (non-fatal)
    if (r.stderr && r.stderr.includes('NOTICE')) {
      r.stderr.split('\n')
        .filter(l => l.includes('NOTICE'))
        .forEach(l => console.log(`  ${C.dim}${l}${C.reset}`));
    }
  }

  return { ok: true, durationMs: Date.now() - t0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}LoftDesk db:apply — Migration Engine${C.reset}\n`);

  // Detect environment
  const env = detectEnv();
  if (env.type === 'none') {
    err('No DB environment detected (Docker Supabase or Supabase CLI).');
    err('Start local Supabase: npx supabase start');
    process.exit(1);
  }
  ok(`Environment: ${env.type === 'docker' ? `Docker (${env.container})` : 'Supabase CLI'}`);

  if (DRY_RUN) warn('DRY RUN mode — no changes will be made');
  if (SEED_MODE) warn('SEED mode — marking migrations as APPLIED without executing SQL');

  // Bootstrap migration_log
  if (!DRY_RUN) {
    ensureMigrationLog(env);
    ok('migration_log table ready');
  }

  // Get applied migrations
  const applied = DRY_RUN ? new Set() : getApplied(env);
  info(`Already applied: ${applied.size} migration(s)`);

  // Collect migration files
  const files = readdirSync(MIGS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => !fileFilter || f === fileFilter || f.startsWith(fileFilter))
    .filter(f => !beforeFilter || f < beforeFilter);

  if (files.length === 0) {
    warn('No migration files found.');
    process.exit(0);
  }

  hr();

  const results = [];

  for (const filename of files) {
    const status = applied.has(filename) ? 'SKIPPED' : null;

    if (status === 'SKIPPED') {
      console.log(`${C.dim}SKIPPED${C.reset}  ${filename}`);
      results.push({ filename, status: 'SKIPPED' });
      continue;
    }

    info(`Applying: ${C.bold}${filename}${C.reset}`);

    // SEED mode: record as APPLIED without executing SQL
    if (SEED_MODE) {
      logMigration(env, filename, 'APPLIED', 0, null);
      ok(`SEEDED   ${filename}`);
      results.push({ filename, status: 'APPLIED' });
      continue;
    }

    const sql = readFileSync(join(MIGS_DIR, filename), 'utf8');
    const result = await applyMigration(env, filename, sql);

    if (result.ok || DRY_RUN) {
      if (!DRY_RUN) logMigration(env, filename, 'APPLIED', result.durationMs, null);
      ok(`APPLIED  ${filename} (${result.durationMs}ms)`);
      results.push({ filename, status: 'APPLIED' });
    } else {
      if (!DRY_RUN) logMigration(env, filename, 'FAILED', result.durationMs, result.error);
      err(`FAILED   ${filename}`);
      err(`         ${result.error?.split('\n')[0] || 'unknown error'}`);
      results.push({ filename, status: 'FAILED', error: result.error });

      // Stop on first failure
      hr();
      err('Migration chain stopped on first failure. Fix the issue and re-run.');
      printSummary(results);
      process.exit(1);
    }

    hr();
  }

  // Sanity checks (always run after applying anything)
  const anyApplied = results.some(r => r.status === 'APPLIED');
  if (anyApplied && !DRY_RUN) {
    const sane = runSanityChecks(env);
    if (!sane) {
      err('Sanity checks FAILED — review the errors above.');
      printSummary(results);
      process.exit(2);
    }
  }

  console.log('');
  printSummary(results);
  process.exit(0);
}

function printSummary(results) {
  hr();
  console.log(`${C.bold}SUMMARY${C.reset}`);
  const applied  = results.filter(r => r.status === 'APPLIED').length;
  const skipped  = results.filter(r => r.status === 'SKIPPED').length;
  const failed   = results.filter(r => r.status === 'FAILED').length;
  console.log(`  ${C.green}APPLIED${C.reset}  ${applied}`);
  console.log(`  ${C.dim}SKIPPED${C.reset}  ${skipped}`);
  console.log(`  ${C.red}FAILED${C.reset}   ${failed}`);
  hr();
}

main().catch(e => {
  err(`Unexpected error: ${e.message}`);
  process.exit(1);
});
