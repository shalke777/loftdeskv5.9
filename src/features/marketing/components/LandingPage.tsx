import { ArrowRight, Calculator, CheckCircle2, FileText, FolderKanban, MessageSquareText, Receipt, Shield, Smartphone, Wallet } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { APP_NAME } from '@/shared/lib/constants'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import { useAuth } from '@/features/auth/hooks/useAuth'

const features = [
  { icon: Calculator, title: 'Kosztorysy i wyceny', text: 'Pozycje, stawki, materialy, robocizna. Gotowy do wydruku lub PDF w kilka minut.' },
  { icon: FileText, title: 'Umowy z szablonu', text: 'Wygenerujesz umowe z danych kosztorysu jednym kliknieciem - bez przepisywania.' },
  { icon: Receipt, title: 'Faktury + KSeF', text: 'Wystawiasz fakture i od razu przygotowujesz ja do systemu KSeF Ministerstwa Finansow.' },
  { icon: FolderKanban, title: 'Projekty i realizacja', text: 'Kontrolujesz co jest w ofercie, w realizacji i po odbiorze. Bez Excela.' },
  { icon: MessageSquareText, title: 'Portal klienta', text: 'Link do kosztorysu dla klienta. Akceptacja, komentarze i historia w jednym miejscu.' },
  { icon: Wallet, title: 'Marza i koszty', text: 'Widzisz czy projekt jest oplacalny zanim wyslesz fakture. Zadnych niespodzianek.' },
  { icon: Shield, title: 'Bezpieczenstwo i RODO', text: 'Dane na Supabase z row-level security, szyfrowanie, automatyczny backup.' },
]

const steps = [
  { num: '01', title: 'Zaloz konto - 5 minut', text: 'Podajesz NIP, dane firmy i jestes gotowy. Bez instalacji, bez umow, bez karty.' },
  { num: '02', title: 'Stworz kosztorys i wyslij klientowi', text: 'Budujesz wycene pozycja po pozycji i wysylasz klientowi link przez Portal - bez maili, bez zalacznikow PDF.' },
  { num: '03', title: 'Oferta > umowa > faktura > KSeF', text: 'Zaakceptowana wycena staje sie umowa i faktura. Dane przenosza sie automatycznie. Zero przepisywania.' },
]

const forWho = [
  'Prowadzisz firme wykonczeniowa lub remontowa',
  'Masz dosc Excela i maili jako systemu dokumentow',
  'Chcesz wysylac faktury do KSeF bez bolu glowy',
  'Potrzebujesz historii uslalen z klientem w jednym miejscu',
  'Szukasz systemu ktory dziala na telefonie - na budowie',
]

const freePlan = ['1 uzytkownik', 'Kosztorysy bez limitu', 'Faktury VAT', 'Portal klienta']
const proPlan = ['Nieograniczone projekty i uzytkownicy', 'KSeF - elektroniczne faktury do MF', 'Raporty marzy i realizacji', 'Priorytetowe wsparcie']

const mockItems = [
  { Icon: Calculator, iBg: 'var(--color-brand-light)', iC: 'var(--color-brand)', label: 'Kosztorys - Remont Wilanow', sub: 'Wyslany do klienta - 38 400 zl', badge: 'Oczekuje', bBg: 'var(--color-brand-light)', bC: 'var(--color-brand)' },
  { Icon: Receipt, iBg: 'var(--color-accent-soft)', iC: 'var(--color-accent)', label: 'FV/03/2026 - wyslana do KSeF', sub: 'Zaksiegowana - 12 300 zl', badge: 'KSeF ok', bBg: 'rgba(119,186,138,0.15)', bC: '#77BA8A' },
  { Icon: MessageSquareText, iBg: 'var(--color-surface-soft)', iC: 'var(--color-chart-4)', label: 'Portal - Kowalski Jan', sub: 'Nowy komentarz - 2 godz. temu', badge: 'Nowy', bBg: 'var(--color-muted)', bC: 'var(--color-text-secondary)' },
]

