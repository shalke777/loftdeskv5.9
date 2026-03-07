import { useAuth } from '@/features/auth/hooks/useAuth'
import { useSettings } from '@/features/settings/hooks/useSettings'

export interface CompanyMetaForDocs {
  name?: string
  nip?: string
  address?: string
  postalCity?: string
  email?: string
  phone?: string
  bankAccount?: string
}

/**
 * Returns company/contractor details from the saved profile.
 * Used to auto-populate PDF documents (estimates, invoices, contracts).
 */
export function useCompanyMeta(): CompanyMetaForDocs {
  const { user } = useAuth()
  const { profile } = useSettings()
  const p = profile as any

  const postalCity = [p?.postal_code, p?.city].filter(Boolean).join(' ').trim()

  return {
    name: p?.company_name || p?.name || p?.company || user?.companyName || '',
    nip: p?.nip || p?.ksef_nip || '',
    address: p?.address || '',
    postalCity: postalCity || '',
    email: p?.email || user?.email || '',
    phone: p?.phone || '',
    bankAccount: p?.iban || '',
  }
}
