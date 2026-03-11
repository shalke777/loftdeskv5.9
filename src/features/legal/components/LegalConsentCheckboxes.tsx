import { type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * Reusable consent checkboxes for registration / checkout forms.
 *
 * - `values`  — controlled state from the parent form
 * - `onChange` — setter for individual checkbox keys
 * - `variant`  — 'signup' | 'checkout'
 */

type SignupKey = 'regulamin' | 'prywatnosc' | 'b2b' | 'dpa' | 'komunikacja'
type CheckoutKey = 'autoRenewal' | 'zasadyPlatnosci' | 'b2bCheckout'

export type ConsentValues<T extends string = SignupKey | CheckoutKey> = Record<T, boolean>

interface CheckboxRowProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  required?: boolean
}

function CheckboxRow({ id, checked, onChange, children, required = true }: CheckboxRowProps) {
  return (
    <label className="legal-consent__row" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="legal-consent__checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
      />
      <span className="legal-consent__text">
        {children}
        {required && <span className="legal-consent__required">*</span>}
      </span>
    </label>
  )
}

// ── SIGNUP CHECKBOXES ─────────────────────────────────────────────────────────

interface SignupProps {
  values: ConsentValues<SignupKey>
  onChange: (key: SignupKey, val: boolean) => void
}

export function SignupConsentCheckboxes({ values, onChange }: SignupProps) {
  return (
    <div className="legal-consent">
      <p className="legal-consent__notice">
        LoftDesk jest aplikacją przeznaczoną wyłącznie dla przedsiębiorców.
        Rejestrując konto potwierdzasz, że działasz jako firma.
      </p>

      <CheckboxRow
        id="consent-regulamin"
        checked={values.regulamin}
        onChange={(v) => onChange('regulamin', v)}
      >
        Zapoznałem/am się z{' '}
        <a href="/legal/regulamin" target="_blank" rel="noreferrer">
          Regulaminem świadczenia usług LoftDesk{' '}
          <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </a>{' '}
        i akceptuję jego postanowienia.
      </CheckboxRow>

      <CheckboxRow
        id="consent-prywatnosc"
        checked={values.prywatnosc}
        onChange={(v) => onChange('prywatnosc', v)}
      >
        Zapoznałem/am się z{' '}
        <a href="/legal/polityka-prywatnosci" target="_blank" rel="noreferrer">
          Polityką prywatności LoftDesk{' '}
          <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </a>
        , w tym z zasadami przetwarzania danych osobowych.
      </CheckboxRow>

      <CheckboxRow
        id="consent-b2b"
        checked={values.b2b}
        onChange={(v) => onChange('b2b', v)}
      >
        Oświadczam, że rejestruję się jako{' '}
        <strong>przedsiębiorca</strong> w rozumieniu art.&nbsp;43¹ KC. Korzystanie z
        LoftDesk jest bezpośrednio związane z moją działalnością zawodową lub
        gospodarczą. Nie jestem konsumentem w rozumieniu art.&nbsp;22¹ KC.
      </CheckboxRow>

      <CheckboxRow
        id="consent-dpa"
        checked={values.dpa}
        onChange={(v) => onChange('dpa', v)}
      >
        Zapoznałem/am się z{' '}
        <a href="/legal/dpa" target="_blank" rel="noreferrer">
          Umową powierzenia przetwarzania danych (DPA){' '}
          <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </a>{' '}
        i akceptuję jej postanowienia. Rozumiem, że jestem administratorem danych
        osobowych moich klientów i kontrahentów w Aplikacji.
      </CheckboxRow>

      <CheckboxRow
        id="consent-komunikacja"
        checked={values.komunikacja}
        onChange={(v) => onChange('komunikacja', v)}
        required={false}
      >
        Zgadzam się na otrzymywanie na podany adres e-mail informacji o istotnych
        zmianach w Usłudze i komunikatów technicznych dotyczących Konta.
      </CheckboxRow>
    </div>
  )
}

// Default state helpers
export function defaultSignupConsents(): ConsentValues<SignupKey> {
  return { regulamin: false, prywatnosc: false, b2b: false, dpa: false, komunikacja: true }
}

export function signupConsentsValid(values: ConsentValues<SignupKey>): boolean {
  return values.regulamin && values.prywatnosc && values.b2b && values.dpa
}

// ── CHECKOUT CHECKBOXES ───────────────────────────────────────────────────────

interface CheckoutProps {
  values: ConsentValues<CheckoutKey>
  onChange: (key: CheckoutKey, val: boolean) => void
}

export function CheckoutConsentCheckboxes({ values, onChange }: CheckoutProps) {
  return (
    <div className="legal-consent">
      <CheckboxRow
        id="checkout-auto-renewal"
        checked={values.autoRenewal}
        onChange={(v) => onChange('autoRenewal', v)}
      >
        Rozumiem i akceptuję, że subskrypcja planu Business wynosi{' '}
        <strong>119&nbsp;zł brutto&nbsp;/&nbsp;miesiąc</strong> i odnawia się
        automatycznie. Jestem uprawniony/a do rezygnacji w dowolnym momencie ze
        skutkiem na koniec bieżącego okresu rozliczeniowego. Opłata za aktywny
        miesiąc nie podlega zwrotowi.
      </CheckboxRow>

      <CheckboxRow
        id="checkout-zasady"
        checked={values.zasadyPlatnosci}
        onChange={(v) => onChange('zasadyPlatnosci', v)}
      >
        Zapoznałem/am się z{' '}
        <a href="/legal/zasady-platnosci" target="_blank" rel="noreferrer">
          Zasadami płatności i subskrypcji{' '}
          <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </a>
        , w tym z polityką braku zwrotów za aktywny okres rozliczeniowy.
      </CheckboxRow>

      <CheckboxRow
        id="checkout-b2b"
        checked={values.b2bCheckout}
        onChange={(v) => onChange('b2bCheckout', v)}
      >
        Potwierdzam, że zakup planu Business LoftDesk dokonywany jest w związku z moją
        działalnością zawodową lub gospodarczą i ma dla mnie charakter zawodowy.{' '}
        <strong>Nie działam jako konsument</strong> ani jako przedsiębiorca
        korzystający z ochrony konsumenckiej (art.&nbsp;385⁵&nbsp;KC).
      </CheckboxRow>
    </div>
  )
}

export function defaultCheckoutConsents(): ConsentValues<CheckoutKey> {
  return { autoRenewal: false, zasadyPlatnosci: false, b2bCheckout: false }
}

export function checkoutConsentsValid(values: ConsentValues<CheckoutKey>): boolean {
  return values.autoRenewal && values.zasadyPlatnosci && values.b2bCheckout
}
