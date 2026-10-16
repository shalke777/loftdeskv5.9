import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { reconcileInvoice } from '../lib/reconcileInvoice'
import type { KsefSession } from './useKsefSession'

/** Poll only while the KSeF page is open and an authenticated MF session is available. */
export function useKsefReconciliation(session: KsefSession | null, paused: boolean) {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!session || session.isDemo || !companyId || paused) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function tick() {
      try {
        const invoices = await invoicesApi.listKsefUnverified(companyId, session!.env)
        let firstError: string | null = null
        for (const invoice of invoices) {
          if (cancelled) break
          try {
            await reconcileInvoice(invoice, session!, companyId)
          } catch (e) {
            firstError ??= e instanceof Error ? e.message : String(e)
          }
        }
        if (!cancelled) {
          setError(firstError)
          if (invoices.length) void qc.invalidateQueries({ queryKey: ['invoices'] })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) timer = setTimeout(tick, 15000)
      }
    }
    void tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [session, companyId, paused, qc])
  return { error }
}
