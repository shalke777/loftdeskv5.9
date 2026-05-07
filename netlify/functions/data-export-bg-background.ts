// =============================================================================
// data-export-bg-background.ts — RODO art. 20 background ZIP exporter.
// =============================================================================
// Triggered by `data-export.ts` (action='request'). Long-running (15 min).
// Authenticated by X-Cron-Secret + the per-job user_id is the trust anchor.
//
// Output: storage://exports/<user_id>/<job_id>.zip
// Manifest: docs the schema_version + GDPR article + timestamp.
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import JSZip from 'jszip'
import { adminClient, audit, checkCronSecret, jsonResponse, CORS_HEADERS } from './shared/auth'

const SCHEMA_VERSION = 1
const TABLES_OWNED_BY_USER = [
  'profiles', 'company_members', 'projects', 'estimates', 'estimate_items',
  'invoices', 'invoice_items', 'contracts', 'expenses',
  'project_threads', 'project_messages', 'document_approvals',
  'audit_events', 'device_tokens', 'data_export_jobs', 'account_deletion_requests',
] as const

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (!checkCronSecret(event.headers as Record<string, string | undefined>)) {
    return jsonResponse(401, { error: 'Unauthorised' })
  }
  const sb = adminClient()
  if (!sb) return jsonResponse(500, { error: 'no db' })

  let body: { job_id?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch { return jsonResponse(400, { error: 'invalid json' }) }
  if (!body.job_id) return jsonResponse(400, { error: 'job_id required' })

  const { data: job } = await sb.from('data_export_jobs')
    .select('id, user_id, company_id, status').eq('id', body.job_id).maybeSingle()
  if (!job) return jsonResponse(404, { error: 'not_found' })
  if (job.status !== 'queued') return jsonResponse(200, { ok: true, skipped: true, reason: 'not queued' })

  await sb.from('data_export_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id as string)

  try {
    const userId = job.user_id as string
    const companyId = (job.company_id as string | null) ?? null
    const zip = new JSZip()

    const manifest = {
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      user_id: userId,
      company_id: companyId,
      gdpr_article: 'Art. 20 RODO — prawo do przenoszenia danych',
      tables_included: [] as string[],
      notes: 'Personal data only. Aggregated company data (other members) is excluded for privacy.',
    }

    // Profile
    await dumpQuery(zip, manifest, 'profile.json', sb, 'profiles', (q) => q.eq('id', userId))

    // Memberships
    await dumpQuery(zip, manifest, 'company_members.json', sb, 'company_members', (q) => q.eq('user_id', userId))

    // Per-table dumps where the row is owned by this user
    for (const table of [
      'projects', 'estimates', 'estimate_items', 'invoices', 'invoice_items',
      'contracts', 'expenses', 'document_approvals',
    ] as const) {
      await dumpQuery(zip, manifest, `${table}.json`, sb, table, (q) => q.eq('user_id', userId))
    }

    // Threads / messages — match by author or recipient (best-effort)
    await dumpQuery(zip, manifest, 'project_threads.json', sb, 'project_threads', (q) => q.eq('created_by', userId))
    await dumpQuery(zip, manifest, 'project_messages.json', sb, 'project_messages', (q) => q.eq('author_id', userId))

    // Audit events for this user
    await dumpQuery(zip, manifest, 'audit_events.json', sb, 'audit_events', (q) => q.eq('user_id', userId))

    // Device tokens (no personal data, but user might want to know what's registered)
    await dumpQuery(zip, manifest, 'device_tokens.json', sb, 'device_tokens', (q) => q.eq('user_id', userId))

    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    zip.file('README.txt',
      'Eksport danych LoftDesk (RODO art. 20)\n' +
      'Zawiera dane osobowe konta użytkownika oraz dokumenty wytworzone przez to konto.\n' +
      'Plik wygenerowany automatycznie. Format: JSON.\n')

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const filePath = `${userId}/${job.id}.zip`

    const { error: upErr } = await sb.storage.from('exports').upload(filePath, buf, {
      contentType: 'application/zip',
      upsert: true,
    })
    if (upErr) throw upErr

    await sb.from('data_export_jobs').update({
      status: 'completed',
      file_path: filePath,
      file_size: buf.length,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id as string)

    await audit(sb, {
      userId, companyId,
      eventType: 'DATA_EXPORT_COMPLETED',
      eventData: { job_id: job.id, file_size: buf.length, tables: manifest.tables_included.length },
    })

    return jsonResponse(200, { ok: true, file_size: buf.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await sb.from('data_export_jobs').update({
      status: 'failed', error: msg, completed_at: new Date().toISOString(),
    }).eq('id', job.id as string)
    await audit(sb, {
      userId: job.user_id as string,
      companyId: (job.company_id as string | null) ?? null,
      eventType: 'DATA_EXPORT_FAILED',
      eventData: { job_id: job.id, error: msg },
    })
    console.error('[data-export-bg]', msg)
    return jsonResponse(500, { error: 'export_failed', detail: msg })
  }
}

async function dumpQuery(
  zip: JSZip,
  manifest: { tables_included: string[] },
  filename: string,
  sb: NonNullable<ReturnType<typeof adminClient>>,
  table: string,
  filter: (q: ReturnType<NonNullable<ReturnType<typeof adminClient>>['from']>) => unknown,
): Promise<void> {
  try {
    const q = sb.from(table).select('*')
    const { data, error } = await (filter(q) as Promise<{ data: unknown[] | null; error: unknown }>)
    if (error) {
      zip.file(filename, JSON.stringify({ error: 'query_failed', table }))
      return
    }
    zip.file(filename, JSON.stringify(data ?? [], null, 2))
    manifest.tables_included.push(table)
  } catch {
    zip.file(filename, JSON.stringify({ error: 'unavailable', table }))
  }
}
