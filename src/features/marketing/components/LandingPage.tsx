import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { APP_NAME } from '@/shared/lib/constants'
import { Button } from '@/shared/ui/Button/Button'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  ArrowRight, XCircle, CheckCircle2, Check,
  FolderOpen, FileText, MessageCircle, Wallet,
  Camera, FilePlus, Users, Zap,
} from 'lucide-react'

/* ─── Scroll reveal hook ─────────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/* ─── CTA button with hover text swap ───────────────────────────── */
function CtaButton({ to, children, variant = 'primary' }: { to: string; children: React.ReactNode; variant?: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link to={to}>
      <button
        className={`lp-cta-btn lp-cta-btn--${variant}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered ? 'Zaczynamy!' : children}
        <ArrowRight size={16} className="lp-cta-btn__icon" />
      </button>
    </Link>
  )
}

/* ─── Data ───────────────────────────────────────────────────────── */
const problems = [
  { icon: Camera,      label: 'Zdjęcia',              desc: 'W rolce telefonu, pomieszane z prywatnymi — szukasz 10 minut zamiast 10 sekund.' },
  { icon: FileText,    label: 'PDFy i dokumenty',     desc: 'Na mailu albo w WhatsAppie. Który jest aktualny? Trzeba dzwonić i pytać.' },
  { icon: MessageCircle, label: 'Ustalenia z klientem', desc: 'Messenger, SMS, mail — nikt nie wie co było ustalone i kiedy.' },
  { icon: Wallet,      label: 'Koszty',               desc: 'W głowie albo w Excelu sprzed tygodnia. Faktura idzie "na oko".' },
]

const steps = [
  {
    num: '01',
    icon: FilePlus,
    title: 'Wrzucasz to co masz',
    desc: 'Zdjęcia z telefonu, PDF z maila, notatka głosowa. Bez formatowania, bez struktury.',
  },
  {
    num: '02',
    icon: FolderOpen,
    title: 'LoftDesk układa to w projekt',
    desc: 'Dokumenty trafiają do właściwego projektu. Koszty się liczą. Kontekst jest gotowy.',
  },
  {
    num: '03',
    icon: Users,
    title: 'Działasz szybciej',
    desc: 'Wycena w 10 minut. Klient widzi etapy. Faktura do KSeF jednym kliknięciem.',
  },
]

const effects = [
  'Nie szukasz zdjęć z budowy po całym telefonie',
  'Nie zapominasz o koszcie który doliczyłeś w głowie',
  'Nie gubisz ustaleń z klientem sprzed miesiąca',
  'Wycenę wysyłasz w 10 minut, nie 2 godziny',
  'Klient widzi etapy projektu — bez 15 maili z pytaniem',
  'Faktura idzie do KSeF bez dodatkowego programu',
]

const notSystem = [
  {
    num: '1',
    text: 'Działasz jak teraz — telefon, zdjęcia, PDF — tylko wszystko jest w jednym miejscu zamiast w 5 różnych.',
  },
  {
    num: '2',
    text: 'Nudna robota dzieje się sama — dokumenty się kategoryzują, koszty się liczą, kwoty się podpowiadają.',
  },
  {
    num: '3',
    text: 'Klient ma swój widok. Ty masz swój. Nikt nie widzi za dużo.',
  },
]

const reviews = [
  { initials: 'MK', role: 'Firma wykończeniowa', text: 'W końcu mam wszystko w jednym miejscu i nie dzwonię do siebie po zdjęcia z budowy.' },
  { initials: 'PW', role: 'Generalny wykonawca', text: 'Nie wróciłem już do Excela. Marżę widzę zanim wyślę fakturę — to zmienia całe podejście.' },
  { initials: 'ŁD', role: 'Firma remontowa',     text: 'Klient akceptuje kosztorys jednym kliknięciem. Koniec z mailem "gdzie kliknąć?"' },
]

/* ─── Component ─────────────────────────────────────────────────── */
export function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  useScrollReveal()

  useEffect(() => {
    if (user?.role === 'client') {
      const dest = user.pendingProjectId
        ? `/client/project/${user.pendingProjectId}`
        : '/client/dashboard'
      void navigate({ to: dest })
    }
  }, [user, navigate])

  const ctaTarget = user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'

  return (
    <div className="lp-shell">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav__brand">
          <div className="lp-nav__mark">LD</div>
          <strong className="lp-nav__name">{APP_NAME}</strong>
        </div>
        <div className="lp-nav__actions">
          <InstallAppButton compact />
          <Link to="/login" className="lp-nav__login">Zaloguj się</Link>
          <CtaButton to={ctaTarget}>Zacznij za darmo</CtaButton>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero__text" data-reveal>
          <span className="lp-eyebrow">Dla firm budowlanych i wykończeniowych</span>
          <h1 className="lp-hero__headline">
            Zdjęcia, PDFy, wiadomości — wreszcie to ma sens.
          </h1>
          <p className="lp-hero__sub">
            LoftDesk zbiera wszystko co masz rozrzucone i pomaga Ci działać szybciej — bez uczenia się systemu.
          </p>
          <div className="lp-hero__ctas">
            <CtaButton to={ctaTarget}>Sprawdź jak to działa</CtaButton>
            <Link to="/login" className="lp-hero__ghost">Masz już konto? Zaloguj się</Link>
          </div>
          <p className="lp-hero__note">Bez karty. Bez umowy. Gotowy w 5 minut.</p>
        </div>

        <div className="lp-hero__visual" data-reveal>
          <div className="lp-flow">
            <div className="lp-flow__item lp-flow__item--in">
              <Camera size={15} />
              <span>Zdjęcie z budowy</span>
            </div>
            <div className="lp-flow__arrow" aria-hidden="true" />
            <div className="lp-flow__item lp-flow__item--in">
              <FileText size={15} />
              <span>PDF faktura dostawcy</span>
            </div>
            <div className="lp-flow__arrow" aria-hidden="true" />
            <div className="lp-flow__item lp-flow__item--in">
              <MessageCircle size={15} />
              <span>Wiadomość od klienta</span>
            </div>
            <div className="lp-flow__divider">
              <span>LoftDesk</span>
            </div>
            <div className="lp-flow__item lp-flow__item--out">
              <Zap size={15} />
              <span>Projekt z kontekstem</span>
            </div>
            <div className="lp-flow__arrow" aria-hidden="true" />
            <div className="lp-flow__item lp-flow__item--out">
              <Wallet size={15} />
              <span>Koszty policzone</span>
            </div>
            <div className="lp-flow__arrow" aria-hidden="true" />
            <div className="lp-flow__item lp-flow__item--out">
              <CheckCircle2 size={15} />
              <span>Faktura gotowa</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────────── */}
      <section className="lp-section" data-reveal>
        <div className="lp-section__head">
          <span className="lp-overline">Bez LoftDesk</span>
          <h2>Masz wszystko. Tylko nie w jednym miejscu.</h2>
        </div>
        <div className="lp-problem-list">
          {problems.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="lp-problem-item">
              <div className="lp-problem-item__icon">
                <XCircle size={18} />
              </div>
              <div>
                <strong className="lp-problem-item__label">{label}</strong>
                <p className="lp-problem-item__desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SOLUTION ────────────────────────────────────────── */}
      <section className="lp-section lp-solution" data-reveal>
        <span className="lp-overline">Z LoftDesk</span>
        <h2 className="lp-solution__headline">LoftDesk zbiera to w całość.</h2>
        <p className="lp-solution__sub">
          Nie uczysz się systemu. Wrzucasz to co masz — i masz porządek.<br />
          Dokumenty, koszty, kontekst — na miejscu. Automatycznie.
        </p>
        <div className="lp-solution__pills">
          {['Wrzucasz zdjęcia', 'Dodajesz PDF', 'Piszesz do klienta', 'Sprawdzasz koszty'].map((t) => (
            <span key={t} className="lp-pill">
              <Check size={13} />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── STEPS ───────────────────────────────────────────── */}
      <section className="lp-section" data-reveal>
        <div className="lp-section__head">
          <span className="lp-overline">Jak to działa</span>
          <h2>3 kroki — nie tutoriale.</h2>
        </div>
        <div className="lp-timeline">
          {steps.map(({ num, icon: Icon, title, desc }, i) => (
            <div key={num} className="lp-timeline__step" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="lp-timeline__marker">
                <span className="lp-timeline__num">{num}</span>
                <div className="lp-timeline__line" />
              </div>
              <div className="lp-timeline__body">
                <div className="lp-timeline__icon">
                  <Icon size={18} />
                </div>
                <h3 className="lp-timeline__title">{title}</h3>
                <p className="lp-timeline__desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── EFFECTS ─────────────────────────────────────────── */}
      <section className="lp-section lp-effects" data-reveal>
        <div className="lp-section__head">
          <span className="lp-overline">Co się zmienia</span>
          <h2>Po tygodniu czujesz różnicę.</h2>
        </div>
        <div className="lp-effects__grid">
          {effects.map((text) => (
            <div key={text} className="lp-effect-item">
              <CheckCircle2 size={17} className="lp-effect-item__icon" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── NOT A SYSTEM ────────────────────────────────────── */}
      <section className="lp-section lp-not-system" data-reveal>
        <div className="lp-not-system__inner">
          <span className="lp-overline lp-overline--light">To nie jest system</span>
          <h2 className="lp-not-system__headline">Nie musisz się uczyć.</h2>
          <p className="lp-not-system__sub">Nie zmieniasz sposobu pracy. Po prostu wrzucasz i działasz.</p>
          <div className="lp-not-system__blocks">
            {notSystem.map(({ num, text }) => (
              <div key={num} className="lp-not-system__block">
                <span className="lp-not-system__num">{num}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ────────────────────────────────────── */}
      <section className="lp-section" data-reveal>
        <div className="lp-section__head">
          <span className="lp-overline">Co mówią wykonawcy</span>
          <h2>Naturalnie. Bez marketingu.</h2>
        </div>
        <div className="lp-reviews">
          {reviews.map(({ initials, role, text }) => (
            <div key={initials} className="lp-review">
              <p className="lp-review__text">„{text}"</p>
              <div className="lp-review__author">
                <div className="lp-review__avatar">{initials}</div>
                <span className="lp-review__role">{role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section className="lp-section" data-reveal>
        <div className="lp-section__head">
          <span className="lp-overline">Cennik</span>
          <h2>Zero ryzyka. Zacznij za darmo.</h2>
          <p className="lp-section__sub">Próbujesz — i dopiero decydujesz.</p>
        </div>
        <div className="lp-pricing">
          <div className="lp-plan">
            <p className="lp-plan__tier">Start — Solo</p>
            <div className="lp-plan__price"><span>0 zł</span><em>/mies, zawsze</em></div>
            <ul className="lp-plan__list">
              {['1 użytkownik', 'Kosztorysy bez limitu', 'Faktury VAT', 'Portal klienta'].map((f) => (
                <li key={f}><Check size={14} />{f}</li>
              ))}
            </ul>
            <Link to="/login" className="lp-plan__cta lp-plan__cta--free">Zacznij za darmo</Link>
          </div>
          <div className="lp-plan lp-plan--pro">
            <span className="lp-plan__badge">Najpopularniejszy</span>
            <p className="lp-plan__tier">Pro — Zespół</p>
            <div className="lp-plan__price"><span>119 zł</span><em>/mies</em></div>
            <ul className="lp-plan__list">
              {['Nieograniczone projekty i użytkownicy', 'KSeF — e-faktury do MF', 'Raporty marży i realizacji', 'Priorytetowe wsparcie'].map((f) => (
                <li key={f}><Check size={14} />{f}</li>
              ))}
            </ul>
            <p className="lp-plan__hint">Gdy masz pracowników lub podwykonawców — Pro się opłaca od pierwszego dnia.</p>
            <Link to="/login" className="lp-plan__cta lp-plan__cta--pro">Wybierz Pro</Link>
          </div>
        </div>
      </section>

      {/* ── CTA FINALE ──────────────────────────────────────── */}
      <section className="lp-cta-final" data-reveal>
        <span className="lp-overline lp-overline--light">Zaczynamy?</span>
        <h2>Spróbuj bez kombinowania.</h2>
        <p>Bez karty. Bez umowy. Gotowy w 5 minut.</p>
        <div className="lp-cta-final__actions">
          <CtaButton to={ctaTarget}>Wejdź i zobacz na swoim projekcie</CtaButton>
        </div>
      </section>

      <footer className="lp-footer">
        © 2026 {APP_NAME} — Narzędzie dla firm budowlanych i wykończeniowych w Polsce
      </footer>

    </div>
  )
}
