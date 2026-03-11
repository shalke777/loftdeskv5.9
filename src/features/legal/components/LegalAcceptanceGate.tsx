import { useState } from 'react'
import { ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useMissingAcceptances, useSaveAcceptances } from '@/features/legal/hooks/useLegal'
import { useAuthContext } from '@/app/providers'
import { LEGAL_DOC_BY_KEY, REQUIRED_DOCS } from '@/features/legal/config/legalDocuments'

/**
 * Full-screen blocking overlay shown when a logged-in user has not yet
 * accepted the current versions of all required documents.
 *
 * The overlay cannot be dismissed without accepting.  Links to the actual
 * document pages open in a new tab so the user can read them first.
 */
export function LegalAcceptanceGate() {
  const { user } = useAuthContext()
  const missing = useMissingAcceptances()
  const saveAcceptances = useSaveAcceptances()

  // Per-checkbox state
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  // While loading acceptances from the server, keep the app blocked —
  // never grant access optimistically.
  if (missing === undefined) {
    return (
      <div className="legal-gate__backdrop">
        <div className="legal-gate__card">
          <Spinner />
        </div>
      </div>
    )
  }

  // All required docs accepted — render nothing (gate lifts)
  if (missing.length === 0) return null

  const requiredMissing = REQUIRED_DOCS.filter((d) => missing.includes(d.key))
  const allChecked = requiredMissing.every((d) => checked[d.key])

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
      console.log('[legal gate] saving acceptances', inputs.map((i) => `${i.documentKey}@${i.documentVersion}`))
    }

    await saveAcceptances.mutateAsync(inputs)
  }

  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="legal-gate__backdrop">
      <div className="legal-gate__card">
        <div className="legal-gate__icon">
          <Shield size={28} />
        </div>

        <h2 className="legal-gate__title">Wymagana akceptacja dokumentów</h2>
        <p className="legal-gate__subtitle">
          Zanim przejdziesz do aplikacji, zapoznaj się z poniższymi dokumentami i
          zaakceptuj ich postanowienia. LoftDesk jest przeznaczony wyłącznie dla
          przedsiębiorców.
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
                      art. 43¹ Kodeksu cywilnego, a korzystanie z LoftDesk jest
                      bezpośrednio związane z moją działalnością zawodową lub
                      gospodarczą. Potwierdzam, że{' '}
                      <strong>nie jestem konsumentem</strong> w rozumieniu art. 22¹
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
