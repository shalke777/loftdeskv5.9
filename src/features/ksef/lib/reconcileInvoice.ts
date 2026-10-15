import type { Invoice } from '@/entities/invoice/model'
import type { KsefSession } from '../hooks/useKsefSession'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { ksefService } from '@/services/ksef/ksef.service'

/** Verify a known submission; never POST an invoice or infer acceptance from its reference. */
export async function reconcileInvoice(invoice: Invoice, session: KsefSession, companyId: string) {
  if (!invoice.ksef_ref || !invoice.ksef_session_ref || !invoice.ksef_env) {
    throw new Error('Brak danych pierwotnej wysyłki — wymagana weryfikacja historii KSeF.')
  }
  if (invoice.company_id !== companyId || invoice.ksef_env !== session.env || session.isDemo) {
    throw new Error('Sesja KSeF nie odpowiada firmie lub środowisku faktury.')
  }
  const raw = await ksefService.fetchUpo(invoice.ksef_ref, session.sessionToken, invoice.ksef_env, invoice.ksef_session_ref)
  const code = typeof raw.statusCode === 'number' ? raw.statusCode : null
  const number = code === 200 && typeof raw.ksefReferenceNumber === 'string' && raw.ksefReferenceNumber.trim()
    ? raw.ksefReferenceNumber : null
  const status = number ? 'sent' : code != null && code >= 400 ? 'error' : 'pending'
  const reason = status === 'error'
    ? `KSeF odrzucił fakturę (status ${code}). ${typeof raw.statusDescription === 'string' ? raw.statusDescription : ''}`.trim()
    : null
  await invoicesApi.update(invoice.id, {
    ksef_ref: invoice.ksef_ref,
    ksef_session_ref: invoice.ksef_session_ref,
    ksef_env: invoice.ksef_env,
    ksef_status: status === 'sent' ? 'ksef_sent' : status === 'error' ? 'ksef_error' : 'ksef_pending',
    ksef_number: number,
    ksef_status_code: code,
    ksef_checked_at: new Date().toISOString(),
    ksef_last_error: reason,
  }, companyId)
  return { status, code, number, reason } as const
}
