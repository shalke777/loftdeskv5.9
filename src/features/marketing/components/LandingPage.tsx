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
    width: 32px; height: 32px;
    background: #1A5C32;
    color: white;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    flex-shrink: 0;
  }

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
    line-height: 1.5;
  }
  .lp-solution-item::before {
    content: '✓';
    color: #86efac;
    font-weight: 700;
    font-size: 14px;
    margin-right: 10px;
    flex-shrink: 0;
    line-height: 1.5;
  }
  .lp-problem-item, .lp-solution-item {
    display: flex; align-items: flex-start;
    font-size: 14px; line-height: 1.6;
    padding: 10px 0;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .lp-problem-item:last-child, .lp-solution-item:last-child { border-bottom: none; }
  .lp-solution-item { border-bottom-color: rgba(255,255,255,0.08); }

  .lp-price-card-popular {
    background: linear-gradient(160deg, #1A5C32, #0E3D20);
    box-shadow: 0 16px 48px rgba(26,92,50,0.30);
  }

  .lp-decision-card {
    background: white;
    border: 1px solid #EDE8DD;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06);
  }

  .lp-roi-callout {
    background: linear-gradient(135deg, #0E3D20, #1A5C32);
    border-radius: 16px;
    padding: 28px 32px;
    box-shadow: 0 8px 32px rgba(26,92,50,0.25);
  }

  .lp-case-card {
    background: white;
    border: 1px solid #EDE8DD;
    border-radius: 20px;
    padding: 36px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }

  .lp-flow-step {
    position: relative;
  }
  .lp-flow-step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -20px;
    width: 16px;
    height: 2px;
    background: #DDD6C9;
    transform: translateY(-50%);
  }

  .lp-social-bar {
    background: #0E3D20;
  }

  /* ── NAV ── */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    background: rgba(245, 240, 232, 0.93);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid #DDD6C9;
  }
  .lp-nav-inner {
    max-width: 72rem; margin: 0 auto; padding: 0 20px;
    height: 60px; display: flex; align-items: center; justify-content: space-between;
  }
  .lp-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .lp-nav-logo-icon {
    width: 28px; height: 28px; background: #1A5C32; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .lp-nav-logo-text { font-weight: 700; font-size: 1.05rem; color: #1A5C32; letter-spacing: -0.01em; }
  .lp-nav-links {
    display: none; align-items: center; gap: 28px;
    font-size: 0.875rem; font-weight: 500;
  }
  @media (min-width: 768px) { .lp-nav-links { display: flex; } }
  .lp-nav-links a { color: #666; text-decoration: none; transition: color .15s; }
  .lp-nav-links a:hover { color: #1A5C32; }
  .lp-nav-right { display: flex; align-items: center; gap: 12px; }
  .lp-nav-login {
    display: none; font-size: 0.875rem; font-weight: 500;
    color: #666; text-decoration: none; transition: color .15s;
  }
  @media (min-width: 640px) { .lp-nav-login { display: block; } }
  .lp-nav-login:hover { color: #1A5C32; }
  .lp-nav-cta {
    background: #1A5C32; color: #fff; font-size: 0.875rem; font-weight: 600;
    padding: 8px 16px; border-radius: 8px; text-decoration: none;
    transition: background .15s; box-shadow: 0 4px 16px rgba(26,92,50,0.25);
  }
  .lp-nav-cta:hover { background: #236B3A; color: #fff; }
  .lp-nav-burger {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 8px;
    border: none; background: transparent; cursor: pointer; color: #666;
  }
  @media (min-width: 768px) { .lp-nav-burger { display: none; } }
  .lp-nav-mobile {
    background: rgba(245, 240, 232, 0.97); backdrop-filter: blur(20px);
    border-top: 1px solid #DDD6C9; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 16px;
    font-size: 0.875rem; font-weight: 500;
  }
  .lp-nav-mobile a { color: #666; text-decoration: none; }
  .lp-nav-mobile a:hover { color: #1A5C32; }
`;

const FLOW_STEPS_DATA = [
  {
    num: '1',
    label: 'Klient',
    desc: 'Wpisujesz dane raz. Imię, NIP, adres — automatycznie trafiają do każdego dokumentu.',
  },
  {
    num: '2',
    label: 'Wycena',
    desc: 'Tworzysz kosztorys ręcznie lub dyktując go głosem (AI). Klient dostaje link — akceptuje bez rejestracji.',
  },
  {
    num: '3',
    label: 'Umowa',
    desc: 'Jeden klik: wycena staje się umową. Kwoty, dane klienta, zakres — już wypełnione. Dodajesz transze płatności.',
  },
  {
    num: '4',
    label: 'Portal',
    desc: 'Klient widzi projekt: dokumenty, zdjęcia postępu, wiadomości. Akceptuje zmiany. Przestaje dzwonić.',
  },
  {
    num: '5',
    label: 'Faktura',
    desc: 'Po akceptacji transzy: faktura gotowa w 30 sekund. Dane z umowy. NIP, kwota, numer — już tam są.',
  },
  {
    num: '6',
    label: 'KSeF',
    desc: 'Jeden klik: faktura wysłana do Ministerstwa Finansów. Status w systemie. Archiwum bez osobnego programu.',
  },
  {
    num: '7',
    label: 'Protokół',
    desc: 'Podpisanie elektroniczne na telefonie. Data, podpis, zakres — twardy dowód zakończenia projektu.',
  },
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

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <a href="/" className="lp-nav-logo">
            <div className="lp-nav-logo-icon">
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.78rem' }}>L</span>
            </div>
            <span className="lp-nav-logo-text">LoftDesk</span>
          </a>

          <div className="lp-nav-links">
            <a href="#jak-dziala" onClick={scrollTo('jak-dziala')}>Jak działa</a>
            <a href="#portal" onClick={scrollTo('portal')}>Portal klienta</a>
            <a href="#cennik" onClick={scrollTo('cennik')}>Cennik</a>
          </div>

          <div className="lp-nav-right">
            <a href="#" className="lp-nav-login">Zaloguj</a>
            <a href="#" className="lp-nav-cta">Zacznij za darmo</a>
            <button className="lp-nav-burger" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
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

        {menuOpen && (
          <div className="lp-nav-mobile">
            <a href="#jak-dziala" onClick={(e) => { scrollTo('jak-dziala')(e); setMenuOpen(false); }}>Jak działa</a>
            <a href="#portal" onClick={(e) => { scrollTo('portal')(e); setMenuOpen(false); }}>Portal klienta</a>
            <a href="#cennik" onClick={(e) => { scrollTo('cennik')(e); setMenuOpen(false); }}>Cennik</a>
          </div>
        )}
      </nav>

      {/* 1. HERO */}
      <section className="lp-hero-gradient min-h-screen flex flex-col justify-center pt-[60px]">
        <div className="max-w-6xl mx-auto px-5 py-20 lg:py-28">
          <div className="lg:grid lg:grid-cols-[1fr_460px] lg:gap-16 lg:items-center">

            <div className="mb-14 lg:mb-0" style={{ maxWidth: '600px' }}>
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 lp-animate-up">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                System operacyjny dla firm wykończeniowych
              </div>

              <h1 className="font-black text-white leading-[1.06] tracking-tight mb-7 lp-animate-up lp-delay-1" style={{ fontSize: 'clamp(1.9rem, 4.2vw, 3.1rem)' }}>
                Twoi klienci przestają dzwonić. Twoje projekty nie gubią dokumentów. Płatności nie czekają tygodniami.
              </h1>

              <p className="text-white/65 text-lg leading-relaxed mb-10 max-w-xl lp-animate-up lp-delay-2">
                LoftDesk to system operacyjny dla firm wykończeniowych. Jeden przepływ — od pierwszego kontaktu do zamkniętej faktury.
              </p>

              {/* 3 stat badges */}
              <div className="flex flex-wrap gap-3 mb-10 lp-animate-up lp-delay-2">
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5">
                  <p className="text-white font-semibold text-sm">Średnio 3h/dzień mniej administracji</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5">
                  <p className="text-white font-semibold text-sm">8&times; szybsza akceptacja dokumentów</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5">
                  <p className="text-white font-semibold text-sm">Zero sporów dzięki logowi decyzji</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 lp-animate-up lp-delay-3">
                <a href="#" className="bg-white text-forest-800 font-bold px-7 py-4 rounded-xl text-base hover:bg-sand-100 transition-colors shadow-panel text-center">
                  Zacznij — 14 dni za darmo
                </a>
                <a href="#jak-dziala" onClick={scrollTo('jak-dziala')} className="border border-white/25 text-white font-medium px-7 py-4 rounded-xl text-base hover:bg-white/10 transition-colors text-center">
                  Obejrzyj 3-minutowe demo
                </a>
              </div>
              <p className="mt-4 text-white/40 text-sm">Bez karty kredytowej. Bez umów.</p>
            </div>

            {/* Hero card */}
            <div className="hidden lg:block lp-animate-up lp-delay-2">
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-panel overflow-hidden border border-sand-200">
                  <div className="bg-forest px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-xs font-medium uppercase tracking-wide">Projekt aktywny</p>
                      <p className="text-white font-semibold text-sm mt-0.5">Mieszkanie Wiśniowa 14, Kraków</p>
                    </div>
                    <span className="bg-green-400/20 text-green-300 text-xs font-semibold px-2.5 py-1 rounded-full">W realizacji</span>
                  </div>
                  <div className="p-5">
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
                        <p className="text-xs font-bold text-rust mt-1">Gotowa</p>
                      </div>
                    </div>
                    <div className="bg-forest/5 border border-forest/10 rounded-xl p-3 mb-3">
                      <p className="text-xs font-semibold text-forest mb-1">Następne działanie</p>
                      <p className="text-sm text-ink-60">Wyślij fakturę za transzę 2 — 12 400 zł</p>
                    </div>
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
                <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-card px-4 py-3 border border-sand-200">
                  <p className="text-xs text-ink-40 mb-0.5">Oszczędność czasu</p>
                  <p className="text-2xl font-black text-forest">3h/dzień</p>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-forest text-white rounded-xl shadow-green px-3 py-2">
                  <p className="text-xs font-semibold">KSeF gotowy</p>
                  <p className="text-xs text-white/60">Wysłano 3/3 faktur</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="relative">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H0Z" fill="#F5F0E8" />
          </svg>
        </div>
      </section>

      {/* 2. SOCIAL PROOF BAR */}
      <section className="lp-social-bar py-5">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm font-semibold text-white/70">
            <span>Ponad 200 firm wykończeniowych w Polsce</span>
            <span className="hidden sm:block text-white/30">|</span>
            <span>Zgodność z KSeF od dnia 1</span>
            <span className="hidden sm:block text-white/30">|</span>
            <span>Wdrożenie w 15 minut</span>
            <span className="hidden sm:block text-white/30">|</span>
            <span>RODO &bull; serwery PL</span>
          </div>
        </div>
      </section>

      {/* 3. ROI — Ile kosztuje chaos */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Ile kosztuje chaos</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">Każdy miesiąc bez systemu ma cenę.</h2>
            <p className="text-ink-60 text-lg max-w-xl mx-auto">Zanim zdecydujesz czy 49 zł to dużo — policz co tracisz bez LoftDesk.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">

            {/* Left: problem */}
            <div className="bg-red-50 rounded-2xl border border-red-100 p-7">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <p className="font-bold text-red-700">Twoja sytuacja bez LoftDesk</p>
              </div>
              <div>
                <div className="lp-problem-item">2–3h dziennie na przepisywanie danych między Excelem, Wordem i emailem — to 60h miesięcznie pracy administracyjnej</div>
                <div className="lp-problem-item">Klient twierdzi, że tego nie akceptował — nie masz dowodu. Sprawa trafia do prawnika.</div>
                <div className="lp-problem-item">Faktura czeka 3 tygodnie, bo klient gubi maile i nie może znaleźć co ma zapłacić</div>
                <div className="lp-problem-item">Projekt się kończy, ale nie masz podpisanego protokołu. Zabezpieczenie = zero.</div>
                <div className="lp-problem-item">KSeF od 2026 obowiązkowy — system nie jest gotowy, kara za niezgodność: odrzucone faktury</div>
              </div>
            </div>

            {/* Right: solution */}
            <div className="bg-forest rounded-2xl p-7 shadow-green">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-bold text-white">Z LoftDesk — konkretnie</p>
              </div>
              <div>
                <div className="lp-solution-item text-white/85">Dane wpisane raz — przepływają do wyceny, umowy i faktury automatycznie. Zero duplikatów.</div>
                <div className="lp-solution-item text-white/85">Każda akceptacja ma timestamp i IP klienta. Spory rozstrzygasz w 5 minut.</div>
                <div className="lp-solution-item text-white/85">Klient widzi fakturę w portalu — klika &ldquo;Zapłać&rdquo; lub zadaje pytanie w tym samym miejscu</div>
                <div className="lp-solution-item text-white/85">Protokół odbioru podpisany elektronicznie, zarchiwizowany, z datą. Masz dowód.</div>
                <div className="lp-solution-item text-white/85">KSeF wbudowany w Pro. Faktura zatwierdzona &rarr; wysłana do MF jednym klikiem.</div>
              </div>
            </div>

          </div>

          {/* ROI callout box */}
          <div className="mt-8 max-w-5xl mx-auto lp-roi-callout">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-white font-bold text-lg leading-snug">
                  Eliminacja 60h administracji miesięcznie = 3 600 zł przy stawce 60 zł/h.
                </p>
                <p className="text-white/70 text-sm mt-1">LoftDesk Pro kosztuje 49 zł. Zwrot z inwestycji: 73&times;.</p>
              </div>
              <a href="#" className="flex-shrink-0 bg-white text-forest-800 font-bold px-6 py-3 rounded-xl text-sm hover:bg-sand-100 transition-colors shadow-panel whitespace-nowrap">
                Zacznij za darmo
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section id="jak-dziala" className="bg-sand-100 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-16">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Jeden przepływ, zero przepisywania</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-5">Od pierwszego kontaktu do zamkniętej faktury — bez wychodzenia z systemu.</h2>
            <p className="text-ink-60 text-lg max-w-2xl mx-auto">Każdy krok prowadzi naturalnie do następnego. Dane przepływają automatycznie. Klient akceptuje w czasie rzeczywistym.</p>
          </div>

          {/* Desktop: horizontal row */}
          <div className="hidden lg:block mb-12">
            <div className="grid grid-cols-7 gap-3">
              {FLOW_STEPS_DATA.map((step) => (
                <div key={step.num} className="flex flex-col items-center text-center group">
                  <div className="w-12 h-12 rounded-2xl bg-forest shadow-green flex items-center justify-center mb-3 relative z-10 group-hover:bg-forest-700 transition-colors">
                    <span className="text-white font-black text-base">{step.num}</span>
                  </div>
                  <p className="font-bold text-sm text-ink mb-1">{step.label}</p>
                  <p className="text-xs text-ink-60 leading-snug">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical */}
          <div className="lg:hidden space-y-0 max-w-lg mx-auto mb-12">
            {FLOW_STEPS_DATA.map((step, i) => (
              <div key={step.num} className="flex items-start gap-4 py-4">
                <div className="flex flex-col items-center">
                  <div className="lp-number-badge">{step.num}</div>
                  {i < 6 && <div className="lp-flow-connector mt-1" />}
                </div>
                <div className="pt-1 pb-2">
                  <p className="font-bold text-ink">{step.label}</p>
                  <p className="text-sm text-ink-60 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-6 text-center">
              <p className="text-4xl font-black text-forest mb-2">0&times;</p>
              <p className="font-semibold text-ink mb-1">Przepisujesz dane</p>
              <p className="text-sm text-ink-60">NIP, adres, kwoty — raz wprowadzone wchodzą do każdego dokumentu</p>
            </div>
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-6 text-center">
              <p className="text-4xl font-black text-forest mb-2">1 klik</p>
              <p className="font-semibold text-ink mb-1">Wycena staje się umową</p>
              <p className="text-sm text-ink-60">Dane klienta, pozycje i kwoty przepisują się automatycznie</p>
            </div>
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-6 text-center">
              <p className="text-4xl font-black text-rust mb-2">30 s</p>
              <p className="font-semibold text-ink mb-1">Faktura po akceptacji</p>
              <p className="text-sm text-ink-60">Dane z umowy, NIP klienta, kwota transzy — wszystko gotowe</p>
            </div>
          </div>

        </div>
      </section>

      {/* 5. CLIENT DECISIONS */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Killer feature</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">System decyzji klienta.</h2>
            <p className="text-ink-60 text-lg max-w-2xl mx-auto">Największy problem firm remontowych to nie brak dokumentów — to brak dowodów. LoftDesk to zmienia.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">

            <div className="lp-decision-card">
              <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <p className="font-black text-ink text-base mb-3">Akceptacja wyceny</p>
              <div className="bg-sand-100 rounded-xl p-3 mb-3 border border-sand-200">
                <p className="text-xs text-ink-40 font-medium mb-1">Log systemowy</p>
                <p className="text-sm text-ink font-medium">&ldquo;Klient kliknął &lsquo;Akceptuję kosztorys&rsquo; 14 marca o 21:37, adres IP: 212.77.x.x&rdquo;</p>
              </div>
              <p className="text-sm text-ink-60 leading-relaxed">To jest Twój dowód. W razie sporu — nieodwołalny.</p>
            </div>

            <div className="lp-decision-card">
              <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <p className="font-black text-ink text-base mb-3">Zmiana zakresu</p>
              <div className="bg-sand-100 rounded-xl p-3 mb-3 border border-sand-200">
                <p className="text-xs text-ink-40 font-medium mb-1">Log systemowy</p>
                <p className="text-sm text-ink font-medium">&ldquo;Klient poprosił o dodanie kafli w łazience — zaakceptował aneks do umowy 2 dni później.&rdquo;</p>
              </div>
              <p className="text-sm text-ink-60 leading-relaxed">Każda zmiana ma datę, treść i podpis. Zabezpiecza Ciebie i klienta.</p>
            </div>

            <div className="lp-decision-card">
              <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  <polyline points="9 15 12 18 15 15" /><line x1="12" y1="12" x2="12" y2="18" />
                </svg>
              </div>
              <p className="font-black text-ink text-base mb-3">Odbiór projektu</p>
              <div className="bg-sand-100 rounded-xl p-3 mb-3 border border-sand-200">
                <p className="text-xs text-ink-40 font-medium mb-1">Log systemowy</p>
                <p className="text-sm text-ink font-medium">&ldquo;Protokół podpisany elektronicznie 28 marca, zakres: pełne wykończenie kuchni.&rdquo;</p>
              </div>
              <p className="text-sm text-ink-60 leading-relaxed">Nie ma niedomówień. Nie ma &ldquo;przecież się umawialiśmy inaczej&rdquo;.</p>
            </div>

          </div>

          <div className="max-w-5xl mx-auto bg-forest/5 border border-forest/15 rounded-2xl p-6 text-center">
            <p className="text-ink-60 text-base leading-relaxed max-w-2xl mx-auto">
              Większość sporów w branży remontowej powstaje przez brak pisemnych dowodów decyzji. LoftDesk robi to automatycznie — przy każdej akceptacji klienta.
            </p>
          </div>

        </div>
      </section>

      {/* 6. CASE STUDY */}
      <section className="bg-sand-100 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-5">

          <div className="text-center mb-12">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Wyniki z praktyki</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">Jak firma MMO Artis skróciła cykl fakturowania z 3 tygodni do 2 dni.</h2>
          </div>

          <div className="lp-case-card max-w-3xl mx-auto">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-forest flex items-center justify-center flex-shrink-0 shadow-green">
                <span className="text-white font-black text-lg">MA</span>
              </div>
              <div>
                <p className="font-bold text-ink">Marcin Artymowicz</p>
                <p className="text-sm text-ink-60">właściciel, MMO Artis — firma wykończeniowa, Kraków</p>
              </div>
            </div>
            <blockquote className="text-ink text-lg leading-relaxed mb-8 italic border-l-4 border-forest/20 pl-5">
              &ldquo;Przez 6 lat wysyłałem klientom pliki PDF mailem i czekałem. Klient gubił, pytał, dzwonił. Teraz wchodzi na portal, widzi fakturę, klika. Płatność przychodzi tego samego dnia. Nie zmieniłem swojej pracy — zmieniłem to, jak klient ją widzi.&rdquo;
            </blockquote>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="bg-forest/10 text-forest text-sm font-semibold px-4 py-2 rounded-full">Cykl fakturowania: 21 dni &rarr; 2 dni</span>
              <span className="bg-forest/10 text-forest text-sm font-semibold px-4 py-2 rounded-full">Telefony od klientów: &minus;70%</span>
              <span className="bg-forest/10 text-forest text-sm font-semibold px-4 py-2 rounded-full">Wdrożenie: 1 popołudnie</span>
            </div>
            <p className="text-xs text-ink-40 italic">Dane z wewnętrznego beta-programu LoftDesk 2025. Wyniki mogą się różnić.</p>
          </div>

        </div>
      </section>

      {/* 7. PORTAL KLIENTA */}
      <section id="portal" className="bg-white py-20 sm:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-14">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Twoja przewaga konkurencyjna</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-5">
              Twoi klienci mają swoje narzędzie.<br className="hidden sm:block" />
              Twoja firma wygląda inaczej niż konkurencja.
            </h2>
            <p className="text-ink-60 text-lg max-w-2xl mx-auto">
              Większość firm remontowych wysyła PDF mailem i czeka. Ty dajesz klientowi portal — na telefonie, bez rejestracji, bez App Store.
            </p>
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">

            {/* Phone mockup */}
            <div className="mb-14 lg:mb-0 flex justify-center">
              <div className="lp-phone-frame w-[280px]">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
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
                  <div className="flex border-b border-sand-200 bg-white text-[11px]">
                    <button className="flex-1 py-2.5 font-bold text-forest border-b-2 border-forest">Dokumenty</button>
                    <button className="flex-1 py-2.5 font-medium text-ink-40">Chat</button>
                    <button className="flex-1 py-2.5 font-medium text-ink-40">Postęp</button>
                  </div>
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
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Klient widzi projekt — postęp, dokumenty, terminy</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Sam sprawdza zamiast pytać. Portal daje odpowiedzi na wszystkie pytania — bez Twojego udziału.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Akceptacje z timestampem — każda decyzja nieodwołalna</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Data, godzina, IP klienta. Twardy dowód w razie sporu. Papier tego nie daje.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Chat w kontekście projektu — nie WhatsApp, nie email</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Każda wiadomość powiązana z konkretnym projektem. Wiadomo o co chodzi i kiedy.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={3} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-ink mb-1">Instalacja jak aplikacja — bez sklepu</p>
                    <p className="text-sm text-ink-60 leading-relaxed">Klient dodaje do ekranu telefonu jednym gestem. Bez App Store, bez rejestracji, bez hasła.</p>
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

      {/* 8. PRICING */}
      <section id="cennik" className="bg-sand-100 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">

          <div className="text-center mb-12">
            <p className="text-forest font-semibold text-sm uppercase tracking-widest mb-3">Inwestycja. Nie koszt.</p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink mb-4">Inwestycja. Nie koszt.</h2>
            <p className="text-ink-60 text-lg max-w-xl mx-auto">49 zł miesięcznie to mniej niż 1h Twojej pracy administracyjnej. LoftDesk eliminuje ich kilkadziesiąt.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* Free */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-ink-40 uppercase tracking-widest">Free</p>
                <span className="bg-sand-200 text-ink-60 text-xs font-semibold px-3 py-1 rounded-full">Na start</span>
              </div>
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
                  <span className="w-4 h-4 rounded-full bg-sand-300 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-40 font-bold">&#x2713;</span>
                  Do 5 projektów
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-300 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-40 font-bold">&#x2713;</span>
                  Do 10 klientów i faktur
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-300 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-40 font-bold">&#x2713;</span>
                  Kosztorysy, umowy, PDF
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-20 font-bold">&mdash;</span>
                  <span className="text-ink-20">Portal klienta</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-sand-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-ink-20 font-bold">&mdash;</span>
                  <span className="text-ink-20">KSeF</span>
                </li>
              </ul>
            </div>

            {/* Pro */}
            <div className="lp-price-card-popular rounded-2xl p-7 relative">
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="bg-rust text-white text-xs font-bold px-4 py-1 rounded-full shadow-panel">Dla aktywnych firm</span>
              </div>
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Pro</p>
              <div className="mb-1">
                <span className="text-5xl font-black text-white">49</span>
                <span className="text-white/50 font-medium"> zł/mc</span>
              </div>
              <p className="text-xs text-white/40 mb-1">= 1,6 zł dziennie</p>
              <p className="text-sm text-white/50 mb-6">14 dni za darmo &middot; bez karty</p>
              <a href="#" className="block text-center bg-white text-forest-800 font-bold py-3 rounded-xl hover:bg-sand-100 transition-colors text-sm mb-7 shadow-panel">
                Zacznij 14 dni za darmo
              </a>
              <ul className="space-y-3 text-sm text-white/80">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">&#x2713;</span>
                  Bez limitu projektów i faktur
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">&#x2713;</span>
                  <span className="font-semibold text-white">Portal klienta</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">&#x2713;</span>
                  <span className="font-semibold text-white">KSeF — pełna integracja</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">&#x2713;</span>
                  AI — kosztorys z głosu
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold">&#x2713;</span>
                  AI — analiza PDF projektu
                </li>
              </ul>
            </div>

            {/* Business */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-ink-40 uppercase tracking-widest">Business</p>
                <span className="bg-forest/10 text-forest text-xs font-semibold px-3 py-1 rounded-full">Dla zespołów</span>
              </div>
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
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">&#x2713;</span>
                  Wszystko z Pro
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">&#x2713;</span>
                  <span className="font-semibold text-ink">Zarządzanie zespołem</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">&#x2713;</span>
                  Role i uprawnienia
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">&#x2713;</span>
                  <span className="font-semibold text-ink">Własne logo na dokumentach</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-forest font-bold">&#x2713;</span>
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

      {/* 9. FINAL CTA */}
      <section className="lp-hero-gradient py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 leading-tight">
            Twoja firma zasługuje na lepszy system.
          </h2>
          <p className="text-white/65 text-lg mb-10 max-w-lg mx-auto">
            Wdrożenie zajmuje 15 minut. Pierwszą wycenę wyślesz dzisiaj.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <a href="#" className="bg-white text-forest-800 font-black px-8 py-4 rounded-xl text-lg hover:bg-sand-100 transition-colors shadow-panel">
              Zacznij teraz — 14 dni Pro za darmo
            </a>
          </div>
          <p className="text-white/40 text-sm">Bez karty kredytowej. Bez umów. Możesz wrócić do Excela o każdej chwili — ale nie wrócisz.</p>

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

      {/* FOOTER */}
      <footer className="py-10 border-t border-white/5" style={{ background: '#0E3D20' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white font-black text-sm">L</span>
              </div>
              <span className="font-bold text-white text-lg tracking-tight">LoftDesk</span>
              <span className="text-white/30 text-sm hidden sm:block">&middot; Polska aplikacja dla firm wykończeniowych</span>
            </div>
            <div className="flex gap-6 text-sm text-white/30">
              <a href="#" className="hover:text-white/60 transition-colors">Polityka prywatności</a>
              <a href="#" className="hover:text-white/60 transition-colors">Regulamin</a>
              <a href="#" className="hover:text-white/60 transition-colors">Kontakt</a>
            </div>
          </div>
          <p className="mt-8 text-white/20 text-xs text-center sm:text-left">&copy; 2025 LoftDesk. Wszelkie prawa zastrzeżone. NIP: &mdash; &middot; ul. &mdash;</p>
        </div>
      </footer>
    </>
  );
}

export default LandingPage;
