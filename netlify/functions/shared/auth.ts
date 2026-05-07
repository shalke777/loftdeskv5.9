// =============================================================================
// netlify/functions/shared/auth.ts
// Reusable JWT verification + audit helpers.
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cron-Secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
} as const

export function jsonResponse(status: number, body: unknown) {
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify(body) }
}

export function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface AuthedUser {
  id: string
  email: string | null
}

/** Returns the user from a Bearer Authorization header, or null. */
export async function authenticateUser(
  sb: SupabaseClient,
  authHeader: string | undefined,
): Promise<AuthedUser | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

/** Find a user's primary company (oldest membership). */
export async function getPrimaryCompanyId(
  sb: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await sb
    .from('company_members')
    .select('company_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.company_id as string | undefined) ?? null
}

export async function audit(
  sb: SupabaseClient,
  params: {
    userId: string | null
    companyId: string | null
    eventType: string
    eventData?: Record<string, unknown>
    ip?: string | null
    userAgent?: string | null
  },
): Promise<void> {
  try {
    await sb.from('audit_events').insert({
      user_id: params.userId,
      company_id: params.companyId,
      event_type: params.eventType,
      event_data: params.eventData ?? {},
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    })
  } catch (e) {
    console.warn('[audit] insert failed:', (e as Error).message)
  }
}

/** Header-based lightweight rate limit using audit_events as a counter. */
export function clientIp(headers: Record<string, string | undefined>): string | null {
  return (
    headers['x-nf-client-connection-ip'] ??
    headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    null
  )
}

export function checkCronSecret(headers: Record<string, string | undefined>): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = headers['x-cron-secret'] ?? headers['X-Cron-Secret']
  return provided === secret
}
