import { supabase, isDemoMode } from '@/shared/lib/supabase'

export type KsefEventAction =
  | 'guard_block'
  | 'send_attempt'
  | 'send_success'
  | 'send_error'
  | 'skip_idempotent'
  | 'retry'

export interface KsefEventInput {
  companyId: string
  invoiceId: string | null
  action: KsefEventAction
  attempt?: number
  ksefRef?: string | null
  env?: 'demo' | 'test' | 'prod' | null
  message?: string | null
  meta?: Record<string, unknown> | null
}

/** Append-only audit log for KSeF send pipeline.
 *  Best-effort: never throws — telemetry must not block the queue. */
export async function logKsefEvent(evt: KsefEventInput): Promise<void> {
  if (isDemoMode || !supabase) return
  if (!evt.companyId) return
  try {
    const { error } = await supabase.from('ksef_events').insert({
      company_id: evt.companyId,
      invoice_id: evt.invoiceId,
      action: evt.action,
      attempt: evt.attempt ?? 1,
      ksef_ref: evt.ksefRef ?? null,
      env: evt.env ?? null,
      message: evt.message ?? null,
      meta: evt.meta ?? null,
    })
    if (error) console.warn('[ksefEvents] insert failed (non-fatal):', error.message)
  } catch (e) {
    console.warn('[ksefEvents] insert threw (non-fatal):', e)
  }
}
