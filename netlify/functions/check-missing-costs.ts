// =============================================================================
// check-missing-costs.ts — Scheduled daily notification for missing expenses
// =============================================================================
// Runs daily at 08:00 UTC (09:00 CET / 10:00 CEST).
// For each ACTIVE project without any expense registered in the last 3 days,
// inserts an operator_notification of type 'missing_costs' — unless a
// notification was already sent for that project in the past 24 hours.
//
// Requires env vars:
//   SUPABASE_URL or VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const MAX_PROJECTS_PER_RUN = 200

export const handler: Handler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[check-missing-costs] Missing env vars — skipping')
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'missing_config' }) }
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Active projects (across all companies)
  const { data: activeProjects, error: projectsError } = await sb
    .from('projects')
    .select('id, company_id, name, number')
    .eq('status', 'active')
    .limit(MAX_PROJECTS_PER_RUN)

  if (projectsError) {
    console.error('[check-missing-costs] Failed to fetch projects:', projectsError)
    return { statusCode: 500, body: JSON.stringify({ error: projectsError.message }) }
  }

  if (!activeProjects || activeProjects.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ notified: 0, checked: 0 }) }
  }

  const projectIds = activeProjects.map((p) => p.id)

  // 2. Projects that DO have expenses in the last 3 days
  const { data: recentExpenses } = await sb
    .from('expense_invoices')
    .select('project_id')
    .in('project_id', projectIds)
    .gte('created_at', threeDaysAgo)

  const hasRecentExpenses = new Set((recentExpenses ?? []).map((e) => e.project_id))

  // 3. Projects already notified about missing costs in the last 24 hours
  const { data: recentNotifs } = await sb
    .from('operator_notifications')
    .select('project_id')
    .eq('type', 'missing_costs')
    .in('project_id', projectIds)
    .gte('created_at', oneDayAgo)

  const alreadyNotified = new Set((recentNotifs ?? []).map((n) => n.project_id))

  // 4. Projects needing a notification
  const toNotify = activeProjects.filter(
    (p) => !hasRecentExpenses.has(p.id) && !alreadyNotified.has(p.id),
  )

  if (toNotify.length === 0) {
    console.log('[check-missing-costs] No projects need notification')
    return { statusCode: 200, body: JSON.stringify({ notified: 0, checked: activeProjects.length }) }
  }

  // 5. Bulk insert notifications
  const notifications = toNotify.map((p) => {
    const label = [p.number, p.name].filter(Boolean).join(' — ')
    return {
      company_id:     p.company_id,
      project_id:     p.id,
      type:           'missing_costs',
      title:          'Brakujące koszty w projekcie',
      body:           `Projekt "${label}" nie ma zarejestrowanych kosztów od ponad 3 dni.`,
      reference_type: 'project',
      reference_id:   p.id,
    }
  })

  const { error: insertError } = await sb.from('operator_notifications').insert(notifications)

  if (insertError) {
    console.error('[check-missing-costs] Insert failed:', insertError)
    return { statusCode: 500, body: JSON.stringify({ error: insertError.message }) }
  }

  console.log(`[check-missing-costs] Notified ${toNotify.length} projects out of ${activeProjects.length} checked`)
  return {
    statusCode: 200,
    body: JSON.stringify({ notified: toNotify.length, checked: activeProjects.length }),
  }
}
