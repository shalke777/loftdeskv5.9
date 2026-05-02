#!/usr/bin/env node
/**
 * db-watch.mjs — LoftDesk migration watcher
 *
 * Monitors supabase/migrations/ for new .sql files and automatically
 * applies them via db-apply.mjs.
 *
 * Usage:
 *   npm run db:watch           — watch and auto-apply new migrations
 *   npm run db:watch:dry       — watch but only dry-run (no DB changes)
 *
 * Behaviour:
 *   - Only runs in Docker or local Supabase CLI environment
 *   - Debounces rapid file system events (300 ms)
 *   - Skips already-applied migrations (db-apply handles deduplication)
 *   - Sanity checks run after each apply (via db-apply)
 *   - Ctrl+C to stop
 */

import { watch, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const MIGS_DIR  = join(ROOT, 'supabase', 'migrations');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  blue:   '\x1b[34m',
};

function ok  (msg) { console.log(`${C.green}✔${C.reset} ${msg}`); }
function info(msg) { console.log(`${C.cyan}→${C.reset} ${msg}`); }
function warn(msg) { console.log(`${C.yellow}⚠${C.reset} ${msg}`); }
function err (msg) { console.error(`${C.red}✖${C.reset} ${msg}`); }
function hr  ()    { console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`); }
function ts  ()    { return new Date().toTimeString().slice(0, 8); }

// ── Environment detection (mirrors db-apply.mjs logic) ───────────────────────
function detectEnv() {
  // Try Docker
  try {
    const r = spawnSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' });
    if (r.status === 0) {
      const containers = r.stdout.split('\n').map(l => l.trim()).filter(Boolean);
      const dbContainer = containers.find(c => c.startsWith('supabase_db_'));
      if (dbContainer) return { type: 'docker', container: dbContainer };
    }
  } catch { /* ignore */ }

  // Try Supabase CLI
  try {
    const r = spawnSync('npx', ['supabase', 'status'], { encoding: 'utf8', shell: true });
    if (r.status === 0 && r.stdout.includes('DB URL')) {
      return { type: 'cli' };
    }
  } catch { /* ignore */ }

  return { type: 'none' };
}

// ── Snapshot of known migration files ────────────────────────────────────────
function getKnownFiles() {
  return new Set(
    readdirSync(MIGS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()
  );
}

// ── Apply a single migration via db-apply.mjs ─────────────────────────────────
function applyFile(filename) {
  hr();
  info(`[${ts()}] New migration detected: ${C.bold}${filename}${C.reset}`);

  const applyArgs = ['scripts/db-apply.mjs', '--file', filename];
  if (DRY_RUN) applyArgs.push('--dry-run');

  const r = spawnSync('node', applyArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',   // stream output directly to terminal
  });

  if (r.status === 0) {
    ok(`[${ts()}] ${filename} — done`);
  } else {
    err(`[${ts()}] ${filename} — apply exited with code ${r.status}`);
  }

  hr();
  return r.status === 0;
}

// ── Debounce helper ───────────────────────────────────────────────────────────
const pending = new Map(); // filename → timeout handle

function scheduleApply(filename) {
  if (pending.has(filename)) {
    clearTimeout(pending.get(filename));
  }
  const handle = setTimeout(() => {
    pending.delete(filename);
    applyFile(filename);
  }, 300);
  pending.set(filename, handle);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}LoftDesk db:watch — Migration Watcher${C.reset}\n`);

  // Guard: only run in local/docker env
  const env = detectEnv();
  if (env.type === 'none') {
    err('No local DB environment detected (Docker Supabase or Supabase CLI).');
    err('Watch mode requires a local database. Start with: npx supabase start');
    process.exit(1);
  }

  ok(`Environment: ${env.type === 'docker' ? `Docker (${env.container})` : 'Supabase CLI'}`);
  if (DRY_RUN) warn('DRY RUN mode — migrations will be analysed but not applied');
  info(`Watching: ${C.dim}${MIGS_DIR}${C.reset}`);
  info(`Press ${C.bold}Ctrl+C${C.reset} to stop\n`);

  // Snapshot of files that existed when watcher started
  let knownFiles = getKnownFiles();
  info(`Existing migrations: ${knownFiles.size} file(s) (already tracked — will skip)`);
  hr();

  // Watch the migrations directory
  const watcher = watch(MIGS_DIR, { persistent: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.sql')) return;

    // We only care about newly appearing files
    if (knownFiles.has(filename)) return;

    // Double-check the file actually exists now (rename events fire on both src and dst)
    try {
      readdirSync(MIGS_DIR); // refresh
    } catch { return; }

    const currentFiles = getKnownFiles();

    if (!currentFiles.has(filename)) return; // file disappeared before we could process

    // Mark as known so we don't double-trigger
    knownFiles.add(filename);

    scheduleApply(filename);
  });

  watcher.on('error', (e) => {
    err(`Watcher error: ${e.message}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n${C.dim}Watcher stopped.${C.reset}`);
    watcher.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    watcher.close();
    process.exit(0);
  });
}

main().catch(e => {
  err(`Fatal: ${e.message}`);
  process.exit(1);
});
