
import type { SessionUser } from '@/app/providers'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { getFrontendEnvStatus } from '@/shared/lib/env'
import { hasSupabaseConfig, isDemoMode } from '@/shared/lib/supabase'

export interface DeployCheck {
  id: string
  label: string
  status: 'done' | 'warning' | 'blocked'
  hint: string
}

export function buildDeployChecks(input: {
  user: SessionUser | null
  ksefReady: boolean
  pendingInvitations: number
  portalLinks: number
}) : DeployCheck[] {
  const env = getFrontendEnvStatus()
  const planDef = input.user ? PLAN_DEFS[input.user.plan] : null

  return [
    {
      id: 'backend-mode',
      label: 'Tryb backendu',
      status: !isDemoMode && hasSupabaseConfig ? 'done' : 'warning',
      hint: !isDemoMode && hasSupabaseConfig ? 'Frontend widzi konfigurację Supabase.' : 'Aplikacja nadal może działać w trybie demo. Na staging ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.',
    },
    {
      id: 'public-base-url',
      label: 'Public base URL',
      status: env.hasPublicBaseUrl ? 'done' : 'warning',
      hint: env.hasPublicBaseUrl ? `Publiczny adres ustawiony: ${env.publicBaseUrl}` : 'Ustaw VITE_PUBLIC_BASE_URL przed stagingiem, aby linki portalu i zaproszeń były przewidywalne.',
    },
    {
      id: 'workspace-owner',
      label: 'Owner/Admin w workspace',
      status: input.user && ['owner', 'admin'].includes(input.user.role) ? 'done' : 'blocked',
      hint: input.user ? `Zalogowany użytkownik: ${input.user.role}` : 'Brak sesji. Zaloguj właściciela firmy albo admina przed deployem.',
    },
    {
      id: 'plan-fit',
      label: 'Plan i funkcje premium',
      status: input.user && ['pro', 'business', 'admin'].includes(input.user.plan) ? 'done' : 'warning',
      hint: planDef ? `Plan ${planDef.name}: ${planDef.features.join(', ')}` : 'Brak informacji o planie.',
    },
    {
      id: 'team-invitations',
      label: 'Zaproszenia zespołu',
      status: input.pendingInvitations === 0 ? 'done' : 'warning',
      hint: input.pendingInvitations === 0 ? 'Brak zaległych zaproszeń do akceptacji.' : `${input.pendingInvitations} zaproszeń wisi nadal jako pending.`,
    },
    {
      id: 'portal-links',
      label: 'Linki portalu klienta',
      status: input.portalLinks > 0 ? 'done' : 'warning',
      hint: input.portalLinks > 0 ? `${input.portalLinks} aktywnych linków portalu.` : 'Brak aktywnych linków portalu — sprawdź generator linków i wygasanie tokenów.',
    },
    {
      id: 'ksef',
      label: 'KSeF readiness',
      status: input.ksefReady ? 'done' : 'warning',
      hint: input.ksefReady ? 'Dane KSeF są już ustawione.' : 'Brakuje tokenu/NIP lub finalnego proxy pod KSeF.',
    },
  ]
}
