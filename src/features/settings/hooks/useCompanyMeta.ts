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
  logoUrl?: string
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

  // Defensive: try every plausible column name. The DB might use `iban`,
  // `bank_account`, or `account_number` depending on which migration shipped.
  const bankAccount =
    p?.iban ||
    p?.bank_account ||
    p?.bankAccount ||
    p?.account_number ||
    p?.accountNumber ||
    ''

  if (import.meta.env.DEV && profile && !bankAccount) {
    // One-time diagnostic so the user can see WHY the contract shows the
    // "uzupełnij w ustawieniach" placeholder. Lists every field on profile so
    // we can identify the actual column name in their schema.
    console.warn('[useCompanyMeta] bankAccount EMPTY — profile keys =', Object.keys(p || {}), 'profile =', p)
  }

  return {
    name: p?.company_name || p?.name || p?.company || user?.companyName || '',
    nip: p?.nip || p?.ksef_nip || '',
    address: p?.address || '',
    postalCity: postalCity || '',
    email: p?.email || user?.email || '',
    phone: p?.phone || '',
    bankAccount,
    logoUrl: p?.logo_url || '',
  }
}
