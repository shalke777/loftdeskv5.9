import type { SessionUser } from '@/app/providers'
import type { DeployCheck } from '@/shared/lib/deployReadiness'
import type { ReadinessCheck } from '@/shared/lib/releaseReadiness'
import { getFrontendEnvStatus } from '@/shared/lib/env'

export interface FinalProductionInput {
  user: SessionUser | null
  workspaceChecks: ReadinessCheck[]
  deployChecks: DeployCheck[]
  hasCutoverSqlPack: boolean
  hasReleaseDocs: boolean
  hasPortalCoverage: boolean
}

export interface FinalGate {
  id: string
  label: string
  status: 'done' | 'warning' | 'blocked'
  hint: string
}

export function buildFinalProductionGates(input: FinalProductionInput): FinalGate[] {
  const env = getFrontendEnvStatus()
  const blockedWorkspace = input.workspaceChecks.filter((item) => item.status === 'blocked').length
  const blockedDeploy = input.deployChecks.filter((item) => item.status === 'blocked').length
  const warningWorkspace = input.workspaceChecks.filter((item) => item.status === 'warning').length
  const warningDeploy = input.deployChecks.filter((item) => item.status === 'warning').length

  return [
    {
      id: 'workspace',
      label: 'Workspace bez blokad',
      status: blockedWorkspace === 0 ? (warningWorkspace ? 'warning' : 'done') : 'blocked',
      hint: blockedWorkspace === 0 ? (warningWorkspace ? `Brak blokad, ale zostało ${warningWorkspace} uwag.` : 'Workspace nie ma już blokad operacyjnych.') : `${blockedWorkspace} blokad w readiness workspace'u.`,
    },
    {
      id: 'deploy',
      label: 'Deploy checks przechodzą',
      status: blockedDeploy === 0 ? (warningDeploy ? 'warning' : 'done') : 'blocked',
      hint: blockedDeploy === 0 ? (warningDeploy ? `Deploy może przejść, ale zostało ${warningDeploy} uwag.` : 'Deploy checks są zielone.') : `${blockedDeploy} blokad w deploy checks.`,
    },
    {
      id: 'auth-owner',
      label: 'Owner/Admin prowadzi cutover',
      status: input.user && ['owner', 'admin'].includes(input.user.role) ? 'done' : 'blocked',
      hint: input.user ? `Sesja: ${input.user.role} / ${input.user.email}` : 'Brak aktywnej sesji owner/admin.',
    },
    {
      id: 'supabase-mode',
      label: 'Środowisko produkcyjne nie działa wyłącznie na demo mode',
      status: env.mode === 'supabase-first' ? 'done' : 'warning',
      hint: env.mode === 'supabase-first' ? 'Frontend jest gotowy pod Supabase-first runtime.' : 'Możesz dalej pracować w demo, ale finalne wdrożenie wymaga konfiguracji Supabase env.',
    },
    {
      id: 'cutover-pack',
      label: 'Pakiet cutover istnieje',
      status: input.hasCutoverSqlPack ? 'done' : 'blocked',
      hint: input.hasCutoverSqlPack ? 'Snapshot / verify / smoke / migration SQL są w repo.' : 'Brakuje pełnego pakietu SQL do przejścia v3 -> v5.2.',
    },
    {
      id: 'release-docs',
      label: 'Runbook i checklisty release są gotowe',
      status: input.hasReleaseDocs ? 'done' : 'warning',
      hint: input.hasReleaseDocs ? 'Repo zawiera runbook i checklisty finalnego wydania.' : 'Dodaj lub uzupełnij release docs przed cutover.',
    },
    {
      id: 'portal',
      label: 'Portal klienta jest objęty finalnym smoke',
      status: input.hasPortalCoverage ? 'done' : 'warning',
      hint: input.hasPortalCoverage ? 'Portal, linki i wygaszanie są objęte finalnym pakietem.' : 'Brakuje finalnej kontroli portalu klienta.',
    },
  ]
}

export function getFinalProductionVerdict(gates: FinalGate[]): 'blocked' | 'warning' | 'ready' {
  if (gates.some((gate) => gate.status === 'blocked')) return 'blocked'
  if (gates.some((gate) => gate.status === 'warning')) return 'warning'
  return 'ready'
}
