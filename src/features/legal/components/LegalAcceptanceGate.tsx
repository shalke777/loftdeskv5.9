import { useState } from 'react'
import { ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyAcceptanceExists, useSaveAcceptances } from '@/features/legal/hooks/useLegal'
import { useAuthContext } from '@/app/providers'
import { LEGAL_DOC_BY_KEY, REQUIRED_DOCS } from '@/features/legal/config/legalDocuments'

/**
 * Pure DB-driven legal gate.
 *
 * Architectural invariant:
 *   user can access company dashboard
 *   IFF legal_acceptances(user_id, company_id) EXISTS
 *
 * The gate does NOT know — and MUST NOT know — how the user arrived
 * (signup / invite / first_login / version_update).  It checks only
 * whether at least one acceptance row exists for (user_id, company_id).
 * This removes all flow detection, localStorage / sessionStorage hints
 * and onboarding heuristics from the access-decision path.
 *
 * Source for new acceptances is always 'gate'.
 */
export function LegalAcceptanceGate() {
  const { user } = useAuthContext()
  const acceptanceExists = useCompanyAcceptanceExists()
  const saveAcceptances = useSaveAcceptances()
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  // Klienci (rola 'client') nie akceptują dokumentów B2B / regulaminu
  // dla przedsiębiorców. Gate musi być wyłączony PRZED sprawdzeniem stanu
  // ładowania, żeby klient nie widział pełnoekranowego spinnera.
  if (user?.role === 'client') return null

  // Block the app while loading — never grant access optimistically
  if (acceptanceExists === undefined) {
    return (
      <div className="legal-gate__backdrop">
        <div className="legal-gate__card">
          <Spinner />
        </div>
      </div>
    )
  }

  // DB has at least one acceptance row for (user, company) — gate lifts
  if (acceptanceExists) return null

  const requiredMissing = REQUIRED_DOCS
  const allChecked = requiredMissing.every((d) => checked[d.key])

  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleAccept = async () => {
    if (!user || !allChecked) return

    const inputs = requiredMissing.map((doc) => ({
      userId: user.id,
      companyId: user.companyId ?? null,
      documentKey: doc.key,
      documentVersion: doc.version,
      source: 'gate' as const,
      acceptedB2bStatement: doc.key === 'b2b-statement',
    }))

    if (import.meta.env.DEV) {
      console.log('[legal gate] saving acceptances', inputs.map((i) => `${i.documentKey}@${i.documentVersion} source=${i.source}`))
    }

    try {
      await saveAcceptances.mutateAsync(inputs)
      // Do NOT call refreshSession() here — it can change user.companyId (race
      // when multiple company_members rows exist) which shifts the query key of
      // useCompanyAcceptanceExists, causing the gate to re-appear indefinitely.
      // The session is already valid at this point; the gate simply unmounts once
      // the acceptance query confirms the saved row.
    } catch {
      // Error is handled by useSaveAcceptances onError (toast) + isError banner below
    }
  }

  return (
    <div className="legal-gate__backdrop">
      <div className="legal-gate__card">
        <div className="legal-gate__icon">
          <Shield size={28} />
        </div>

        <h2 className="legal-gate__title">
          Witaj w LoftDesk — wymagana akceptacja warunków
        </h2>

        <p className="legal-gate__subtitle">
          Zanim przejdziesz do aplikacji, zapoznaj się z poniższymi dokumentami i zaakceptuj ich postanowienia. LoftDesk jest przeznaczony wyłącznie dla przedsiębiorców.
        </p>

        <div className="legal-gate__notice">
          LoftDesk jest aplikacją przeznaczoną wyłącznie dla przedsiębiorców.
          Rejestrując konto, potwierdzasz, że działasz jako firma, nie jako osoba
          prywatna.
        </div>

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
