import { AdminPage } from '@/features/admin/components/AdminPage'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'

export function AdminRoutePage() {
  const allowed = useFeatureAccess('admin')
  if (!allowed) return <AccessNotice title="Panel admina" description="Ten moduł jest przeznaczony wyłącznie dla operatora LoftDesk." />
  return <AdminPage />
}
