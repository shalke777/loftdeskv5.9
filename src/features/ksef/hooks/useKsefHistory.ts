import { useState, useCallback } from 'react'
import { ksefService, type KsefHistoryEntry } from '@/services/ksef/ksef.service'

/** Full KSeF operation history. Pass invoiceId to filter per-invoice. */
export function useKsefHistory(invoiceId?: string) {
  const [history, setHistory] = useState<KsefHistoryEntry[]>(() => {
    const all = ksefService.getHistory()
    return invoiceId ? all.filter((e) => e.invoiceId === invoiceId) : all
  })

  const refresh = useCallback(() => {
    const all = ksefService.getHistory()
    setHistory(invoiceId ? all.filter((e) => e.invoiceId === invoiceId) : all)
  }, [invoiceId])

  const clear = useCallback(() => {
    ksefService.clearHistory()
    setHistory([])
  }, [])

  return { history, refresh, clear }
}
