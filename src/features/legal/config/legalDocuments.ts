// =============================================================================
// Legal Documents — version registry
// When you bump a version here, logged-in users will be presented with the
// acceptance gate on their next app load until they re-accept.
// =============================================================================

export interface LegalDocument {
  key: string
  version: string
  effectiveDate: string   // YYYY-MM-DD
  label: string           // human-readable Polish label
  path: string | null     // relative URL inside the app, null = no standalone page
  required: boolean       // required for app access; optional = informational only
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    key: 'regulamin',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Regulamin świadczenia usług',
    path: '/legal/regulamin',
    required: true,
  },
  {
    key: 'polityka-prywatnosci',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Polityka prywatności',
    path: '/legal/polityka-prywatnosci',
    required: true,
  },
  {
    key: 'dpa',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Umowa powierzenia przetwarzania danych (DPA)',
    path: '/legal/dpa',
    required: true,
  },
  {
    key: 'b2b-statement',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Oświadczenie B2B (konto przedsiębiorcy)',
    path: null,
    required: true,
  },
  // ── Informational only — no re-acceptance gate ──────────────────────────────
  {
    key: 'polityka-cookies',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Polityka cookies',
    path: '/legal/polityka-cookies',
    required: false,
  },
  {
    key: 'dpa-subprocesorzy',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Polityka subprocesorów',
    path: '/legal/subprocesorzy',
    required: false,
  },
  {
    key: 'zasady-platnosci',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Zasady płatności i subskrypcji',
    path: '/legal/zasady-platnosci',
    required: false,
  },
  {
    key: 'reklamacje',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Procedura reklamacyjna',
    path: '/legal/reklamacje',
    required: false,
  },
  {
    key: 'aup',
    version: '1.0',
    effectiveDate: '2026-03-11',
    label: 'Zasady Akceptowalnego Użytkowania (AUP)',
    path: '/legal/aup',
    required: false,
  },
]

// Quick lookups
export const REQUIRED_DOCS = LEGAL_DOCUMENTS.filter((d) => d.required)

export const LEGAL_DOC_BY_KEY = Object.fromEntries(
  LEGAL_DOCUMENTS.map((d) => [d.key, d]),
) as Record<string, LegalDocument>

// A compact "requirements map" used for DB queries & gate checks
export const REQUIRED_VERSIONS: Record<string, string> = Object.fromEntries(
  REQUIRED_DOCS.map((d) => [d.key, d.version]),
)
