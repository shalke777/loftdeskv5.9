import { useCreateInvoiceFromEstimate } from '@/features/invoices/hooks/useInvoices'

export function useEstimateToInvoice() {
  return useCreateInvoiceFromEstimate()
}
