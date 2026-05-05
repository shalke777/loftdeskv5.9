import { z } from 'zod'

export const InvoiceItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  unit: z.string().default('kpl'),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  vat_rate: z.number().min(0).max(100).default(23),
  sort_order: z.number().int(),
  tranche_label: z.string().optional(),
})

export const InvoiceSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  client_id: z.string().nullable(),
  project_id: z.string().nullable(),
  contract_id: z.string().nullable().optional(),
  tranche_id: z.string().nullable().optional(),
  /** null for drafts — assigned at issuance */
  number: z.string().nullable(),
  /** Rodzaj faktury: standardowa / zaliczkowa / końcowa / częściowa / korekta */
  invoice_type: z.enum(['standard', 'advance', 'final', 'partial', 'correction']).optional(),
  /** ID oryginalnej faktury, do której wystawiono korektę */
  corrected_invoice_id: z.string().nullable().optional(),
  /** Powód korekty (wymagany przy invoice_type === 'correction') */
  correction_reason: z.string().nullable().optional(),
  status: z.enum(['draft', 'unpaid', 'paid', 'overdue']),
  issue_date: z.string(),
  /** Data sprzedaży / wykonania usługi */
  sale_date: z.string().nullable().optional(),
  /** Miejsce wystawienia faktury */
  issue_place: z.string().nullable().optional(),
  due_date: z.string().nullable(),
  /** Forma płatności */
  payment_method: z.enum(['transfer', 'cash', 'card']).optional(),
  /** Opcjonalne nadpisanie rachunku bankowego firmy na tej fakturze */
  bank_account: z.string().nullable().optional(),
  /** Pozycje oryginalne przed korektą — tylko dla faktur korygujących */
  original_items: z.array(InvoiceItemSchema).nullable().optional(),
  /** Snapshot pól nagłówkowych przed korektą (klient, daty, płatność) */
  original_data: z.record(z.string().nullable()).nullable().optional(),
  /** Suma wcześniejszych zaliczek – używana przy fakturze końcowej */
  advance_total: z.number().nullable().optional(),
  total_net: z.number(),
  total_gross: z.number(),
  ksef_status: z.enum(['ksef_sent', 'ksef_pending', 'ksef_error']).nullable(),
  ksef_ref: z.string().nullable(),
  ksef_last_error: z.string().nullable().optional(),
  /** Final KSeF invoice number assigned by MF after session-close + schema validation.
   *  Distinct from ksef_ref (session-element ref). NULL until validation passes. */
  ksef_number: z.string().nullable().optional(),
  notes: z.string().optional(),
  created_at: z.string(),
  items: z.array(InvoiceItemSchema),
  serverId: z.string().optional(),
  _optimistic: z.boolean().optional(),
})

export type Invoice = z.infer<typeof InvoiceSchema>
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>
export type CreateInvoiceInput = Pick<Invoice, 'client_id' | 'project_id' | 'contract_id' | 'notes' | 'status'> & {
  /** When true, skips number assignment — invoice saved as draft */
  draft?: boolean
  company_id: string
  items: InvoiceItem[]
  issue_date: string
  sale_date?: string | null
  issue_place?: string | null
  due_date: string | null
  invoice_type?: Invoice['invoice_type']
  payment_method?: Invoice['payment_method']
  bank_account?: string | null
  tranche_id?: string | null
  advance_total?: number | null
  corrected_invoice_id?: string | null
  correction_reason?: string | null
  original_items?: InvoiceItem[] | null
  original_data?: Record<string, string | null> | null
}
