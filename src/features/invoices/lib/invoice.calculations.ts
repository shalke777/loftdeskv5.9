import type { InvoiceItem } from '@/entities/invoice/model'

export function calcInvoiceTotals(items: InvoiceItem[]) {
  const totalNet = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const totalGross = items.reduce((sum, item) => sum + item.quantity * item.unit_price * (1 + item.vat_rate / 100), 0)
  return {
    totalNet: Math.round(totalNet * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
  }
}
