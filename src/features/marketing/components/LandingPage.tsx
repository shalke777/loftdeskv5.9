import { useState } from 'react';

const LANDING_CSS = `
  * { -webkit-font-smoothing: antialiased; }

  .lp-hero-gradient {
    background: linear-gradient(160deg, #0E3D20 0%, #1A5C32 50%, #1f6b3a 100%);
  }

  .lp-flow-connector {
    width: 2px;
    background: linear-gradient(to bottom, #3E8C58, transparent);
    margin: 0 auto;
    height: 32px;
  }

  .lp-number-badge {
    width: 28px; height: 28px;
    background: #1A5C32;
    color: white;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    flex-shrink: 0;
  }

  details > summary { list-style: none; cursor: pointer; }
  details > summary::-webkit-details-marker { display: none; }
  details[open] .lp-plus { transform: rotate(45deg); }
  .lp-plus { transition: transform .2s ease; display: inline-block; }

  @keyframes lp-slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  .lp-animate-up { animation: lp-slideUp 0.6s ease both; }
  .lp-delay-1 { animation-delay: 0.1s; }
  .lp-delay-2 { animation-delay: 0.2s; }
  .lp-delay-3 { animation-delay: 0.3s; }

  .lp-phone-frame {
    background: #111;
    border-radius: 40px;
    padding: 12px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.1);
  }
  .lp-phone-screen {
    border-radius: 30px;
    overflow: hidden;
    background: #F5F0E8;
  }
  .lp-phone-notch {
    width: 80px; height: 24px;
    background: #111;
    border-radius: 0 0 16px 16px;
    margin: 0 auto;
  }

  .lp-problem-item::before {
    content: '×';
    color: #dc2626;
    font-weight: 700;
    font-size: 16px;
    margin-right: 10px;
    flex-shrink: 0;
  }
  .lp-solution-item::before {
    content: '✓';
    color: #86efac;
    font-weight: 700;
    font-size: 14px;
    margin-right: 10px;
    flex-shrink: 0;
  }
  .lp-problem-item, .lp-solution-item {
    display: flex; align-items: flex-start;
    font-size: 14px; line-height: 1.5;
    padding: 8px 0;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .lp-problem-item:last-child, .lp-solution-item:last-child { border-bottom: none; }
  .lp-solution-item { border-bottom-color: rgba(255,255,255,0.08); }

  .lp-price-card-popular {
    background: linear-gradient(160deg, #1A5C32, #0E3D20);
    box-shadow: 0 16px 48px rgba(26,92,50,0.30);
  }
`;

const FLOW_STEPS = [
  ['Projekt', 'Nowe zlecenie, adres, zakres prac'],
  ['Klient', 'Dane wpisane raz, używane w każdym dokumencie'],
  ['Dokumenty', 'Wycena → Umowa → Faktura, jeden klik każdy krok'],
  ['Akceptacja', 'Klient zatwierdza z telefonu, bez zakładania konta'],
  ['Chat', 'Komunikacja w kontekście projektu, nie w WhatsApp'],
  ['Realizacja', 'Faktura wystawiona, KSeF wysłany, protokół podpisany'],
] as const;

