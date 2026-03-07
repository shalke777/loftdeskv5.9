import type { EstimateItem } from '@/entities/estimate/model'

export function calcItemGross(item: Pick<EstimateItem, 'unit_price' | 'quantity' | 'vat_rate'>): number {
  const net = item.unit_price * item.quantity
  return net * (1 + item.vat_rate / 100)
}

export function calcTotals(items: EstimateItem[]) {
  const net = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const gross = items.reduce((sum, item) => sum + calcItemGross(item), 0)
  return { net: round2(net), gross: round2(gross) }
}

const round2 = (value: number) => Math.round(value * 100) / 100
