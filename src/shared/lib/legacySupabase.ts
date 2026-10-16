import { calcInvoiceTotals } from '@/features/invoices/lib/invoice.calculations'
import { supabase } from '@/shared/lib/supabase'

export async function requireSupabaseUserId() {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Brak aktywnej sesji użytkownika')
  return data.user.id
}

export function sumInvoiceItems(items: Array<{ quantity: number; unit_price: number; vat_rate?: number }>) {
  const { totalNet, totalGross } = calcInvoiceTotals(items)
  return { totalNet, totalGross }
}