function scrollTo(id: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{LANDING_CSS}</style>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-sand-100/90 border-b border-sand-300">
        <div className="max-w-6xl mx-auto px-5 h-[60px] flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-forest flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">L</span>
            </div>
            <span className="font-bold text-lg text-forest-800 tracking-tight">LoftDesk</span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-ink-60">
            <a href="#jak-dziala" onClick={scrollTo('jak-dziala')} className="hover:text-forest transition-colors">Jak działa</a>
            <a href="#portal" onClick={scrollTo('portal')} className="hover:text-forest transition-colors">Portal klienta</a>
            <a href="#dla-kogo" onClick={scrollTo('dla-kogo')} className="hover:text-forest transition-colors">Dla kogo</a>
            <a href="#cennik" onClick={scrollTo('cennik')} className="hover:text-forest transition-colors">Cennik</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" className="hidden sm:block text-sm font-medium text-ink-60 hover:text-forest transition-colors">Zaloguj</a>
            <a href="#" className="bg-forest text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-forest-700 transition-colors shadow-green">
              Zacznij za darmo
            </a>
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-ink-60 hover:bg-sand-200 transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menu"
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-sand-100/95 backdrop-blur-md border-t border-sand-300 px-5 py-4 flex flex-col gap-4 text-sm font-medium text-ink-60">
            <a href="#jak-dziala" onClick={(e) => { scrollTo('jak-dziala')(e); setMenuOpen(false); }} className="hover:text-forest transition-colors">Jak działa</a>
            <a href="#portal" onClick={(e) => { scrollTo('portal')(e); setMenuOpen(false); }} className="hover:text-forest transition-colors">Portal klienta</a>
            <a href="#dla-kogo" onClick={(e) => { scrollTo('dla-kogo')(e); setMenuOpen(false); }} className="hover:text-forest transition-colors">Dla kogo</a>
            <a href="#cennik" onClick={(e) => { scrollTo('cennik')(e); setMenuOpen(false); }} className="hover:text-forest transition-colors">Cennik</a>
          </div>
        )}
      </nav>

      {/* ── 1. HERO ── */}
      <section className="lp-hero-gradient min-h-screen flex flex-col justify-center pt-[60px]">
        <div className="max-w-6xl mx-auto px-5 py-20 lg:py-28">
          <div className="lg:grid lg:grid-cols-[1fr_480px] lg:gap-16 lg:items-center">

            {/* Left: copy */}
            <div className="mb-14 lg:mb-0" style={{ maxWidth: '600px' }}>
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-7 lp-animate-up">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Polskie firmy remontowe i wykończeniowe
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.08] tracking-tight mb-7 lp-animate-up lp-delay-1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
                Zarządzaj budową<br />bez chaosu —<br />
                <span className="text-green-300">od wyceny do podpisu<br className="hidden sm:block" /> klienta w jednym miejscu.</span>
              </h1>

              <p className="text-white/65 text-lg leading-relaxed mb-10 max-w-lg lp-animate-up lp-delay-2">
                Koniec z Excelem, WhatsApp i szukaniem w mailach. LoftDesk prowadzi Cię przez każde zlecenie — od pierwszego kontaktu po wystawienie faktury i KSeF.
              </p>

              {/* 3 korzyści */}
              <div className="space-y-3 mb-10 lp-animate-up lp-delay-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .82h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </div>
                  <p className="text-white font-medium">Klient przestaje dzwonić — ma portal z odpowiedziami</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <p className="text-white font-medium">Decyzje i akceptacje w minuty, nie w dni</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                  </div>
                  <p className="text-white font-medium">Wszystkie dokumenty projektu w jednym miejscu</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 lp-animate-up lp-delay-3">
                <a href="#jak-dziala" onClick={scrollTo('jak-dziala')} className="bg-white text-forest-800 font-bold px-7 py-4 rounded-xl text-base hover:bg-sand-100 transition-colors shadow-panel text-center">
                  Zobacz jak to działa
                </a>
                <a href="#" className="border border-white/25 text-white font-medium px-7 py-4 rounded-xl text-base hover:bg-white/10 transition-colors text-center">
                  Zacznij za darmo
                </a>
              </div>
              <p className="mt-4 text-white/40 text-sm">14 dni Pro bezpłatnie. Bez karty kredytowej.</p>
            </div>

            {/* Right: hero visual */}
            <div className="hidden lg:block lp-animate-up lp-delay-2">
              <div className="relative">
                {/* Main card */}
                <div className="bg-white rounded-2xl shadow-panel overflow-hidden border border-sand-200">
                  <div className="bg-forest px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-xs font-medium">PROJEKT AKTYWNY</p>
                      <p className="text-white font-semibold text-sm mt-0.5">Mieszkanie Wiśniowa 14, Kraków</p>
                    </div>
                    <span className="bg-green-400/20 text-green-300 text-xs font-semibold px-2.5 py-1 rounded-full">W realizacji</span>
                  </div>
                  <div className="p-5">
                    {/* Progress steps */}
                    <div className="flex items-center gap-1 mb-5">
                      <div className="flex-1 h-1.5 bg-forest rounded-full" />
                      <div className="flex-1 h-1.5 bg-forest rounded-full" />
                      <div className="flex-1 h-1.5 bg-forest rounded-full" />
                      <div className="flex-1 h-1.5 bg-forest rounded-full" />
                      <div className="flex-1 h-1.5 bg-sand-300 rounded-full" />
                      <div className="flex-1 h-1.5 bg-sand-300 rounded-full" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-sand-100 rounded-xl p-3 text-center">
                        <p className="text-xs text-ink-40">Wycena</p>
                        <p className="text-xs font-bold text-forest mt-1">Zaakc.</p>
                      </div>
                      <div className="bg-sand-100 rounded-xl p-3 text-center">
                        <p className="text-xs text-ink-40">Umowa</p>
                        <p className="text-xs font-bold text-forest mt-1">Podp.</p>
                      </div>
                      <div className="bg-rust/10 rounded-xl p-3 text-center">
                        <p className="text-xs text-ink-40">Faktura</p>
                        <p className="text-xs font-bold text-rust mt-1">Ocz.</p>
                      </div>
                    </div>
                    {/* Chat bubble */}
                    <div className="flex items-start gap-2.5 bg-sand-100 rounded-xl p-3">
                      <div className="w-7 h-7 rounded-full bg-forest/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-forest text-xs font-bold">K</span>
                      </div>
                      <div>
                        <p className="text-xs text-ink-40 mb-1">Kasia · 14:22</p>
                        <p className="text-sm text-ink-60">Zaakceptowałam zmiany w łazience. Kiedy zaczynamy kafle?</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-card px-4 py-3 border border-sand-200">
                  <p className="text-xs text-ink-40 mb-0.5">Oszczędność czasu</p>
                  <p className="text-2xl font-black text-forest">3h/dzień</p>
                </div>

                {/* Floating tag bottom */}
                <div className="absolute -bottom-4 -left-4 bg-forest text-white rounded-xl shadow-green px-3 py-2">
                  <p className="text-xs font-semibold">KSeF gotowy</p>
                  <p className="text-xs text-white/60">Wysłano 3/3 faktur</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Wave bottom */}
        <div className="relative">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H0Z" fill="#F5F0E8" />
          </svg>
        </div>
      </section>

      {/* ── 2. JAK DZIAŁA ── */}
      <section id="jak-dziala" className="bg-sand-100 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-16">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Jak działa LoftDesk</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-5">Jeden ciąg. Zero przepisywania.</h2>
            <p className="text-ink-60 text-lg max-w-xl mx-auto">Każdy krok prowadzi naturalnie do następnego. Dane przepływają automatycznie. Klient ma dostęp na bieżąco.</p>
          </div>

          {/* Flow desktop */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute top-8 left-[8.33%] right-[8.33%] h-0.5 bg-gradient-to-r from-transparent via-sand-300 to-transparent" />
              <div className="grid grid-cols-6 gap-4">

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-forest shadow-green flex items-center justify-center mb-4 relative z-10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">Projekt</p>
                  <p className="text-xs text-ink-40 leading-snug">Nowe zlecenie, adres, zakres</p>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-forest shadow-green flex items-center justify-center mb-4 relative z-10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">Klient</p>
                  <p className="text-xs text-ink-40 leading-snug">Dane wpisane raz, używane wszędzie</p>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-forest shadow-green flex items-center justify-center mb-4 relative z-10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">Dokumenty</p>
                  <p className="text-xs text-ink-40 leading-snug">Wycena, umowa, faktura — 1 klik</p>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-rust shadow-panel flex items-center justify-center mb-4 relative z-10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">Akceptacja</p>
                  <p className="text-xs text-ink-40 leading-snug">Klient zatwierdza bez rejestracji</p>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-forest shadow-green flex items-center justify-center mb-4 relative z-10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">Chat</p>
                  <p className="text-xs text-ink-40 leading-snug">Komunikacja w kontekście projektu</p>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl shadow-panel flex items-center justify-center mb-4 relative z-10" style={{ background: '#0E3D20' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">Realizacja</p>
                  <p className="text-xs text-ink-40 leading-snug">Faktura + KSeF + protokół</p>
                </div>

              </div>
            </div>
          </div>

          {/* Flow mobile: vertical */}
          <div className="md:hidden space-y-0 max-w-sm mx-auto">
            {FLOW_STEPS.map(([title, desc], i) => (
              <div key={i} className="flex items-start gap-4 py-4">
                <div className="flex flex-col items-center">
                  <div className="lp-number-badge">{i + 1}</div>
                  {i < 5 && <div className="lp-flow-connector mt-1" />}
                </div>
                <div className="pt-1 pb-4">
                  <p className="font-bold text-ink">{title}</p>
                  <p className="text-sm text-ink-60 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Highlight bar */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-6 text-center">
              <p className="text-4xl font-black text-forest mb-2">0×</p>
              <p className="font-semibold text-ink mb-1">Przepisujesz dane</p>
              <p className="text-sm text-ink-60">NIP, adres, kwoty — raz wprowadzone wchodzą do każdego dokumentu</p>
            </div>
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-6 text-center">
              <p className="text-4xl font-black text-forest mb-2">1 klik</p>
              <p className="font-semibold text-ink mb-1">Wycena staje się umową</p>
              <p className="text-sm text-ink-60">Dane klienta, pozycje i kwoty przepisują się automatycznie</p>
            </div>
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-6 text-center">
              <p className="text-4xl font-black text-rust mb-2">5 → 1</p>
              <p className="font-semibold text-ink mb-1">Narzędzi zamieniasz na jedno</p>
              <p className="text-sm text-ink-60">Excel, Word, WhatsApp, fakturownia, papier — jeden system</p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. PROBLEM VS ROZWIĄZANIE ── */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Przed i po</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">Rozpoznajesz to?</h2>
            <p className="text-ink-60 text-lg max-w-lg mx-auto">Większość firm remontowych zarządza projektami tak samo od lat. Efekt jest zawsze ten sam.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* Problem */}
            <div className="bg-red-50 rounded-2xl border border-red-100 p-7">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <p className="font-bold text-red-700">Bez systemu</p>
              </div>
              <div>
                <div className="lp-problem-item">Kosztorys w Excelu, umowa w Wordzie, faktura w osobnym programie — i to samo przepisujesz trzy razy</div>
                <div className="lp-problem-item">Klient dzwoni „co z projektem" — bo nie wie co się dzieje, a Ty szukasz odpowiedzi w trzech miejscach</div>
                <div className="lp-problem-item">Klient twierdzi, że czegoś nie akceptował — nie ma protokołu, nie ma podpisu, nie ma daty</div>
                <div className="lp-problem-item">WhatsApp jako system zarządzania projektem — ustalenia giną w setkach wiadomości</div>
                <div className="lp-problem-item">Każda zmiana wymaga nowego pliku PDF, nowego maila, nowej odpowiedzi</div>
                <div className="lp-problem-item">KSeF od 2026 obowiązkowy — i nie wiadomo jak się przygotować</div>
              </div>
              <div className="mt-5 p-4 bg-red-100 rounded-xl">
                <p className="text-sm font-semibold text-red-700">Efekt: nadgodziny, spory, niezapłacone faktury, utrata klientów</p>
              </div>
            </div>

            {/* Rozwiązanie */}
            <div className="bg-forest rounded-2xl p-7 shadow-green">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-bold text-white">Z LoftDesk</p>
              </div>
              <div>
                <div className="lp-solution-item text-white/80">Dane klienta wpisane raz — wchodzą do wyceny, umowy i faktury automatycznie</div>
                <div className="lp-solution-item text-white/80">Klient ma portal na telefonie — widzi projekt, dokumenty, postęp. Przestaje dzwonić</div>
                <div className="lp-solution-item text-white/80">Każda akceptacja ma datę, godzinę i IP — twardy dowód w razie sporu</div>
                <div className="lp-solution-item text-white/80">Chat w kontekście projektu — każda decyzja powiązana z konkretnym zleceniem</div>
                <div className="lp-solution-item text-white/80">Zmiana zakresu? Klient akceptuje aktualizację bezpośrednio w portalu</div>
                <div className="lp-solution-item text-white/80">KSeF wbudowany — faktura wystawiona, wysłana do MF, status w aplikacji</div>
              </div>
              <div className="mt-5 p-4 bg-white/10 rounded-xl border border-white/20">
                <p className="text-sm font-semibold text-white">Efekt: mniej telefonów, szybsze decyzje, brak sporów, gotowość na KSeF</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. PORTAL KLIENTA ── */}
      <section id="portal" className="bg-sand-100 py-20 sm:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Portal klienta</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-5">
              Klient widzi projekt.<br className="hidden sm:block" />
              Ty widzisz spokój.
            </h2>
            <p className="text-ink-60 text-lg max-w-xl mx-auto">
              To jedyna aplikacja na polskim rynku, gdzie wykonawca i inwestor pracują w tym samym systemie. Klient ma swój widok — Ty masz kontrolę.
            </p>
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">

            {/* Phone mockup */}
            <div className="mb-14 lg:mb-0 flex justify-center">
              <div className="lp-phone-frame w-[280px]">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
                  {/* Status bar */}
                  <div className="bg-forest px-4 pt-1 pb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/50 text-[10px]">9:41</span>
                      <div className="flex gap-1 items-center">
                        <div className="w-3 h-1 rounded-sm bg-white/40" />
                        <div className="w-3 h-1 rounded-sm bg-white/60" />
                        <div className="w-3 h-1 rounded-sm bg-white/90" />
                      </div>
                    </div>
                    <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide">Twój projekt</p>
                    <p className="text-white font-bold text-sm leading-tight mt-0.5">Mieszkanie — ul. Wiśniowa 14</p>
                  </div>
                  {/* Tabs */}
                  <div className="flex border-b border-sand-200 bg-white text-[11px]">
                    <button className="flex-1 py-2.5 font-bold text-forest border-b-2 border-forest">Dokumenty</button>
                    <button className="flex-1 py-2.5 font-medium text-ink-40">Chat</button>
                    <button className="flex-1 py-2.5 font-medium text-ink-40">Postęp</button>
                  </div>
                  {/* Docs */}
                  <div className="bg-white p-3 space-y-2">
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-green-50 border border-green-100">
                      <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-forest text-[10px] font-black">WYC</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-ink truncate">Kosztorys #WYC/2025/12</p>
                        <p className="text-[10px] text-ink-40">38 400 zł brutto</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="#16a34a">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-green-50 border border-green-100">
                      <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-forest text-[10px] font-black">UMW</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-ink truncate">Umowa #UMW/2025/12</p>
                        <p className="text-[10px] text-ink-40">3 transze płatności</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="#16a34a">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-rust/5 border border-rust/20">
                      <div className="w-8 h-8 rounded-lg bg-rust/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-rust text-[10px] font-black">PRO</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-ink truncate">Protokół odbioru</p>
                        <p className="text-[10px] text-ink-40">Oczekuje na podpis</p>
                      </div>
                      <button className="text-[10px] font-bold text-rust bg-rust/10 px-2 py-1 rounded-lg whitespace-nowrap">Podpisz</button>
                    </div>
                  </div>
                  {/* Chat preview */}
                  <div className="bg-sand-100 p-3 border-t border-sand-200">
                    <p className="text-[10px] text-ink-40 font-medium mb-1.5">Ostatnia wiadomość</p>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-forest/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-forest text-[9px] font-bold">K</span>
                      </div>
                      <p className="text-[11px] text-ink-60 leading-snug">Kiedy zaczynamy układanie kafli? Czy materiały już są?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div>
              <div className="space-y-6">

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Klient przestaje dzwonić</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Portal daje klientowi odpowiedzi na wszystkie pytania: co jest ustalone, co zaakceptowane, co czeka, kiedy następna płatność. Sam sprawdza — zamiast pytać Ciebie.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Akceptacje z dowodem prawnym</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Każda akceptacja klienta — kosztorysu, zmiany, protokołu — zapisuje datę, godzinę i adres IP. To twardy dowód w razie sporu. Papier tego nie daje.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={3} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Instalacja bez App Store</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Klient dostaje link. Otwiera go na telefonie i instaluje LoftDesk jak aplikację — bez sklepu, bez rejestracji, bez hasła. Ty wyglądasz jak profesjonalna firma.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Klient widzi tylko swoje dane</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Twoje koszty, marże i notatki wewnętrzne są niewidoczne dla klienta. Portal pokazuje tylko to, co chcesz udostępnić — dokumenty, zdjęcia postępu, wiadomości.</p>
                  </div>
                </div>

              </div>

              <div className="mt-8">
                <a href="#" className="inline-block bg-forest text-white font-bold px-6 py-3.5 rounded-xl hover:bg-forest-700 transition-colors shadow-green text-sm">
                  Zaproś klienta do portalu
                </a>
                <p className="text-xs text-ink-40 mt-2">Dostępne w planie Pro — 14 dni za darmo</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. DLA KOGO ── */}
      <section id="dla-kogo" className="bg-white py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Dla kogo</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">LoftDesk jest dla Ciebie, jeśli...</h2>
            <p className="text-ink-60 text-lg max-w-lg mx-auto">Pracujesz z klientami indywidualnymi lub firmami przy remontach, wykończeniach i pracach budowlanych.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Segment 1 */}
            <div className="bg-sand-100 rounded-2xl border border-sand-200 p-7 hover:shadow-card transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-forest/10 flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <p className="font-black text-ink text-lg mb-2">Firmy wykończeniowe i remontowe</p>
              <p className="text-sm text-ink-60 leading-relaxed mb-5">Obsługujesz mieszkania, domy i biura. Masz regularnych klientów, kilka projektów jednocześnie, ekipę 2–8 osób. Potrzebujesz porządku, nie ERP.</p>
              <div className="space-y-2 text-sm text-ink-60">
                <p className="flex items-center gap-2"><span className="text-forest font-bold">→</span> Kosztorysy i umowy bez Worda</p>
                <p className="flex items-center gap-2"><span className="text-forest font-bold">→</span> Klient akceptuje zmiany zdalnie</p>
                <p className="flex items-center gap-2"><span className="text-forest font-bold">→</span> Faktury i KSeF bez oddzielnego programu</p>
              </div>
            </div>

            {/* Segment 2 */}
            <div className="bg-forest rounded-2xl p-7 shadow-green">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <p className="font-black text-white text-lg mb-2">Studia projektowania z realizacją</p>
              <p className="text-sm text-white/70 leading-relaxed mb-5">Projektujesz i nadzorsujesz realizację. Klient jest na bieżąco — akceptuje materiały, zatwierdza zmiany, śledzi postęp. Dokumentacja jest Twoją wizytówką.</p>
              <div className="space-y-2 text-sm text-white/70">
                <p className="flex items-center gap-2"><span className="text-green-300 font-bold">→</span> Portal klienta jako element usługi premium</p>
                <p className="flex items-center gap-2"><span className="text-green-300 font-bold">→</span> Dokumentacja fotograficzna z kategorii</p>
                <p className="flex items-center gap-2"><span className="text-green-300 font-bold">→</span> Podpisy elektroniczne na dokumentach</p>
              </div>
            </div>

            {/* Segment 3 */}
            <div className="bg-sand-100 rounded-2xl border border-sand-200 p-7 hover:shadow-card transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-rust/10 flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8742A" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <p className="font-black text-ink text-lg mb-2">Małe firmy budowlane z ekipą</p>
              <p className="text-sm text-ink-60 leading-relaxed mb-5">Prowadzisz ekipę specjalistów. Potrzebujesz śledzić kto co robi, kontrolować budżety projektów i rozliczać się z klientami bez chaosu.</p>
              <div className="space-y-2 text-sm text-ink-60">
                <p className="flex items-center gap-2"><span className="text-rust font-bold">→</span> Role pracowników i podział zadań</p>
                <p className="flex items-center gap-2"><span className="text-rust font-bold">→</span> Koszty projektu vs budżet</p>
                <p className="flex items-center gap-2"><span className="text-rust font-bold">→</span> Raporty marżowości per projekt</p>
              </div>
            </div>

          </div>

          <div className="mt-10 text-center">
            <p className="text-ink-40 text-sm">
              Nie wiesz czy LoftDesk jest dla Ciebie?{' '}
              <a href="#" className="text-forest font-semibold underline underline-offset-2">Napisz do nas</a>
              {' '}— odpiszemy w ciągu godziny.
            </p>
          </div>

        </div>
      </section>

      {/* ── 6. KOSZT BRAKU SYSTEMU ── */}
      <section className="bg-ink py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-3">Ile to kosztuje</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-5">Brak systemu też kosztuje.<br className="hidden sm:block" />Tylko nikt tego nie liczy.</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">Zanim zdecydujesz czy 49 zł miesięcznie to dużo, policz co tracisz bez LoftDesk.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-4xl font-black text-white mb-2">3h</p>
              <p className="text-sm font-semibold text-white/70 mb-2">dziennie na administrację</p>
              <p className="text-xs text-white/40 leading-snug">Maile, przepisywanie danych, szukanie plików, odpowiadanie na pytania klienta</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-4xl font-black text-rust-light mb-2">2×</p>
              <p className="text-sm font-semibold text-white/70 mb-2">więcej sporów bez dowodów</p>
              <p className="text-xs text-white/40 leading-snug">Brak podpisanych protokołów, brak logów akceptacji, brak historii zmian</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-4xl font-black text-white mb-2">1/3</p>
              <p className="text-sm font-semibold text-white/70 mb-2">klientów odchodzi przez brak komunikacji</p>
              <p className="text-xs text-white/40 leading-snug">Klient nie wie co się dzieje, czuje się ignorowany, nie wraca i nie poleca</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-4xl font-black text-rust-light mb-2">2026</p>
              <p className="text-sm font-semibold text-white/70 mb-2">KSeF obowiązkowy</p>
              <p className="text-xs text-white/40 leading-snug">Brak gotowości = odrzucone faktury, kary, utrata płynności finansowej</p>
            </div>

          </div>

          {/* CTA callout */}
          <div className="bg-forest rounded-2xl p-8 sm:p-10 text-center shadow-green">
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-4">
              49 zł miesięcznie.<br className="sm:hidden" />
              Tyle kosztuje LoftDesk Pro.
            </h3>
            <p className="text-white/70 text-lg mb-8 max-w-lg mx-auto">
              Mniej niż jedna godzina pracy administracyjnej którą eliminujesz pierwszego dnia.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#" className="bg-white text-forest-800 font-bold px-8 py-4 rounded-xl text-base hover:bg-sand-100 transition-colors shadow-panel">
                Zacznij 14 dni za darmo
              </a>
              <a href="#" className="border border-white/25 text-white font-medium px-8 py-4 rounded-xl text-base hover:bg-white/10 transition-colors">
                Obejrzyj demo
              </a>
            </div>
            <p className="mt-4 text-white/40 text-sm">Bez karty kredytowej. Bez zobowiązań. Plan Free dostępny zawsze.</p>
          </div>

        </div>
      </section>

      {/* ── CENNIK ── */}
      <section id="cennik" className="bg-sand-100 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-12">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Cennik</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">Prosty cennik.</h2>
            <p className="text-ink-60 text-lg">14 dni Pro gratis dla każdego nowego konta.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* Free */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-7">
              <p className="text-xs font-bold text-ink-40 uppercase tracking-widest mb-4">Free</p>
              <div className="mb-1">
                <span className="text-5xl font-black text-ink">0</span>
                <span className="text-ink-40 font-medium"> zł/mc</span>
              </div>
              <p className="text-sm text-ink-40 mb-6">Na zawsze bezpłatny</p>
              <a href="#" className="block text-center border-2 border-sand-300 text-ink font-semibold py-3 rounded-xl hover:border-forest hover:text-forest transition-colors text-sm mb-7">
                Zacznij za darmo
              </a>
              <ul className="space-y-3 text-sm text-ink-60">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-300 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-40 font-bold">✓</span>
                  Do 5 projektów
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-300 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-40 font-bold">✓</span>
                  Do 10 klientów i faktur
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-300 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-40 font-bold">✓</span>
                  Kosztorysy, umowy, PDF
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-20 font-bold">—</span>
                  <span className="text-ink-20">Portal klienta</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-20 font-bold">—</span>
                  <span className="text-ink-20">KSeF</span>
                </li>
              </ul>
            </div>

            {/* Pro */}
            <div className="lp-price-card-popular rounded-2xl p-7 relative">
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="bg-rust text-white text-xs font-bold px-4 py-1 rounded-full shadow-panel">Najpopularniejszy</span>
              </div>
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Pro</p>
              <div className="mb-1">
                <span className="text-5xl font-black text-white">49</span>
                <span className="text-white/50 font-medium"> zł/mc</span>
              </div>
              <p className="text-sm text-white/50 mb-6">14 dni za darmo · bez karty</p>
              <a href="#" className="block text-center bg-white text-forest-800 font-bold py-3 rounded-xl hover:bg-sand-100 transition-colors text-sm mb-7 shadow-panel">
                Zacznij 14 dni za darmo
              </a>
              <ul className="space-y-3 text-sm text-white/80">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">✓</span>
                  Bez limitu projektów i faktur
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">✓</span>
                  <span className="font-semibold text-white">Portal klienta</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">✓</span>
                  <span className="font-semibold text-white">KSeF — pełna integracja</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">✓</span>
                  AI — kosztorys z głosu
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">✓</span>
                  AI — analiza PDF projektu
                </li>
              </ul>
            </div>

            {/* Business */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-7">
              <p className="text-xs font-bold text-ink-40 uppercase tracking-widest mb-4">Business</p>
              <div className="mb-1">
                <span className="text-5xl font-black text-ink">119</span>
                <span className="text-ink-40 font-medium"> zł/mc</span>
              </div>
              <p className="text-sm text-ink-40 mb-6">Dla firm z ekipą</p>
              <a href="#" className="block text-center border-2 border-forest text-forest font-semibold py-3 rounded-xl hover:bg-forest/5 transition-colors text-sm mb-7">
                Zacznij 14 dni za darmo
              </a>
              <ul className="space-y-3 text-sm text-ink-60">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">✓</span>
                  Wszystko z Pro
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">✓</span>
                  <span className="font-semibold text-ink">Zarządzanie zespołem</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">✓</span>
                  Role i uprawnienia
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">✓</span>
                  <span className="font-semibold text-ink">Własne logo na dokumentach</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">✓</span>
                  Zaawansowane raporty
                </li>
              </ul>
            </div>

          </div>

          <div className="mt-6 max-w-5xl mx-auto p-4 rounded-xl border border-rust/20 flex items-start gap-3" style={{ background: 'rgba(184,116,42,0.08)' }}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-rust" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-rust-dark">
              <strong>KSeF obowiązkowy od 1 lutego 2026</strong> dla wszystkich firm. Plan Pro zawiera pełną integrację — bez dodatkowych kosztów, bez konfiguracji.
            </span>
          </div>

        </div>
      </section>

      {/* ── CTA KOŃCOWE ── */}
      <section className="lp-hero-gradient py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 leading-tight">
            Zacznij z porządkiem.<br />
            <span className="text-green-300">Twoi klienci to poczują.</span>
          </h2>
          <p className="text-white/65 text-lg mb-10 max-w-lg mx-auto">
            Rejestracja w 3 minuty. 14 dni pełnego planu Pro. Bez karty kredytowej — jeśli nie przekona Cię system, wróć do Excela bez żadnych kosztów.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <a href="#" className="bg-white text-forest-800 font-black px-8 py-4 rounded-xl text-lg hover:bg-sand-100 transition-colors shadow-panel">
              Zacznij za darmo — 14 dni Pro
            </a>
          </div>
          <p className="text-white/40 text-sm">Bez karty. Bez umów. Plan Free dostępny zawsze.</p>

          <div className="mt-14 pt-10 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-white/50 text-sm">
            <div>
              <p className="text-2xl font-black text-white mb-1">RODO</p>
              <p className="text-xs">Zgodność z przepisami UE</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white mb-1">PL</p>
              <p className="text-xs">Serwery w Polsce</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white mb-1">SSL</p>
              <p className="text-xs">Szyfrowanie end-to-end</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white mb-1">KSeF</p>
              <p className="text-xs">Gotowość 2026</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 border-t border-white/5" style={{ background: '#0E3D20' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white font-black text-sm">L</span>
              </div>
              <span className="font-bold text-white text-lg tracking-tight">LoftDesk</span>
              <span className="text-white/30 text-sm hidden sm:block">· Polska aplikacja dla firm wykończeniowych</span>
            </div>
            <div className="flex gap-6 text-sm text-white/30">
              <a href="#" className="hover:text-white/60 transition-colors">Polityka prywatności</a>
              <a href="#" className="hover:text-white/60 transition-colors">Regulamin</a>
              <a href="#" className="hover:text-white/60 transition-colors">Kontakt</a>
            </div>
          </div>
          <p className="mt-8 text-white/20 text-xs text-center sm:text-left">© 2025 LoftDesk. Wszelkie prawa zastrzeżone. NIP: — · ul. —</p>
        </div>
      </footer>
    </>
  );
}

export default LandingPage;
