import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { ksefService } from '@/services/ksef/ksef.service'
import type { KsefSession } from './useKsefSession'
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
    async (session: KsefSession, isDemo = false): Promise<ProcessResult> => {
      setProcessing(true)
      const result: ProcessResult = { total: pending.length, sent: 0, errors: 0, items: [] }

      try {
        // Empty queue — finish immediately
        if (pending.length === 0) {
          setLastResult(result)
          return result
        }

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
            const ksefRef = `DEMO-${invoice.id.slice(0, 8)}-${Date.now().toString(36)}`
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_sent', ksef_ref: ksefRef }, companyId)
            } catch { /* DB update failed — continue */ }
            ksefService.appendHistory({
              invoiceId: invoice.id,
              invoiceNumber: invoice.number ?? "",
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
                session,
                session.env,
              )
              try {
                await invoicesApi.update(
                  invoice.id,
                  { ksef_status: 'ksef_sent', ksef_ref: ksefRef },
                  companyId,
                )
              } catch { /* DB update failed — invoice sent but status not saved */ }
              ksefService.appendHistory({
                invoiceId: invoice.id,
                invoiceNumber: invoice.number ?? "",
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
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_error' }, companyId)
            } catch { /* DB update failed — continue */ }
            ksefService.appendHistory({
              invoiceId: invoice.id,
              invoiceNumber: invoice.number ?? "",
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
      } catch (outerErr) {
        // Catch-all: any unhandled error must not leave processing=true
        const msg = outerErr instanceof Error ? outerErr.message : String(outerErr)
        if (result.items.length === 0) {
          result.errors = 1
          result.total = Math.max(result.total, 1)
          result.items.push({ invoice: pending[0], status: 'error', error: msg })
        }
        setLastResult(result)
      } finally {
        setProcessing(false)
      }
      return result
    },
    [pending, clients, profile, user, companyId, qc],
  )

  return { pending, processing, lastResult, processQueue }
}
