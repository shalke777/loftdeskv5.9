import { useState } from 'react'
import { ExternalLink, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useLegalAcceptances, useMissingAcceptances, useSaveAcceptances } from '@/features/legal/hooks/useLegal'
import { useAuthContext } from '@/app/providers'
import { LEGAL_DOC_BY_KEY, REQUIRED_DOCS } from '@/features/legal/config/legalDocuments'
import type { SaveInput } from '@/features/legal/api/legal.api'

// ── sessionStorage helpers ────────────────────────────────────────────────────
// RegisterForm stores pending consents here after signup so the first-login
// gate can surface them pre-checked (signup flow) instead of being a blank gate.

/** Maps document_key → signup consent form key */
const DOC_TO_SIGNUP_KEY: Record<string, string> = {
  'regulamin': 'regulamin',
  'polityka-prywatnosci': 'prywatnosc',
  'dpa': 'dpa',
  'b2b-statement': 'b2b',
}

function readPendingSignup(): Record<string, boolean> | null {
  try {
    const raw = sessionStorage.getItem('loftdesk-pending-legal')
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : null
  } catch {
    return null
  }
}

function clearPendingSignup() {
  try { sessionStorage.removeItem('loftdesk-pending-legal') } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-screen blocking gate shown when a logged-in user hasn't accepted
 * the current versions of all required documents.
 *
 * Three scenarios handled:
 *  1. New user after email confirmation (signup pending in sessionStorage)
 *     → boxes are pre-checked, one click saves with source='signup'
 *  2. Existing user who never accepted (first_login)
 *     → blank gate, source='first_login'
 *  3. Existing user after a document version bump (version_update)
 *     → tailored messaging, source='version_update'
 */
export function LegalAcceptanceGate() {
  const { user, refreshSession } = useAuthContext()
  const { data: allAcceptances } = useLegalAcceptances()
  const missing = useMissingAcceptances()
  const saveAcceptances = useSaveAcceptances()

  // Pre-check boxes from signup pending consents if present
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const pending = readPendingSignup()
    if (!pending) return {}
    const init: Record<string, boolean> = {}
    for (const doc of REQUIRED_DOCS) {
      const signupKey = DOC_TO_SIGNUP_KEY[doc.key] ?? doc.key
      init[doc.key] = Boolean(pending[signupKey])
    }
    return init
  })

  // Zaproszeni klienci (rola 'client') nigdy nie akceptują dokumentów B2B / regulaminu
  // dla przedsiębiorców. Gate musi być wyłączony PRZED sprawdzeniem stanu ładowania,
  // żeby klient nie widział pełnoekranowego spinnera z legal-gate__backdrop.
  if (user?.role === 'client') return null

  // Block the app while loading — never grant access optimistically
  if (missing === undefined) {
    return (
      <div className="legal-gate__backdrop">
        <div className="legal-gate__card">
          <Spinner />
        </div>
      </div>
    )
  }

  // All required docs accepted — gate lifts
  if (missing.length === 0) return null

  const requiredMissing = REQUIRED_DOCS.filter((d) => missing.includes(d.key))
  const allChecked = requiredMissing.every((d) => checked[d.key])

  // ── Determine context ──────────────────────────────────────────────────────
  const signupPending = readPendingSignup()
  const priorAcceptancesExist = (allAcceptances?.length ?? 0) > 0

  const source: SaveInput['source'] = signupPending
    ? 'signup'           // new user — consents came from the registration form
    : priorAcceptancesExist
      ? 'version_update' // existing user — docs were updated since last acceptance
      : 'first_login'    // existing user — never accepted (legacy account)

  const isVersionUpdate = !signupPending && priorAcceptancesExist

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleAccept = async () => {
    if (!user || !allChecked) return

    const inputs = requiredMissing.map((doc) => ({
      userId: user.id,
      companyId: user.companyId ?? null,
      documentKey: doc.key,
      documentVersion: doc.version,
      source,
      acceptedB2bStatement: doc.key === 'b2b-statement',
    }))

    if (import.meta.env.DEV) {
      console.log('[legal gate] saving acceptances', inputs.map((i) => `${i.documentKey}@${i.documentVersion} source=${i.source}`))
    }

    try {
      await saveAcceptances.mutateAsync(inputs)
      clearPendingSignup()
      // Refresh session BEFORE the gate unmounts — ensures the auth context
      // has a valid company_id when the dashboard first renders.
      // Covers invited workers whose session resolved to null during legal gate.
      await refreshSession()
    } catch {
      // Error is handled by useSaveAcceptances onError (toast) + isError banner below
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="legal-gate__backdrop">
      <div className="legal-gate__card">
        <div className="legal-gate__icon">
          {isVersionUpdate ? <RefreshCw size={28} /> : <Shield size={28} />}
        </div>

        <h2 className="legal-gate__title">
          {isVersionUpdate
            ? 'Zaktualizowaliśmy warunki korzystania z LoftDesk'
            : 'Witaj w LoftDesk — wymagana akceptacja warunków'}
        </h2>

        <p className="legal-gate__subtitle">
          {isVersionUpdate
            ? 'Zaktualizowaliśmy treść poniższych dokumentów. Prosimy o ponowne zapoznanie się z nimi i potwierdzenie akceptacji.'
            : 'Zanim przejdziesz do aplikacji, zapoznaj się z poniższymi dokumentami i zaakceptuj ich postanowienia. LoftDesk jest przeznaczony wyłącznie dla przedsiębiorców.'}
        </p>

        {!isVersionUpdate && (
          <div className="legal-gate__notice">
            LoftDesk jest aplikacją przeznaczoną wyłącznie dla przedsiębiorców.
            Rejestrując konto, potwierdzasz, że działasz jako firma, nie jako osoba
            prywatna.
          </div>
        )}

        <div className="legal-gate__checks">
          {requiredMissing.map((doc) => {
            const meta = LEGAL_DOC_BY_KEY[doc.key]
            return (
              <label key={doc.key} className="legal-gate__check-row">
                <input
                  type="checkbox"
                  className="legal-gate__checkbox"
                  checked={Boolean(checked[doc.key])}
                  onChange={() => toggle(doc.key)}
                />
                <span className="legal-gate__check-text">
                  {doc.key === 'regulamin' && (
                    <>
                      Zapoznałem/am się z{' '}
                      <a href="/legal/regulamin" target="_blank" rel="noreferrer">
                        Regulaminem świadczenia usług LoftDesk{' '}
                        <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </a>{' '}
                      i akceptuję jego postanowienia.
                    </>
                  )}
                  {doc.key === 'polityka-prywatnosci' && (
                    <>
                      Zapoznałem/am się z{' '}
                      <a href="/legal/polityka-prywatnosci" target="_blank" rel="noreferrer">
                        Polityką prywatności LoftDesk{' '}
                        <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </a>
                      , w tym z zasadami przetwarzania danych osobowych.
                    </>
                  )}
                  {doc.key === 'dpa' && (
                    <>
                      Zapoznałem/am się z{' '}
                      <a href="/legal/dpa" target="_blank" rel="noreferrer">
                        Umową powierzenia przetwarzania danych (DPA){' '}
                        <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </a>{' '}
                      i akceptuję jej postanowienia. Rozumiem, że jestem administratorem
                      danych osobowych swoich klientów.
                    </>
                  )}
                  {doc.key === 'b2b-statement' && (
                    <>
                      Oświadczam, że rejestruję się jako przedsiębiorca w rozumieniu
                      art.&nbsp;43¹ Kodeksu cywilnego, a korzystanie z LoftDesk jest
                      bezpośrednio związane z moją działalnością zawodową lub
                      gospodarczą. Potwierdzam, że{' '}
                      <strong>nie jestem konsumentem</strong> w rozumieniu art.&nbsp;22¹
                      Kodeksu cywilnego.
                    </>
                  )}
                  {!['regulamin', 'polityka-prywatnosci', 'dpa', 'b2b-statement'].includes(doc.key) && (
                    <>
                      Akceptuję dokument:{' '}
                      {meta?.path ? (
                        <a href={meta.path} target="_blank" rel="noreferrer">
                          {doc.label}{' '}
                          <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                        </a>
                      ) : (
                        doc.label
                      )}{' '}
                      (wersja {doc.version}).
                    </>
                  )}
                </span>
              </label>
            )
          })}
        </div>

        {saveAcceptances.isError && (
          <div className="legal-gate__error">
            Nie udało się zapisać akceptacji. Sprawdź połączenie i spróbuj ponownie.
          </div>
        )}

        <div className="legal-gate__actions">
          <Button
            variant="primary"
            disabled={!allChecked || saveAcceptances.isPending}
            loading={saveAcceptances.isPending}
            onClick={handleAccept}
          >
            Akceptuję i przechodzę do aplikacji
          </Button>
        </div>

        <p className="legal-gate__footer">
          Masz pytania?{' '}
          <a href="mailto:szalecki.p@gmail.com">szalecki.p@gmail.com</a>
        </p>
      </div>
    </div>
  )
}
