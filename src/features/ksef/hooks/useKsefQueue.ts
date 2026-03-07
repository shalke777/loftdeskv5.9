import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { ksefService, type KsefEnv } from '@/services/ksef/ksef.service'
import type { Invoice } from '@/entities/invoice/model'

export interface QueueItemResult {
  invoice: Invoice
  status: 'sent' | 'error'
  ksefRef?: string
  error?: string
}

export interface ProcessResult {
  total: number
  sent: number
  errors: number
  items: QueueItemResult[]
}

/** Pending KSeF invoices = all invoices with ksef_pending or ksef_error status */
export function useKsefQueue() {
  const { data: invoices = [] } = useInvoices()
  const { data: clients = [] } = useClients()
  const { user } = useAuth()
  const { profile } = useSettings()
  const companyId = useCompanyId()
  const qc = useQueryClient()

  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<ProcessResult | null>(null)

  const pending = invoices.filter(
    (i) => i.ksef_status === 'ksef_pending' || i.ksef_status === 'ksef_error',
  )

  const processQueue = useCallback(
    async (sessionToken: string, env: KsefEnv = 'test', isDemo = false): Promise<ProcessResult> => {
      setProcessing(true)
      const result: ProcessResult = { total: pending.length, sent: 0, errors: 0, items: [] }

      for (const invoice of pending) {
        const client = clients.find((c) => c.id === invoice.client_id)
        const seller = {
          nip: (profile as Record<string, unknown>)?.nip as string || (profile as Record<string, unknown>)?.ksef_nip as string || '',
          name: (profile as Record<string, unknown>)?.company_name as string || user?.companyName || '',
          address: (profile as Record<string, unknown>)?.address as string || '',
        }
        const buyer = {
          nip: client?.nip || '',
          name: client?.name || '',
          address: client?.address || '',
        }

        if (isDemo) {
          // Demo mode — simulate successful send without calling KSeF API
          const ksefRef = `DEMO-${invoice.id.slice(0, 8)}-${Date.now().toString(36)}`
          await invoicesApi.update(invoice.id, { ksef_status: 'ksef_sent', ksef_ref: ksefRef }, companyId)
          ksefService.appendHistory({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            timestamp: new Date().toISOString(),
            action: 'send',
            status: 'success',
            ksefRef,
            error: null,
          })
          result.sent++
          result.items.push({ invoice, status: 'sent', ksefRef })
          continue
        }

        let sent = false
        let lastError = ''
        for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
          if (attempt > 1) {
            await new Promise<void>((r) => setTimeout(r, 1000 * 2 ** (attempt - 2)))
          }
          try {
            const { ksefRef } = await ksefService.sendInvoice(
              invoice,
              seller,
              buyer,
              sessionToken,
              env,
            )
            await invoicesApi.update(
              invoice.id,
              { ksef_status: 'ksef_sent', ksef_ref: ksefRef },
              companyId,
            )
            ksefService.appendHistory({
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              timestamp: new Date().toISOString(),
              action: attempt > 1 ? 'retry' : 'send',
              status: 'success',
              ksefRef,
              error: null,
            })
            result.sent++
            result.items.push({ invoice, status: 'sent', ksefRef })
            sent = true
          } catch (e: unknown) {
            lastError = e instanceof Error ? e.message : String(e)
          }
        }

        if (!sent) {
          await invoicesApi.update(invoice.id, { ksef_status: 'ksef_error' }, companyId)
          ksefService.appendHistory({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            timestamp: new Date().toISOString(),
            action: 'send',
            status: 'error',
            ksefRef: null,
            error: lastError,
          })
          result.errors++
          result.items.push({ invoice, status: 'error', error: lastError })
        }
      }

      qc.invalidateQueries({ queryKey: ['invoices'] })
      setLastResult(result)
      setProcessing(false)
      return result
    },
    [pending, clients, profile, user, companyId, qc],
  )

  return { pending, processing, lastResult, processQueue }
}
