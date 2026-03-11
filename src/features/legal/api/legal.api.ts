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
   * Returns an empty array on error rather than throwing, so the gate
   * can treat "unknown" as "not yet accepted" (safe default).
   */
  async getAcceptances(): Promise<AcceptanceRecord[]> {
    if (isDemoMode || !supabase) return demoAcceptances

    const { data, error } = await supabase
      .from('legal_acceptances')
      .select('document_key, document_version, accepted_at, source, accepted_b2b_statement')
      .order('accepted_at', { ascending: false })

    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[legal] getAcceptances error — treating as no acceptances', error.message)
      }
      return []
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
      company_id: inp.companyId ?? null,
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
        console.error('[legal] saveAcceptances error', error.message)
      }
      throw new Error('Nie udało się zapisać akceptacji dokumentów. Spróbuj ponownie.')
    }

    if (import.meta.env.DEV) {
      console.log('[legal] saveAcceptances OK', rows.map((r) => `${r.document_key}@${r.document_version}`))
    }
    return true
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
