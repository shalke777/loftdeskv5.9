// =============================================================================
// data-export.ts — POST /api/account/export and /.netlify/functions/data-export
// =============================================================================
// Foreground actions:
//   - 'request'  → enqueue a job, fire-and-forget call to background worker
//   - 'status'   → poll job status
//   - 'download' → re-issue a signed URL for the ZIP (and bump download_count)
//
// The actual export work runs in `data-export-bg-background.ts` (15-min budget).
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import {
  CORS_HEADERS, jsonResponse, adminClient, authenticateUser, getPrimaryCompanyId,
  audit, clientIp,
} from './shared/auth'
import { isRateLimitedDb } from './shared/rate-limit'

interface Body {
  action?: 'request' | 'status' | 'download'
  job_id?: string
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const sb = adminClient()
  if (!sb) return jsonResponse(500, { error: 'Database not configured' })

  const authUser = await authenticateUser(sb, event.headers.authorization ?? event.headers.Authorization)
  if (!authUser) return jsonResponse(401, { error: 'Missing or invalid Authorization' })

  let body: Body
  try { body = JSON.parse(event.body ?? '{}') } catch { return jsonResponse(400, { error: 'Invalid JSON' }) }

  const ip = clientIp(event.headers as Record<string, string | undefined>)
  const ua = event.headers['user-agent'] ?? null
  const companyId = await getPrimaryCompanyId(sb, authUser.id)

  // 3 exports / 24 h is plenty.
  const rl = await isRateLimitedDb(sb, authUser.id, 'data-export', 3, 24 * 60 * 60 * 1000)
  if (rl.limited) return jsonResponse(429, { error: 'Too many export requests' })

  switch (body.action) {
    case 'request': {
      // Reuse a queued/running job if there is one
      const { data: existing } = await sb.from('data_export_jobs')
        .select('id, status').eq('user_id', authUser.id)
        .in('status', ['queued', 'running']).maybeSingle()
      if (existing) return jsonResponse(200, { ok: true, job_id: existing.id, status: existing.status, reused: true })

      const { data: job, error } = await sb.from('data_export_jobs')
        .insert({ user_id: authUser.id, company_id: companyId, status: 'queued' })
        .select('id').single()
      if (error) return jsonResponse(500, { error: 'enqueue_failed', detail: error.message })

      await audit(sb, {
        userId: authUser.id, companyId,
        eventType: 'DATA_EXPORT_REQUESTED',
        eventData: { job_id: job.id }, ip, userAgent: ua,
      })

      // Trigger background worker. Best-effort: ignore network failure — the
      // cron `cron-export-cleanup` will also pick up stale queued jobs.
      const url = process.env.URL ?? process.env.DEPLOY_URL ?? 'http://localhost:8888'
      try {
        await fetch(`${url}/.netlify/functions/data-export-bg-background`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Secret': process.env.CRON_SECRET ?? '',
          },
          body: JSON.stringify({ job_id: job.id }),
        })
      } catch (e) {
        console.warn('[data-export] background trigger failed:', (e as Error).message)
      }

      return jsonResponse(202, { ok: true, job_id: job.id, status: 'queued' })
    }

    case 'status': {
      if (!body.job_id) return jsonResponse(400, { error: 'job_id required' })
      const { data: job } = await sb.from('data_export_jobs')
        .select('id, status, file_size, requested_at, completed_at, expires_at, error, download_count')
        .eq('id', body.job_id).eq('user_id', authUser.id).maybeSingle()
      if (!job) return jsonResponse(404, { error: 'not_found' })
      return jsonResponse(200, { ok: true, job })
    }

    case 'download': {
      if (!body.job_id) return jsonResponse(400, { error: 'job_id required' })
      const { data: job } = await sb.from('data_export_jobs')
        .select('id, status, file_path, expires_at, download_count')
        .eq('id', body.job_id).eq('user_id', authUser.id).maybeSingle()
      if (!job || job.status !== 'completed' || !job.file_path) {
        return jsonResponse(404, { error: 'not_ready' })
      }
      if (job.expires_at && new Date(job.expires_at as string).getTime() < Date.now()) {
        return jsonResponse(410, { error: 'expired' })
      }
      const { data: signed, error } = await sb.storage.from('exports')
        .createSignedUrl(job.file_path as string, 60 * 60) // 1 h
      if (error || !signed) return jsonResponse(500, { error: 'sign_failed' })

      await sb.from('data_export_jobs')
        .update({ download_count: ((job.download_count as number) ?? 0) + 1 })
        .eq('id', job.id as string)
      await audit(sb, {
        userId: authUser.id, companyId,
        eventType: 'DATA_EXPORT_DOWNLOADED',
        eventData: { job_id: job.id }, ip, userAgent: ua,
      })

      return jsonResponse(200, { ok: true, url: signed.signedUrl })
    }

    default:
      return jsonResponse(400, { error: 'Unknown action' })
  }
}
