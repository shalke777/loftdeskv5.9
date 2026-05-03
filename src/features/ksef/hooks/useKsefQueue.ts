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
  /** Set when KSeF accepted the invoice but persisting ksef_status to DB failed.
   *  Critical: invoice IS sent but the DB does not know — manual reconciliation needed. */
  dbError?: string
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
            let dbError: string | undefined
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_sent', ksef_ref: ksefRef }, companyId)
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e)
              console.error('[useKsefQueue] DEMO post-send DB update failed:', invoice.id, msg)
              dbError = msg
            }
            ksefService.appendHistory({
              invoiceId: invoice.id,
              invoiceNumber: invoice.number ?? "",
              timestamp: new Date().toISOString(),
              action: 'send',
              status: 'success',
              ksefRef,
              error: dbError ? `DB update failed: ${dbError}` : null,
            })
            result.sent++
            result.items.push({ invoice, status: 'sent', ksefRef, dbError })
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
              let dbError: string | undefined
              try {
                await invoicesApi.update(
                  invoice.id,
                  { ksef_status: 'ksef_sent', ksef_ref: ksefRef },
                  companyId,
                )
              } catch (dbErr: unknown) {
                const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
                console.error('[useKsefQueue] CRITICAL: invoice sent to KSeF but DB update failed.', {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.number,
                  ksefRef,
                  dbError: msg,
                })
                dbError = msg
              }
              ksefService.appendHistory({
                invoiceId: invoice.id,
                invoiceNumber: invoice.number ?? "",
                timestamp: new Date().toISOString(),
                action: attempt > 1 ? 'retry' : 'send',
                status: 'success',
                ksefRef,
                error: dbError ? `DB update failed (invoice IS sent to KSeF): ${dbError}` : null,
              })
              result.sent++
              result.items.push({ invoice, status: 'sent', ksefRef, dbError })
              sent = true
            } catch (e: unknown) {
              lastError = e instanceof Error ? e.message : String(e)
              console.warn(`[useKsefQueue] sendInvoice failed (attempt ${attempt}/3):`, invoice.id, lastError)
            }
          }

          if (!sent) {
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_error' }, companyId)
            } catch (dbErr: unknown) {
              const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
              console.error('[useKsefQueue] Failed to mark ksef_error in DB (error-path):', invoice.id, msg)
            }
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
