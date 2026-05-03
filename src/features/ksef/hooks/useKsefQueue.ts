import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { ksefService, validateNip } from '@/services/ksef/ksef.service'
import { logKsefEvent } from '@/features/ksef/lib/ksefEvents'
import type { KsefSession } from './useKsefSession'
import type { Invoice } from '@/entities/invoice/model'

export interface QueueItemResult {
  invoice: Invoice
  status: 'sent' | 'error' | 'skipped'
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
  skipped: number
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
      const result: ProcessResult = { total: pending.length, sent: 0, errors: 0, skipped: 0, items: [] }

      try {
        // Empty queue — finish immediately
        if (pending.length === 0) {
          setLastResult(result)
          return result
        }

        for (const invoice of pending) {
          // ── Idempotency guard ────────────────────────────────────────────
          // Never re-send an invoice that already has a KSeF reference. To
          // force a re-send the operator must explicitly clear ksef_ref in DB.
          if (invoice.ksef_ref) {
            console.info('[useKsefQueue] Skipping send, already has ksef_ref:', { invoiceId: invoice.id, ksefRef: invoice.ksef_ref })
            void logKsefEvent({ companyId, invoiceId: invoice.id, action: 'skip_idempotent', ksefRef: invoice.ksef_ref, env: session.env as 'demo' | 'test' | 'prod', message: 'Invoice already has ksef_ref — skipped' })
            // Self-heal: if ksef_status drifted out of ksef_sent despite having a ref
            if (invoice.ksef_status !== 'ksef_sent') {
              try {
                await invoicesApi.update(invoice.id, { ksef_status: 'ksef_sent', ksef_last_error: null } as Partial<Invoice>, companyId)
              } catch (e) {
                console.warn('[useKsefQueue] self-heal status failed:', e)
              }
            }
            result.skipped++
            result.items.push({ invoice, status: 'skipped', ksefRef: invoice.ksef_ref })
            continue
          }

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

          // ── Pre-flight guards: never attempt KSeF send for invoices that
          //    can't possibly succeed. Record the reason in ksef_last_error.
          const guardErrors: string[] = []
          if (!invoice.company_id) guardErrors.push('Brak company_id — faktura niepowiązana z firmą.')
          if (!seller.nip) guardErrors.push('Brak NIP sprzedawcy — uzupełnij dane firmy w Ustawieniach.')
          if (seller.nip && !validateNip(seller.nip)) guardErrors.push(`Nieprawidłowy NIP sprzedawcy (${seller.nip}) — błąd sumy kontrolnej. Popraw NIP w Ustawieniach.`)
          if (!seller.name) guardErrors.push('Brak nazwy sprzedawcy — uzupełnij dane firmy w Ustawieniach.')
          if (!buyer.name && !buyer.nip) guardErrors.push('Brak danych nabywcy — przypisz klienta do faktury.')
          if (buyer.nip && !validateNip(buyer.nip)) guardErrors.push(`Nieprawidłowy NIP nabywcy (${buyer.nip}) — błąd sumy kontrolnej. Popraw NIP klienta przed wysłaniem do KSeF.`)
          if (!invoice.number) guardErrors.push('Faktura jest szkicem (brak numeru) — najpierw ją wystaw.')
          if (guardErrors.length > 0) {
            const reason = guardErrors.join(' ')
            console.warn('[useKsefQueue] pre-flight guard blocked:', invoice.id, reason)
            void logKsefEvent({ companyId, invoiceId: invoice.id, action: 'guard_block', env: session.env as 'demo' | 'test' | 'prod', message: reason, meta: { guards: guardErrors } })
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_error', ksef_last_error: reason } as Partial<Invoice>, companyId)
            } catch (dbErr: unknown) {
              const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
              console.error('[useKsefQueue] pre-flight DB update failed:', invoice.id, msg)
            }
            ksefService.appendHistory({
              invoiceId: invoice.id,
              invoiceNumber: invoice.number ?? '',
              timestamp: new Date().toISOString(),
              action: 'send',
              status: 'error',
              ksefRef: null,
              error: reason,
            })
            result.errors++
            result.items.push({ invoice, status: 'error', error: reason })
            continue
          }

          if (isDemo) {
            const ksefRef = `DEMO-${invoice.id.slice(0, 8)}-${Date.now().toString(36)}`
            let dbError: string | undefined
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_sent', ksef_ref: ksefRef, ksef_last_error: null } as Partial<Invoice>, companyId)
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

          // list() returns items:[] for perf — fetch full invoice with items before building XML
          let fullInvoice: Invoice = invoice
          try {
            const fetched = await invoicesApi.get(invoice.id, companyId)
            if (fetched && fetched.items.length > 0) {
              fullInvoice = fetched
            } else {
              console.warn('[useKsefQueue] get() returned no items for invoice', invoice.id, '— falling back to list data')
            }
          } catch (fetchErr) {
            console.warn('[useKsefQueue] get() failed, using list invoice (items may be empty):', fetchErr)
          }

          let sent = false
          let lastError = ''
          for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
            if (attempt > 1) {
              await new Promise<void>((r) => setTimeout(r, 1000 * 2 ** (attempt - 2)))
            }
            void logKsefEvent({ companyId, invoiceId: invoice.id, action: attempt > 1 ? 'retry' : 'send_attempt', attempt, env: session.env as 'demo' | 'test' | 'prod' })
            try {
              const { ksefRef, mfResponse } = await ksefService.sendInvoice(
                fullInvoice,
                seller,
                buyer,
                session,
                session.env,
              )
              let dbError: string | undefined
              try {
                await invoicesApi.update(
                  invoice.id,
                  { ksef_status: 'ksef_sent', ksef_ref: ksefRef, ksef_last_error: null } as Partial<Invoice>,
                  companyId,
                )
                console.info('[useKsefQueue] DB updated: ksef_sent', { invoiceId: invoice.id, ksefRef })
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
              void logKsefEvent({ companyId, invoiceId: invoice.id, action: 'send_success', attempt, ksefRef, env: session.env as 'demo' | 'test' | 'prod', message: dbError ? `KSeF OK; DB update failed: ${dbError}` : 'OK', meta: { mfResponse: mfResponse ?? null, sessionRef: session.referenceNumber } })
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
              console.error(`[useKsefQueue] sendInvoice failed (attempt ${attempt}/3):`, invoice.id, lastError)
              void logKsefEvent({ companyId, invoiceId: invoice.id, action: 'send_error', attempt, env: session.env as 'demo' | 'test' | 'prod', message: lastError })
            }
          }

          if (!sent) {
            try {
              await invoicesApi.update(invoice.id, { ksef_status: 'ksef_error', ksef_last_error: lastError || 'Wysyłka nie powiodła się po 3 próbach.' } as Partial<Invoice>, companyId)
              console.info('[useKsefQueue] DB updated: ksef_error', { invoiceId: invoice.id, error: lastError })
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

        // ── Post-send: auto-close session + verify per-invoice MF status ────
        // KSeF v2: HTTP 202 from POST /invoices means "accepted to session
        // queue", NOT "validated". Real schema validation happens only after
        // the session is closed. Without this step a schema-rejected invoice
        // looks "ksef_sent" in our DB but never appears in KSeF Aplikacja
        // Podatnika. This block fixes that silent-failure mode.
        if (!isDemo && result.sent > 0 && session.referenceNumber && session.sessionToken) {
          const env = session.env as 'demo' | 'test' | 'prod'
          try {
            await ksefService.closeSession(session.sessionToken, session.referenceNumber, env)
            void logKsefEvent({ companyId, invoiceId: null, action: 'session_close', env, message: 'Session closed for validation', meta: { sessionRef: session.referenceNumber, sentCount: result.sent } })
          } catch (closeErr: unknown) {
            const msg = closeErr instanceof Error ? closeErr.message : String(closeErr)
            console.warn('[useKsefQueue] closeSession failed (non-fatal):', msg)
            void logKsefEvent({ companyId, invoiceId: null, action: 'session_close', env, message: `close failed: ${msg}`, meta: { sessionRef: session.referenceNumber, error: msg } })
          }

          // Give MF a moment to run schema validation before polling.
          await new Promise<void>((r) => setTimeout(r, 3000))

          for (const item of result.items) {
            if (item.status !== 'sent' || !item.ksefRef) continue
            try {
              const upo = await ksefService.fetchUpo(
                item.ksefRef,
                session.sessionToken,
                env,
                session.referenceNumber,
              )
              const statusCode = upo.statusCode as number | null | undefined
              const statusDesc = (upo.statusDescription as string | null | undefined) ?? null
              const ksefNumber = (upo.ksefReferenceNumber as string | null | undefined) ?? null

              void logKsefEvent({ companyId, invoiceId: item.invoice.id, action: 'session_close_check', env, ksefRef: item.ksefRef, message: `status=${statusCode ?? 'null'} ${statusDesc ?? ''}`, meta: { statusCode, statusDescription: statusDesc, ksefNumber } })

              if (statusCode === 200) {
                if (ksefNumber && ksefNumber !== item.ksefRef) {
                  try {
                    await invoicesApi.update(item.invoice.id, { ksef_number: ksefNumber } as Partial<Invoice>, companyId)
                  } catch (e) {
                    console.warn('[useKsefQueue] persist ksef_number failed:', e)
                  }
                }
                void logKsefEvent({ companyId, invoiceId: item.invoice.id, action: 'validation_ok', env, ksefRef: item.ksefRef, message: 'MF validated', meta: { ksefNumber } })
              } else if (statusCode != null && statusCode !== 200) {
                // MF rejected this invoice at validation. Flip status back so the
                // operator sees it red and knows to fix + resend.
                const reason = `KSeF odrzucił fakturę przy walidacji schematu (status ${statusCode}). ${statusDesc ?? ''}`.trim()
                try {
                  await invoicesApi.update(
                    item.invoice.id,
                    { ksef_status: 'ksef_error', ksef_last_error: reason, ksef_ref: null } as Partial<Invoice>,
                    companyId,
                  )
                } catch (e) {
                  console.error('[useKsefQueue] mark validation_error in DB failed:', e)
                }
                void logKsefEvent({ companyId, invoiceId: item.invoice.id, action: 'validation_error', env, ksefRef: item.ksefRef, message: reason, meta: { statusCode, statusDescription: statusDesc } })
                // Reflect in the in-memory result so the UI summary is honest.
                item.status = 'error'
                item.error = reason
                result.sent = Math.max(0, result.sent - 1)
                result.errors += 1
              }
              // statusCode == null → MF still processing; UI keeps "sent" (yellow)
            } catch (verifyErr: unknown) {
              const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
              console.warn('[useKsefQueue] post-close verify failed for', item.invoice.id, msg)
              void logKsefEvent({ companyId, invoiceId: item.invoice.id, action: 'session_close_check', env, ksefRef: item.ksefRef, message: `verify failed: ${msg}` })
            }
          }
          qc.invalidateQueries({ queryKey: ['invoices'] })
        }

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
