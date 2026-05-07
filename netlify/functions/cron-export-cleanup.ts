// =============================================================================
// cron-export-cleanup.ts — scheduled daily at 04:00 UTC.
// Removes ZIP artefacts past their expires_at and marks jobs 'expired'.
// =============================================================================

import type { Handler } from '@netlify/functions'
import { adminClient, audit, jsonResponse } from './shared/auth'

export const handler: Handler = async () => {
  const sb = adminClient()
  if (!sb) return jsonResponse(500, { error: 'no db' })

  const now = new Date().toISOString()
  const { data: stale } = await sb.from('data_export_jobs')
    .select('id, user_id, file_path')
    .in('status', ['completed'])
    .lte('expires_at', now)
    .limit(100)

  let removed = 0
  for (const j of stale ?? []) {
    if (j.file_path) {
      try { await sb.storage.from('exports').remove([j.file_path as string]) } catch { /* ignore */ }
    }
    await sb.from('data_export_jobs')
      .update({ status: 'expired', file_path: null }).eq('id', j.id as string)
    removed++
  }

  // Stale 'queued' or 'running' for > 1h → mark failed (worker probably crashed).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  await sb.from('data_export_jobs')
    .update({ status: 'failed', error: 'timeout' })
    .in('status', ['queued', 'running'])
    .lte('requested_at', oneHourAgo)

  await audit(sb, {
    userId: null, companyId: null, eventType: 'CRON_EXPORT_CLEANUP_RAN',
    eventData: { removed },
  })

  return jsonResponse(200, { ok: true, removed })
}
