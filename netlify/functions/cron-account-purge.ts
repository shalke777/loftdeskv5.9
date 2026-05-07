// =============================================================================
// cron-account-purge.ts — scheduled daily at 03:00 UTC.
// Calls /.netlify/functions/account-delete with action='execute'.
// =============================================================================

import type { Handler } from '@netlify/functions'
import { adminClient, audit, jsonResponse } from './shared/auth'

export const handler: Handler = async () => {
  const sb = adminClient()
  if (!sb) return jsonResponse(500, { error: 'no db' })

  const now = new Date().toISOString()
  const { data: due } = await sb.from('account_deletion_requests')
    .select('id, user_id, company_id')
    .eq('status', 'confirmed')
    .lte('scheduled_purge_at', now)
    .limit(50)

  if (!due || due.length === 0) {
    return jsonResponse(200, { ok: true, processed: 0 })
  }

  // Delegate via internal HTTP call so the actual logic lives in one place.
  const url = process.env.URL ?? process.env.DEPLOY_URL ?? 'http://localhost:8888'
  try {
    const res = await fetch(`${url}/.netlify/functions/account-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET ?? '',
      },
      body: JSON.stringify({ action: 'execute' }),
    })
    const txt = await res.text()
    await audit(sb, {
      userId: null, companyId: null, eventType: 'CRON_ACCOUNT_PURGE_RAN',
      eventData: { due: due.length, status: res.status, response: txt.slice(0, 500) },
    })
    return jsonResponse(200, { ok: true, due: due.length, upstream_status: res.status })
  } catch (e) {
    return jsonResponse(500, { error: 'cron_failed', detail: (e as Error).message })
  }
}
