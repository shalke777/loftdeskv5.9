import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { REQUIRED_VERSIONS } from '@/features/legal/config/legalDocuments'

export interface AcceptanceRecord {
  document_key: string
  document_version: string
  accepted_at: string
  source: string
  accepted_b2b_statement: boolean
}

export interface SaveInput {
  userId: string
  companyId: string | null
  documentKey: string
  documentVersion: string
  source: 'signup' | 'login' | 'checkout' | 'settings' | 'gate' | 'first_login' | 'version_update'
  acceptedB2bStatement?: boolean
}

// In demo mode we keep acceptances in memory per session (they are not persisted
// across hard reloads, which is fine — demo doesn't have a real DB).
const demoAcceptances: AcceptanceRecord[] = []

export const legalApi = {
  /**
   * Fetch all acceptance records for the authenticated user.
   * Throws on backend errors so react-query can track the error state
   * and the gate can distinguish "no acceptances" from "backend broken".
   */
  async getAcceptances(): Promise<AcceptanceRecord[]> {
    if (isDemoMode || !supabase) return demoAcceptances

    const { data, error } = await supabase
      .from('legal_acceptances')
      .select('document_key, document_version, accepted_at, source, accepted_b2b_statement')
      .order('accepted_at', { ascending: false })

    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[legal] getAcceptances error', error.code, error.message)
      }
      throw new Error(`legal_acceptances query failed: ${error.code ?? 'UNKNOWN'}`)
    }
    return (data ?? []) as AcceptanceRecord[]
  },

  /**
   * Save one acceptance record per required document in a single upsert.
   * Returns true on success, throws on failure so the gate can block
   * the user if the DB write fails.
   */
  async saveAcceptances(inputs: SaveInput[]): Promise<true> {
    if (isDemoMode || !supabase) {
      for (const inp of inputs) {
        demoAcceptances.push({
          document_key: inp.documentKey,
          document_version: inp.documentVersion,
          accepted_at: new Date().toISOString(),
          source: inp.source,
          accepted_b2b_statement: inp.acceptedB2bStatement ?? false,
        })
      }
      return true
    }

    const rows = inputs.map((inp) => ({
      user_id: inp.userId,
      // Null-out company_id when it equals user_id — that's the legacy
      // resolveSupabaseSession fallback value and won't exist in companies.
      // With the new get_session_context() architecture this guard rarely fires,
      // but we keep it for safety.
      company_id: (inp.companyId && inp.companyId !== inp.userId) ? inp.companyId : null,
      document_key: inp.documentKey,
      document_version: inp.documentVersion,
      source: inp.source,
      accepted_b2b_statement: inp.acceptedB2bStatement ?? false,
      user_agent:
        typeof navigator !== 'undefined'
          ? navigator.userAgent.slice(0, 512)
          : null,
    }))

    const { error } = await supabase
      .from('legal_acceptances')
      .upsert(rows, { onConflict: 'user_id,document_key,document_version' })

    if (error) {
      if (import.meta.env.DEV) {
        console.error('[legal] saveAcceptances error', error.code, error.message, error.details, 'rows:', rows.map(r => ({ user_id: r.user_id, company_id: r.company_id, doc: r.document_key })))
      }

      // FK violation on company_id (23503): company not yet committed or was
      // removed.  Retry without company_id — the acceptance is personal to the
      // user and remains auditable via user_id alone.
      if (error.code === '23503') {
        const rowsWithoutCompany = rows.map((r) => ({ ...r, company_id: null }))
        const { error: retryError } = await supabase
          .from('legal_acceptances')
          .upsert(rowsWithoutCompany, { onConflict: 'user_id,document_key,document_version' })
        if (retryError) {
          if (import.meta.env.DEV) {
            console.error('[legal] saveAcceptances retry error', retryError.code, retryError.message)
          }
          throw new Error(`Nie udało się zapisać akceptacji (${retryError.code ?? 'UNKNOWN'}). Spróbuj ponownie.`)
        }
        if (import.meta.env.DEV) {
          console.log('[legal] saveAcceptances retry OK (company_id=null)', rowsWithoutCompany.map((r) => `${r.document_key}@${r.document_version}`))
        }
        return true
      }

      throw new Error(`Nie udało się zapisać akceptacji (${error.code ?? 'UNKNOWN'}). Spróbuj ponownie.`)
    }

    if (import.meta.env.DEV) {
      console.log('[legal] saveAcceptances OK', rows.map((r) => `${r.document_key}@${r.document_version}`))
    }
    return true
  },

  /**
   * Pure DB guard: does any legal_acceptance row exist for (user_id, company_id)?
   *
   * Architectural invariant (Sprint final hardening):
   *   user can access company dashboard
   *   IFF legal_acceptances(user_id, company_id) EXISTS
   *
   * No flow heuristics (signup/invite/version_update) — the gate cares only
   * about presence of consent for the active company.
   */
  async hasCompanyAcceptance(companyId: string): Promise<boolean> {
    if (isDemoMode || !supabase) {
      return demoAcceptances.length > 0
    }
    const { data, error } = await supabase
      .from('legal_acceptances')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()
    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[legal] hasCompanyAcceptance error', error.code, error.message)
      }
      // Fail-open: do NOT permanently block the user on transient errors.
      return true
    }
    return Boolean(data)
  },

  /**
   * Given the list of acceptance records already in the DB, return the
   * set of required document keys whose *current* version hasn't been accepted.
   */
  getMissingRequired(acceptances: AcceptanceRecord[]): string[] {
    const acceptedSet = new Set(
      acceptances.map((a) => `${a.document_key}@${a.document_version}`),
    )
    return Object.entries(REQUIRED_VERSIONS)
      .filter(([key, version]) => !acceptedSet.has(`${key}@${version}`))
      .map(([key]) => key)
  },
}
