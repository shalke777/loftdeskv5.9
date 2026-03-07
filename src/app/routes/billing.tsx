import { BillingPage } from '@/features/billing/components/BillingPage'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'

export function BillingRoutePage() {
  const allowed = useFeatureAccess('billing')
  if (!allowed) return <AccessNotice title="Billing tylko dla owner/admin" description="Zmiana planu, limity i rozliczenia są dostępne dla właściciela firmy lub operatora platformy." />
  return <BillingPage />
}
