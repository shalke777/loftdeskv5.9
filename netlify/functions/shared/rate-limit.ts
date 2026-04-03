// =============================================================================
// netlify/functions/shared/rate-limit.ts
// =============================================================================
// Persistent rate limiting via Supabase RPC (check_rate_limit).
// Replaces per-function in-memory Maps — survives cold starts and scales
// across multiple Netlify function instances.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  limited: boolean
  count: number
  max: number
  resets_at: string
}

/**
 * Check and increment rate limit for a user+endpoint pair.
 * Uses atomic DB upsert via RPC — no race conditions.
 *
 * Falls back to allowing the request if DB call fails (fail-open).
 */
export async function isRateLimitedDb(
  sb: SupabaseClient,
  userId: string,
  endpoint: string,
  max: number,
  windowMs: number = 600_000,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await sb.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max: max,
      p_window_ms: windowMs,
    })

    if (error) {
      console.error(`[rate-limit] RPC error for ${endpoint}:`, error.message)
      // Fail open — don't block user if DB has issues
      return { limited: false, count: 0, max, resets_at: '' }
    }

    return data as RateLimitResult
  } catch (err) {
    console.error(`[rate-limit] Unexpected error for ${endpoint}:`, err)
    return { limited: false, count: 0, max, resets_at: '' }
  }
}
