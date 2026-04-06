import { ArrowRight, Bot, Calculator, CheckCircle2, FileText, FolderKanban, MessageSquareText, Receipt, Shield, Smartphone, Wallet, Scan, Clock, TrendingUp, Zap, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { APP_NAME } from '@/shared/lib/constants'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import { useAuth } from '@/features/auth/hooks/useAuth'

const features = [
  { icon: Calculator, title: 'Kosztorysy i wyceny', text: 'Pozycje, stawki, materiały, robocizna. Gotowy do wydruku lub PDF w kilka minut.' },
  { icon: FileText, title: 'Umowy z szablonu', text: 'Wygenerujesz umowę z danych kosztorysu jednym kliknięciem — bez przepisywania.' },
  { icon: Receipt, title: 'Faktury + KSeF', text: 'Wystawiasz fakturę i od razu przygotowujesz ją do systemu KSeF Ministerstwa Finansów.', badge: 'Obowiązkowy 2026' },
  { icon: FolderKanban, title: 'Projekty i realizacja', text: 'Kontrolujesz co jest w ofercie, w realizacji i po odbiorze. Bez Excela.' },
  { icon: MessageSquareText, title: 'Portal klienta', text: 'Klient widzi etapy projektu, zatwierdza kosztorysy, pisze przez chat — wszystko w jednym miejscu.' },
  { icon: Wallet, title: 'Marża i koszty', text: 'Widzisz czy projekt jest opłacalny zanim wyślesz fakturę. Żadnych niespodzianek.' },
  { icon: Shield, title: 'Bezpieczeństwo i RODO', text: 'Dane na Supabase z row-level security, szyfrowanie, automatyczny backup.' },
]

const aiFeatures = [
  { icon: Scan, title: 'Skanuj faktury aparatem', text: 'Zrób zdjęcie faktury od dostawcy — AI odczytuje NIP, kwoty, pozycje i wpisuje dane automatycznie.' },
  { icon: Bot, title: 'Asystent AI dla projektów', text: 'Analizuj plany pomieszczeń, generuj sugestie wycen i kontroluj zakres prac — AI rozumie branżę budowlaną.' },
  { icon: Zap, title: 'Zero przepisywania', text: 'Dane z dokumentów trafiają od razu do formularzy. Kosztorys > umowa > faktura bez jednego kopiowania.' },
]

const steps = [
  { num: '01', title: 'Załóż konto — 5 minut', text: 'Podajesz NIP, dane firmy i jesteś gotowy. Bez instalacji, bez umów, bez karty.' },
  { num: '02', title: 'Stwórz kosztorys i wyślij klientowi', text: 'Budujesz wycenę pozycja po pozycji i wysyłasz klientowi link przez Portal — bez maili, bez załączników PDF.' },
  { num: '03', title: 'Oferta → umowa → faktura → KSeF', text: 'Zaakceptowana wycena staje się umową i fakturą. Dane przenoszą się automatycznie. Zero przepisywania.' },
]

const forWho = [
  'Prowadzisz firmę wykończeniową lub remontową',
  'Masz dość Excela i maili jako systemu dokumentów',
  'Chcesz wysyłać faktury do KSeF bez bólu głowy',
  'Potrzebujesz historii ustaleń z klientem w jednym miejscu',
  'Szukasz systemu który działa na telefonie — na budowie',
]

const freePlan = ['1 użytkownik', 'Kosztorysy bez limitu', 'Faktury VAT', 'Portal klienta']
const proPlan = ['Nieograniczone projekty i użytkownicy', 'KSeF — elektroniczne faktury do MF', 'Raporty marży i realizacji', 'Priorytetowe wsparcie']

const roiItems = [
  { icon: Clock, value: '8h', label: 'tygodniowo', desc: 'mniej na dokumentację i przepisywanie danych między programami' },
  { icon: TrendingUp, value: '↑', label: 'marża', desc: 'widoczna przed wystawieniem faktury — koniec z projektami "na minus"' },
  { icon: Receipt, value: '0', label: 'błędów KSeF', desc: 'automatyczna wysyłka do Ministerstwa Finansów — zgodność bez stresu' },
]

const painItems = [
  { icon: XCircle, title: 'Excel i foldery na dysku', desc: 'Kosztorys w jednym miejscu, faktura w innym, umowa trzecia. Szukasz godzinami zamiast budować.' },
  { icon: XCircle, title: 'Maile i Messenger', desc: 'Ustalenia z klientem rozrzucone w kilku wątkach. Co, kiedy i przez kogo zostało ustalone? Nikt nie pamięta.' },
  { icon: XCircle, title: 'Ręczna robota co tydzień', desc: 'Kopiowanie danych między programami zabiera godziny. To czas który mógłbyś poświęcić na realizację.' },
]

export function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role === 'client') {
      const dest = user.pendingProjectId
        ? `/client/project/${user.pendingProjectId}`
        : '/client/dashboard'
      void navigate({ to: dest })
    }
  }, [user, navigate])

  return (
    <main className="landing-shell">

      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <div className="landing-brand__mark">LD</div>
          <div>
            <strong>{APP_NAME}</strong>
            <span>System dla firm budowlanych</span>
          </div>
        </div>
        <div className="landing-nav__actions">
          <InstallAppButton compact />
          <Link to="/login"><Button variant="ghost">Zaloguj się</Button></Link>
          <Link to={user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'}><Button>Zacznij za darmo</Button></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero hero--centered">
        <div className="hero__content">
          <span className="hero__eyebrow">System dla firm budowlanych i wykończeniowych w Polsce · KSeF-ready</span>
          <h1>Jeden system zamiast Excela,<br />maila i segregatora.</h1>
          <p>Wyceny, umowy, faktury i KSeF — od pierwszego kontaktu do odbioru budowy.<br />Dla wykonawców którzy chcą działać profesjonalnie bez biurokratycznego chaosu.</p>
          <div className="hero__actions">
            <Link to={user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'}>
              <Button size="lg" icon={<ArrowRight size={16} />}>Zacznij bezpłatnie</Button>
            </Link>
            <Link to="/login"><Button size="lg" variant="secondary">Zaloguj się</Button></Link>
          </div>
          <div className="hero__pills">
            <span className="hero-pill"><CheckCircle2 size={14} style={{ color: 'var(--color-chart-3)' }} /> Bez umowy, bez karty</span>
            <span className="hero-pill"><CheckCircle2 size={14} style={{ color: 'var(--color-chart-3)' }} /> Gotowy w 5 minut</span>
            <span className="hero-pill"><Smartphone size={14} style={{ color: 'var(--color-chart-3)' }} /> Instaluj jak aplikację</span>
            <span className="hero-pill"><Bot size={14} style={{ color: 'var(--color-chart-3)' }} /> AI skanuje faktury</span>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section className="section-block">
        <div className="landing-dark-section">
          <h2 style={{ color: '#EDE8DD', margin: '0 0 8px', maxWidth: 680 }}>Jak wygląda zarządzanie firmą budowlaną bez LoftDesk?</h2>
          <p style={{ color: 'rgba(237,232,221,0.55)', margin: '0 0 32px', fontSize: 16 }}>Brzmi znajomo? Tak wygląda codzienność większości firm w branży.</p>
          <div className="landing-grid landing-grid--3">
            {painItems.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ padding: 28, borderRadius: 16, background: 'rgba(237,232,221,0.06)', border: '1px solid rgba(237,232,221,0.1)' }}>
                <div style={{ marginBottom: 16 }}>
                  <Icon size={22} style={{ color: 'rgba(237,232,221,0.35)' }} />
                </div>
                <h3 style={{ color: '#EDE8DD', margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{title}</h3>
                <p style={{ color: 'rgba(237,232,221,0.62)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI SECTION — NEW */}
      <section className="section-block">
        <div className="section-head">
          <h2>AI, które robi robotę za Ciebie</h2>
          <p style={{ fontSize: 17, color: 'var(--color-text-secondary)', marginTop: 8 }}>Nie musisz wpisywać danych ręcznie — LoftDesk je odczytuje.</p>
        </div>
        <div className="landing-grid landing-grid--3">
          {aiFeatures.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="feature-card landing-ai-card">
              <div className="feature-card__icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}><Icon size={20} /></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.65 }}>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="section-block">
        <div className="section-head">
          <h2>Wszystko czego potrzebujesz — nic czego nie potrzebujesz</h2>
          <p style={{ fontSize: 17, color: 'var(--color-text-secondary)', marginTop: 8 }}>Zaprojektowany pod realia budowy, nie pod potrzeby korporacji.</p>
        </div>
        <div className="landing-grid landing-grid--3">
          {features.map(({ icon: Icon, title, text, badge }) => (
            <Card key={title} className="feature-card">
              <div className="feature-card__icon"><Icon size={20} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h3>
                {badge && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--color-error-soft)', color: 'var(--color-error)', fontWeight: 700, whiteSpace: 'nowrap' }}>{badge}</span>}
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.65 }}>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ROI SECTION — NEW */}
      <section className="section-block">
        <div className="landing-dark-section">
          <h2 style={{ color: '#EDE8DD', margin: '0 0 8px', maxWidth: 680 }}>Co konkretnie zyskujesz</h2>
          <p style={{ color: 'rgba(237,232,221,0.55)', margin: '0 0 32px', fontSize: 16 }}>Nie "funkcje" — realne efekty dla Twojej firmy.</p>
          <div className="landing-grid landing-grid--3">
            {roiItems.map(({ icon: Icon, value, label, desc }) => (
              <div key={label} style={{ padding: 28, borderRadius: 16, background: 'rgba(237,232,221,0.06)', border: '1px solid rgba(237,232,221,0.12)', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-brand-2, #4ADE80)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
                  <span style={{ fontSize: 15, color: '#EDE8DD', fontWeight: 600 }}>{label}</span>
                </div>
                <p style={{ color: 'rgba(237,232,221,0.65)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="section-block">
        <div className="landing-grid landing-grid--3">
          {[
            { v: '7+', s: 'modułów w jednym systemie — od kosztorysu po KSeF' },
            { v: '5 min', s: 'i jesteś gotowy do pierwszej wyceny dla klienta' },
            { v: '0 zł', s: 'na start — pełny darmowy plan bez limitu czasowego' },
          ].map(({ v, s }) => (
            <Card key={v} style={{ padding: '32px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(36px,4vw,52px)', fontWeight: 800, color: 'var(--color-brand)', letterSpacing: '-0.04em', lineHeight: 1 }}>{v}</div>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>{s}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section-block">
        <div className="section-head"><h2>Jak to działa?</h2></div>
        <div className="landing-grid landing-grid--3">
          {steps.map(({ num, title, text }) => (
            <Card key={num} style={{ padding: '28px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-brand)', marginBottom: 14, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Krok {num}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.65 }}>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FOR WHO */}
      <section className="section-block">
        <div className="landing-grid landing-grid--2">
          <div>
            <h2 style={{ margin: '0 0 16px' }}>LoftDesk jest dla Ciebie jeśli...</h2>
            <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.7 }}>
              Nie zarządzasz fabryką ani korporacją. Masz realne projekty, realne problemy i potrzebujesz narzędzia które po prostu działa.
            </p>
          </div>
          <Card style={{ padding: '28px 24px' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              {forWho.map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--color-chart-3)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* PRICING */}
      <section className="section-block">
        <div className="section-head">
          <h2>Prosty cennik. Zero ukrytych kosztów.</h2>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginTop: 6 }}>
            Zacznij solo za darmo. Gdy rosną potrzeby — rośnie plan.
          </p>
        </div>
        <div className="landing-grid landing-grid--2" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Card style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Start — Solo</p>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text-primary)' }}>0 zł</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginLeft: 4 }}>/mies, na zawsze</span>
            </div>
            <div style={{ display: 'grid', gap: 12, flex: 1, marginBottom: 16 }}>
              {freePlan.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--color-chart-3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{f}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Idealny dla freelancerów i firm jednoosobowych
            </p>
            <Link to="/login" style={{ display: 'block' }}>
              <Button variant="secondary" style={{ width: '100%' }}>Zacznij za darmo</Button>
            </Link>
          </Card>
          <div style={{ padding: '32px 28px', borderRadius: 20, background: 'var(--color-brand)', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, background: 'var(--color-accent)', color: 'white', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              Najpopularniejszy
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro — Zespół</p>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', color: 'white' }}>119 zł</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>/mies</span>
            </div>
            <div style={{ display: 'grid', gap: 12, flex: 1, marginBottom: 16 }}>
              {proPlan.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>{f}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Gdy masz pracowników lub podwykonawców — Pro się opłaca od pierwszego użytkownika dodanego do zespołu
            </p>
            <Link to="/login" style={{ display: 'block' }}>
              <Button variant="secondary" style={{ width: '100%' }}>Wybierz Pro</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="section-block">
        <div className="landing-dark-section" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#EDE8DD', fontSize: 'clamp(28px,3.5vw,46px)', letterSpacing: '-0.04em', margin: '0 0 12px', lineHeight: 1.1 }}>
            Zacznij porządkować firmę — dziś.
          </h2>
          <p style={{ color: 'rgba(237,232,221,0.6)', fontSize: 17, margin: '0 0 36px', lineHeight: 1.6 }}>
            Bez umowy. Bez karty kredytowej. Gotowy w 5 minut.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'}>
              <Button size="lg" icon={<ArrowRight size={16} />}>Uruchom LoftDesk za darmo</Button>
            </Link>
            <Link to="/login"><Button size="lg" variant="ghost">Zaloguj się</Button></Link>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '12px 0 4px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        © 2026 {APP_NAME} — System dla firm budowlanych i wykończeniowych
      </footer>

    </main>
  )
}

