import { useAuthContext } from '@/app/providers'
import { canAccessFeature, canPerformAction, type AppAction, type AppFeature } from '@/shared/lib/permissions'

export function usePermissions() {
  const { user } = useAuthContext()
  return {
    user,
    canAccessFeature: (feature: AppFeature) => canAccessFeature(user, feature),
    can: (action: AppAction) => canPerformAction(user, action),
  }
}

export function useFeatureAccess(feature: AppFeature) {
  const { canAccessFeature } = usePermissions()
  return canAccessFeature(feature)
}

export function useCan(action: AppAction) {
  const { can } = usePermissions()
  return can(action)
}
