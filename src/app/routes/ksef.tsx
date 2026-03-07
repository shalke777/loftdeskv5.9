import { KsefPage } from '@/features/ksef/components/KsefPage'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { useNavigate } from '@tanstack/react-router'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'

export function KsefRoutePage() {
  const allowed = useFeatureAccess('ksef')
  const navigate = useNavigate()
  if (!allowed) return <AccessNotice title="KSeF w planie Pro/Business" description="Integracja KSeF jest dostępna od planu Pro dla ról owner/admin/manager/accountant." actionLabel="Przejdź do billing" onAction={() => navigate({ to: '/billing' })} />
  return <KsefPage />
}