export function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Klient trafia na stronę główną gdy Supabase obetnie redirect_to do Site URL.
  // Sesja jest już załadowana (detectSessionInUrl:true) ale router wylądował na /.
  // Auto-przekierowanie na właściwy projekt lub /client/dashboard.
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
          <Link to="/login"><Button variant="ghost">Zaloguj sie</Button></Link>
          <Link to={user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'}><Button>Zacznij za darmo</Button></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">System dla firm budowlanych i wykonczeniowych</span>
          <h1>To nie jest kolejna aplikacja do fakturowania !.</h1>
          <h1>Koniec z chaosem dokumentow. Wyceny, umowy, faktury i KSeF w jednym miejscu.</h1>
          <p>LoftDesk zastepuje stos arkuszy, maili i osobnych programow. Jeden system od kosztorysu przez umowe i fakture az do odbioru budowy.</p>
          <div className="hero__actions">
            <Link to={user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'}>
              <Button size="lg" icon={<ArrowRight size={16} />}>Zacznij za darmo</Button>
            </Link>
            <Link to="/login"><Button size="lg" variant="secondary">Zaloguj sie</Button></Link>
          </div>
          <div className="hero__pills">
            <span className="hero-pill"><CheckCircle2 size={14} style={{ color: 'var(--color-chart-3)' }} /> Bez umowy, bez karty</span>
            <span className="hero-pill"><CheckCircle2 size={14} style={{ color: 'var(--color-chart-3)' }} /> Gotowy w 5 minut</span>
            <span className="hero-pill"><Smartphone size={14} style={{ color: 'var(--color-chart-3)' }} /> Dziala na telefonie</span>
          </div>
        </div>

        <div className="hero__panel">
          <div className="card" style={{ padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
              <div>
                <strong style={{ fontSize: 15, display: 'block' }}>Tablica - Loftbau</strong>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Aktywne projekty i dokumenty</span>
              </div>
              <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>Plan Pro</span>
            </div>
            <div className="hero-metrics" style={{ marginBottom: 16 }}>
              <div><span>Pipeline</span><strong style={{ display: 'block', fontSize: 18, color: 'var(--color-brand)' }}>124 800 zl</strong></div>
              <div><span>Projekty</span><strong style={{ display: 'block', fontSize: 18, color: 'var(--color-brand)' }}>7</strong></div>
              <div><span>Faktury</span><strong style={{ display: 'block', fontSize: 18, color: 'var(--color-accent)' }}>5</strong></div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {mockItems.map(({ Icon, iBg, iC, label, sub, badge, bBg, bC }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--color-muted)' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: iBg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: iC }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: bBg, color: bC, fontWeight: 700, whiteSpace: 'nowrap' }}>{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section className="section-block">
        <div style={{ background: 'var(--color-brand-2)', borderRadius: 24, padding: '48px 40px' }}>
          <h2 style={{ color: 'white', margin: '0 0 8px', maxWidth: 680 }}>Jak wyglada zarzadzanie firma budowlana bez LoftDesk?</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 32px', fontSize: 16 }}>Brzmi znajomo? Tak wyglada codziennosc wiekszosci firm w branzy.</p>
          <div className="landing-grid landing-grid--3">
            {[
              { e: '📁', t: 'Excel i foldery na dysku', d: 'Kosztorys w jednym miejscu, faktura w innym, umowa trzeciia. Szukasz godzinami zamiast budowac.' },
              { e: '📧', t: 'Maile i Messenger', d: 'Ustalenia z klientem rozrzucone w kilku watkach. Co, kiedy i przez kogo zostalo ustalone? Nikt nie pamietia.' },
              { e: '⏱️', t: 'Reczna robota co tydzien', d: 'Kopiowanie danych miedzy programami zabiera godziny. To czas ktory moglbys poswiecic na realizacje.' },
            ].map(({ e, t, d }) => (
              <div key={t} style={{ padding: 24, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{e}</div>
                <h3 style={{ color: 'white', margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{t}</h3>
                <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section-block">
        <div className="section-head">
          <h2>Wszystko czego potrzebujesz - nic czego nie potrzebujesz</h2>
          <p style={{ fontSize: 17, color: 'var(--color-text-secondary)', marginTop: 8 }}>Zaprojektowany pod realia budowy, nie pod potrzeby korporacji.</p>
        </div>
        <div className="landing-grid landing-grid--3">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="feature-card">
              <div className="feature-card__icon"><Icon size={20} /></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.65 }}>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="section-block">
        <div className="landing-grid landing-grid--3">
          {[
            { v: '7', s: 'modulow w jednym systemie - od kosztorysu po KSeF' },
            { v: '5 min', s: 'i jestes gotowy do pierwszej wyceny dla klienta' },
            { v: '0 zl', s: 'na start - pelny darmowy plan bez limitu czasowego' },
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
        <div className="section-head"><h2>Jak to dziala?</h2></div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 16px' }}>LoftDesk jest dla Ciebie jesli...</h2>
            <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.7 }}>
              Nie zarzadzasz fabryaka ani korporacja. Masz realne projekty, realne problemy i potrzebujesz narzedzia ktore po prostu dziala.
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
          <h2>Prosty cennik. Zero ukrytych kosztow.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 800, margin: '0 auto' }}>
          <Card style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Start</p>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text-primary)' }}>0 zl</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginLeft: 4 }}>/mies, na zawsze</span>
            </div>
            <div style={{ display: 'grid', gap: 12, flex: 1, marginBottom: 28 }}>
              {freePlan.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--color-chart-3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{f}</span>
                </div>
              ))}
            </div>
            <Link to="/login" style={{ display: 'block' }}>
              <Button variant="secondary" style={{ width: '100%' }}>Zacznij za darmo</Button>
            </Link>
          </Card>
          <div style={{ padding: '32px 28px', borderRadius: 20, background: 'var(--color-brand)', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, background: 'var(--color-accent)', color: 'white', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              Najpopularniejszy
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro</p>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', color: 'white' }}>119 zł</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>/mies</span>
            </div>
            <div style={{ display: 'grid', gap: 12, flex: 1, marginBottom: 28 }}>
              {proPlan.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>{f}</span>
                </div>
              ))}
            </div>
            <Link to="/login" style={{ display: 'block' }}>
              <Button variant="secondary" style={{ width: '100%' }}>Wybierz Pro</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="section-block">
        <div style={{ background: 'var(--color-brand-2)', borderRadius: 24, padding: '60px 40px', textAlign: 'center' }}>
          <h2 style={{ color: 'white', fontSize: 'clamp(28px,3.5vw,46px)', letterSpacing: '-0.04em', margin: '0 0 12px', lineHeight: 1.1 }}>
            Zacznij porzadkowac firme - dzis.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, margin: '0 0 36px', lineHeight: 1.6 }}>
            Bez umowy. Bez karty kredytowej. Gotowy w 5 minut.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={user ? (user.role === 'client' ? '/client/dashboard' : '/dashboard') : '/login'}>
              <Button size="lg" icon={<ArrowRight size={16} />}>Uruchom LoftDesk za darmo</Button>
            </Link>
            <Link to="/login"><Button size="lg" variant="ghost">Zaloguj sie</Button></Link>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '12px 0 4px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        © 2026 {APP_NAME} - System dla firm budowlanych i wykonczeniowych
      </footer>

    </main>
  )
}
