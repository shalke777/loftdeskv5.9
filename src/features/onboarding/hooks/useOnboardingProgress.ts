// =============================================================================
// useOnboardingProgress — computes onboarding checklist state
// =============================================================================
// Works in both demo and Supabase modes.
// In demo mode: wraps demoDb.onboardingSummary().
// In Supabase mode: fetches counts from billing API + profile check.
// =============================================================================

import { useQuery } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { billingApi } from '@/features/billing/api/billing.api'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'

export interface OnboardingStep {
  key: string
  label: string
  description: string
  done: boolean
  href: string
  cta: string
}

export interface OnboardingProgress {
  steps: OnboardingStep[]
  done: number
  total: number
  progress: number   // 0–100
  isComplete: boolean
  isEmpty: boolean   // true when account has literally no operational data
}

const STEP_META: Record<string, { label: string; description: string; href: string; cta: string }> = {
  companyProfile: {
    label: 'Uzupełnij profil firmy',
    description: 'Dodaj nazwę, adres i dane kontaktowe.',
    href: '/settings',
    cta: 'Otwórz ustawienia',
  },
  firstClient: {
    label: 'Dodaj pierwszego klienta',
    description: 'Klienci to fundament — adresy, NIP-y, kontakty.',
    href: '/clients',
    cta: 'Dodaj klienta',
  },
  firstEstimate: {
    label: 'Stwórz pierwszy kosztorys',
    description: 'Przygotuj ofertę gotową do wydruku i akceptacji.',
    href: '/estimates',
    cta: 'Nowy kosztorys',
  },
  projects: {
    label: 'Utwórz pierwszy projekt',
    description: 'Projekt łączy klienta, koszty, dokumenty i portal.',
    href: '/projects',
    cta: 'Nowy projekt',
  },
  portal: {
    label: 'Uruchom portal klienta',
    description: 'Klient dostaje swój widok bez logowania do systemu.',
    href: '/projects',
    cta: 'Otwórz projekty',
  },
}

// Ordered steps displayed to user (simplified subset of full onboarding)
const ORDERED_STEPS = ['companyProfile', 'firstClient', 'firstEstimate', 'projects', 'portal']

export function useOnboardingProgress() {
  const companyId = useCompanyId()

  return useQuery<OnboardingProgress>({
    queryKey: ['onboarding-progress', companyId],
    queryFn: async (): Promise<OnboardingProgress> => {
      if (isDemoMode || !companyId) {
        const summary = demoDb.onboardingSummary(companyId)
        if (!summary) {
          return { steps: [], done: 0, total: ORDERED_STEPS.length, progress: 0, isComplete: false, isEmpty: true }
        }
        const checks: Record<string, boolean> = summary.checks
        const steps = buildSteps(checks)
        const done = steps.filter((s) => s.done).length
        const isEmpty = summary.counts.clients === 0 && summary.counts.projects === 0 && summary.counts.estimates === 0
        return {
          steps,
          done,
          total: steps.length,
          progress: Math.round((done / steps.length) * 100),
          isComplete: done === steps.length,
          isEmpty,
        }
      }

      // Supabase mode: derive from billing summary + portal check
      const billing = await billingApi.summary(companyId)

      let portalDone = false
      try {
        if (supabase) {
          const { count } = await supabase
            .from('project_portal_tokens')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('active', true)
          portalDone = (count ?? 0) > 0
        }
      } catch {
        // table may not exist in older deployments — treat as not done
      }

      const checks: Record<string, boolean> = {
        companyProfile: Boolean(billing.companyName && billing.companyName !== 'LoftDesk Workspace'),
        firstClient: billing.usage.clients > 0,
        firstEstimate: billing.usage.estimates > 0,
        projects: billing.usage.projects > 0,
        portal: portalDone,
      }
      const steps = buildSteps(checks)
      const done = steps.filter((s) => s.done).length
      const isEmpty =
        billing.usage.clients === 0 &&
        billing.usage.projects === 0 &&
        billing.usage.estimates === 0
      return {
        steps,
        done,
        total: steps.length,
        progress: Math.round((done / steps.length) * 100),
        isComplete: done === steps.length,
        isEmpty,
      }
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
}

function buildSteps(checks: Record<string, boolean>): OnboardingStep[] {
  return ORDERED_STEPS.map((key) => ({
    key,
    done: Boolean(checks[key]),
    ...STEP_META[key],
  }))
}
