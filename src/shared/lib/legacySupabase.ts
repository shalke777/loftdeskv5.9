import { supabase } from '@/shared/lib/supabase'

export async function requireSupabaseUserId() {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Brak aktywnej sesji użytkownika')
  return data.user.id
}

export function sumInvoiceItems(items: Array<{ quantity: number; unit_price: number; vat_rate?: number }>) {
  const totalNet = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0)
  const totalGross = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) * (1 + Number(item.vat_rate ?? 23) / 100), 0)
  return { totalNet: Math.round(totalNet * 100) / 100, totalGross: Math.round(totalGross * 100) / 100 }
}
