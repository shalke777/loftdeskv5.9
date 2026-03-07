import { Calculator, Camera, CheckCircle2, FileText, FolderKanban, MessageSquareText, Receipt, ShieldCheck, Smartphone, Wallet } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { APP_NAME } from '@/shared/lib/constants'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import { useAuth } from '@/features/auth/hooks/useAuth'

const modules = [
  { icon: Calculator, title: 'Kosztorysy', text: 'Tworzysz wyceny, pozycje, stawki i wartości bez skakania między arkuszami.' },
  { icon: FileText, title: 'Umowy', text: 'Budujesz spójny pakiet dokumentów od oferty do podpisanej umowy.' },
  { icon: Receipt, title: 'Faktury + KSeF', text: 'Wystawiasz faktury i przygotowujesz się do elektronicznego obiegu dokumentów.' },
  { icon: FolderKanban, title: 'Projekty i harmonogram', text: 'Kontrolujesz, co jest w ofercie, w realizacji i po odbiorze.' },
  { icon: Wallet, title: 'Marża i realizacja', text: 'Widzisz nie tylko dokument, ale też opłacalność i stan prac.' },
  { icon: Camera, title: 'Dokumentacja i odbiory', text: 'Zbierasz zdjęcia, protokoły odbioru, decyzje klienta i akceptacje zmian w jednym module.' },
  { icon: MessageSquareText, title: 'Portal klienta', text: 'Udostępniasz kosztorys linkiem, zbierasz akceptację, komentarze i potwierdzenia decyzji.' },
]

const highlights = [
  'prostszy niż ciężkie systemy ERP',
  'bardziej dopasowany do realiów budowy niż zwykłe programy do faktur',
  'jedno miejsce dla wycen, umów, faktur, projektów i dokumentacji budowy',
]

export function LandingPage() {
  const { user } = useAuth()

  return (
    <main className="landing-shell">
      <section className="landing-nav">
        <div className="landing-brand">
          <div className="landing-brand__mark">LD</div>
          <div>
            <strong>{APP_NAME}</strong>
            <span>System dla firm budowlanych i wykończeniowych</span>
          </div>
        </div>
        <div className="landing-nav__actions">
          <InstallAppButton compact />
          <Link to="/login"><Button variant="ghost">Logowanie</Button></Link>
          <Link to={user ? '/dashboard' : '/login'}><Button>{user ? 'Otwórz aplikację' : 'Uruchom demo'}</Button></Link>
        </div>
      </section>

      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">Branżowy system zamiast przypadkowego zestawu narzędzi</span>
          <h1>LoftDesk porządkuje kosztorys, umowę, fakturę, KSeF i realizację w jednym miejscu.</h1>
          <p>
            LoftDesk to branżowy system do zarządzania dokumentami i realizacją dla firm budowlanych oraz wykończeniowych — od kosztorysu i umowy po fakturę, KSeF i kontrolę marży.
            Łączy w jednym miejscu to, co firmy zwykle robią w kilku narzędziach: wyceny, dokumenty, kontrahentów, projekty, harmonogram i dokumentację budowy.
          </p>
          <div className="hero__actions">
            <Link to={user ? '/dashboard' : '/login'}><Button size="lg">Wejdź do LoftDesk</Button></Link>
            <Link to="/login"><Button size="lg" variant="secondary">Zobacz demo</Button></Link>
            <InstallAppButton />
          </div>
          <div className="hero__pills">
            {highlights.map((item) => (
              <span key={item} className="hero-pill"><CheckCircle2 size={14} /> {item}</span>
            ))}
          </div>
        </div>
        <div className="hero__panel">
          <Card className="hero-mockup">
            <div className="hero-mockup__top">
              <div>
                <strong>Dashboard LoftDesk</strong>
                <p>Oferty, dokumenty i realizacja bez chaosu.</p>
              </div>
              <span className="hero-mockup__badge">Pro</span>
            </div>
            <div className="hero-metrics">
              <div><span>Pipeline</span><strong>47 100 zł</strong></div>
              <div><span>Aktywne projekty</span><strong>4</strong></div>
              <div><span>Otwarte faktury</span><strong>3</strong></div>
            </div>
            <div className="hero-list">
              <div><Calculator size={16} /> Remont łazienki – kosztorys zaakceptowany</div>
              <div><Receipt size={16} /> FV/2026/002 czeka na płatność</div>
              <div><MessageSquareText size={16} /> Klient zostawił komentarz w portalu</div>
            </div>
          </Card>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <span>Dlaczego LoftDesk</span>
          <h2>Nie kolejna fakturownia. Nie ciężki ERP. Narzędzie zrobione pod realia budowy.</h2>
        </div>
        <div className="landing-grid landing-grid--3">
          {modules.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title} className="feature-card">
                <div className="feature-card__icon"><Icon size={20} /></div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="section-block section-block--split">
        <Card>
          <h3>Dla kogo</h3>
          <ul className="landing-list">
            <li>firmy wykończeniowe</li>
            <li>ekipy remontowe</li>
            <li>mniejsze firmy budowlane</li>
            <li>właściciele, którzy chcą mniej Excela i mniej chaosu w dokumentach</li>
          </ul>
        </Card>
        <Card>
          <h3>Na telefonie jak aplikacja</h3>
          <p>LoftDesk działa jako PWA: możesz zainstalować go na telefonie, otwierać w trybie pełnoekranowym i korzystać z niego jak z normalnej aplikacji firmowej.</p>
          <div className="hero__pills" style={{ marginTop: 12 }}>
            <span className="hero-pill"><Smartphone size={14} /> install prompt</span>
            <span className="hero-pill"><ShieldCheck size={14} /> bezpieczny start z HTTPS + manifest</span>
          </div>
        </Card>
      </section>

      <section className="section-block section-block--cta">
        <Card className="cta-card">
          <div>
            <span className="hero__eyebrow">Krótko i konkretnie</span>
            <h2>LoftDesk pomaga firmie budowlanej prowadzić ofertę, dokumenty i realizację bez przeskakiwania między kilkoma narzędziami.</h2>
          </div>
          <div className="hero__actions">
            <Link to={user ? '/dashboard' : '/login'}><Button size="lg">Przejdź do aplikacji</Button></Link>
            <Link to="/login"><Button size="lg" variant="secondary">Zaloguj się</Button></Link>
          </div>
        </Card>
      </section>
    </main>
  )
}
