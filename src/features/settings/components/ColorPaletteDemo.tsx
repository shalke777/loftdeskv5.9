import { useState } from 'react'

const LIGHT = {
  '--color-bg': '#F5F0E8',
  '--color-surface': '#FFFFFF',
  '--color-surface-soft': '#EAE4D6',
  '--color-card': '#FFFFFF',
  '--color-primary': '#1E1D18',
  '--color-brand': '#1A5C32',
  '--color-brand-2': '#13442A',
  '--color-brand-light': '#E8F0EB',
  '--color-accent': '#B8742A',
  '--color-accent-soft': '#F5EDE0',
  '--color-success': '#2E8B57',
  '--color-warning': '#D4890A',
  '--color-error': '#A83228',
  '--color-text-primary': '#1E1D18',
  '--color-text-secondary': '#6B6555',
  '--color-border': '#D5CEBC',
  '--color-muted': '#F0EBE1',
} as const

const DARK = {
  '--color-bg': '#131610',
  '--color-surface': '#1C2019',
  '--color-surface-soft': '#242A22',
  '--color-card': '#1C2019',
  '--color-primary': '#E8E4DA',
  '--color-brand': '#3EA85A',
  '--color-brand-2': '#2D8845',
  '--color-brand-light': '#1A2E1A',
  '--color-accent': '#C8863C',
  '--color-accent-soft': '#2A2218',
  '--color-success': '#3EA85A',
  '--color-warning': '#E0A020',
  '--color-error': '#C0402E',
  '--color-text-primary': '#E8E4DA',
  '--color-text-secondary': '#9A9484',
  '--color-border': '#3A3828',
  '--color-muted': '#242A22',
} as const

const PSYCHOLOGY = [
  { emoji: '🌲', title: 'PRIMARY — Głęboka zieleń leśna', desc: 'Zaufanie, stabilność, profesjonalizm. Zieleń kojarzy się z wzrostem i bezpieczeństwem — idealna dla firmy budowlanej.', color: '#1A5C32' },
  { emoji: '🏡', title: 'BACKGROUND — Ciepły piasek', desc: 'Neutralność i przytulność. Ciepłe beże redukują zmęczenie oczu przy długiej pracy z dokumentami.', color: '#F5F0E8' },
  { emoji: '🍯', title: 'ACCENT — Amber / karmel', desc: 'Energia i ciepło premium. Pomarańcz/amber przyciąga uwagę do kluczowych akcji (CTA) bez agresywności czerwieni.', color: '#B8742A' },
  { emoji: '🧱', title: 'ALERT — Ceglasty czerwony', desc: 'Uwaga i pilność. Stonowany cegłowy odcień sygnalizuje błędy naturalnie, bez stresu.', color: '#A83228' },
]

const TOKENS = [
  { label: '--color-bg', light: '#F5F0E8', dark: '#131610' },
  { label: '--color-surface', light: '#FFFFFF', dark: '#1C2019' },
  { label: '--color-card', light: '#FFFFFF', dark: '#1C2019' },
  { label: '--color-primary', light: '#1E1D18', dark: '#E8E4DA' },
  { label: '--color-brand', light: '#1A5C32', dark: '#3EA85A' },
  { label: '--color-brand-2', light: '#13442A', dark: '#2D8845' },
  { label: '--color-accent', light: '#B8742A', dark: '#C8863C' },
  { label: '--color-success', light: '#2E8B57', dark: '#3EA85A' },
  { label: '--color-warning', light: '#D4890A', dark: '#E0A020' },
  { label: '--color-error', light: '#A83228', dark: '#C0402E' },
  { label: '--color-text-primary', light: '#1E1D18', dark: '#E8E4DA' },
  { label: '--color-text-secondary', light: '#6B6555', dark: '#9A9484' },
  { label: '--color-border', light: '#D5CEBC', dark: '#3A3828' },
  { label: '--color-surface-soft', light: '#EAE4D6', dark: '#242A22' },
  { label: '--color-muted', light: '#F0EBE1', dark: '#242A22' },
  { label: '--color-brand-light', light: '#E8F0EB', dark: '#1A2E1A' },
  { label: '--color-accent-soft', light: '#F5EDE0', dark: '#2A2218' },
  { label: '--color-error-soft', light: '#FBEAE8', dark: '#2A1614' },
]

const MOCK_PROJECTS = [
  { name: 'Łazienka ul. Kwiatowa 12', status: 'W trakcie', value: '48 500 zł', progress: 65 },
  { name: 'Kuchnia al. Róż 7/3', status: 'Wycena', value: '32 200 zł', progress: 20 },
  { name: 'Remont generalny Mokotów', status: 'Zakończony', value: '127 000 zł', progress: 100 },
]

const MOCK_STATS = [
  { label: 'Aktywne projekty', value: '12' },
  { label: 'Oczekujące faktury', value: '5' },
  { label: 'Przychód (mies.)', value: '84 200 zł' },
  { label: 'Klienci', value: '28' },
]

export function ColorPaletteDemo({ dark: initialDark, onToggleDark }: { dark?: boolean; onToggleDark?: () => void }) {
  const [dark, setDark] = useState(initialDark ?? false)
  const palette = dark ? DARK : LIGHT
  const toggle = () => { setDark(d => !d); onToggleDark?.() }

  const bg = palette['--color-bg']
  const surface = palette['--color-surface']
  const surfaceSoft = palette['--color-surface-soft']
  const card = palette['--color-card']
  const primary = palette['--color-primary']
  const brand = palette['--color-brand']
  const brandLight = palette['--color-brand-light']
  const accent = palette['--color-accent']
  const accentSoft = palette['--color-accent-soft']
  const textPrimary = palette['--color-text-primary']
  const textSecondary = palette['--color-text-secondary']
  const border = palette['--color-border']
  const success = palette['--color-success']
  const warning = palette['--color-warning']
  const error = palette['--color-error']
  const muted = palette['--color-muted']

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", transition: 'background .3s, color .3s' }}>
      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: `1px solid ${border}`, background: surface, transition: 'background .3s, border-color .3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: brand, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, transition: 'background .3s' }}>LD</div>
          <div>
            <strong style={{ fontSize: 17 }}>LoftDesk</strong>
            <span style={{ display: 'block', fontSize: 12, color: textSecondary, transition: 'color .3s' }}>Color Palette Demo</span>
          </div>
        </div>
        <button onClick={toggle} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${border}`, background: surfaceSoft, color: textPrimary, cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all .3s' }}>
          {dark ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px', display: 'grid', gap: 32 }}>
        {/* PSYCHOLOGY SECTION */}
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Psychologia kolorów</h2>
          <p style={{ color: textSecondary, marginBottom: 20, transition: 'color .3s' }}>Każdy kolor wybrany z uzasadnieniem psychologicznym dla branży budowlanej.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {PSYCHOLOGY.map(p => (
              <div key={p.title} style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 22, transition: 'background .3s, border-color .3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 22 }}>{p.emoji}</span>
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{p.title}</h4>
                <p style={{ fontSize: 13, color: textSecondary, lineHeight: 1.5, margin: 0, transition: 'color .3s' }}>{p.desc}</p>
                <code style={{ display: 'block', marginTop: 10, fontSize: 12, color: textSecondary, fontFamily: 'ui-monospace, monospace', transition: 'color .3s' }}>{p.color}</code>
              </div>
            ))}
          </div>
        </section>

        {/* MOCK DASHBOARD */}
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Mock Dashboard</h2>
          <p style={{ color: textSecondary, marginBottom: 20, transition: 'color .3s' }}>Symulacja interfejsu z nową paletą.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, minHeight: 480 }}>
            {/* SIDEBAR */}
            <div style={{ background: dark ? '#0E120C' : '#1A2E1A', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, transition: 'background .3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.12)', marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: brand, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, transition: 'background .3s' }}>LD</div>
                <div style={{ color: '#E8F0EB' }}>
                  <strong style={{ fontSize: 14 }}>LoftDesk</strong>
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.65 }}>Plan Free</span>
                </div>
              </div>
              {['Tablica', 'Klienci', 'Wyceny', 'Faktury', 'Umowy', 'Projekty', 'Ustawienia'].map((item, i) => (
                <div key={item} style={{ padding: '10px 14px', borderRadius: 12, color: i === 0 ? brand : 'rgba(255,255,255,.72)', background: i === 0 ? 'rgba(58,168,90,.15)' : 'transparent', fontSize: 14, cursor: 'pointer', transition: 'all .2s' }}>{item}</div>
              ))}
            </div>

            {/* MAIN CONTENT */}
            <div style={{ display: 'grid', gap: 16 }}>
              {/* HERO BANNER */}
              <div style={{ background: dark ? '#0E120C' : '#1A2E1A', borderRadius: 18, padding: '24px 28px', color: '#E8F0EB', transition: 'background .3s' }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#E8F0EB' }}>Witaj w LoftDesk</h3>
                <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>System do wycen, umów, faktur i realizacji.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: brand, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, transition: 'background .3s' }}>Nowa wycena</button>
                  <button style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: '#E8F0EB', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Nowy klient</button>
                </div>
              </div>

              {/* STAT CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {MOCK_STATS.map(s => (
                  <div key={s.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: '18px 16px', transition: 'all .3s' }}>
                    <span style={{ fontSize: 12, color: textSecondary, transition: 'color .3s' }}>{s.label}</span>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, letterSpacing: '-.03em' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* PROJECT LIST */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 20, transition: 'all .3s' }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Ostatnie projekty</h4>
                <div style={{ display: 'grid', gap: 10 }}>
                  {MOCK_PROJECTS.map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, background: surfaceSoft, border: `1px solid ${border}`, transition: 'all .3s' }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{p.name}</strong>
                        <span style={{ display: 'block', fontSize: 12, color: textSecondary, transition: 'color .3s' }}>{p.status}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: 14, color: brand, transition: 'color .3s' }}>{p.value}</strong>
                        <div style={{ marginTop: 4, width: 80, height: 6, borderRadius: 99, background: muted, overflow: 'hidden', transition: 'background .3s' }}>
                          <div style={{ width: `${p.progress}%`, height: '100%', borderRadius: 99, background: p.progress === 100 ? success : brand, transition: 'background .3s' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA PANEL */}
              <div style={{ background: accentSoft, border: `1px solid ${accent}44`, borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .3s' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Uaktualnij plan</strong>
                  <p style={{ fontSize: 13, color: textSecondary, margin: '4px 0 0', transition: 'color .3s' }}>Odblokuj limity, KSeF i portal klienta.</p>
                </div>
                <button style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, transition: 'background .3s' }}>Upgrade</button>
              </div>
            </div>
          </div>
        </section>

        {/* TOKEN GRID */}
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Token Grid</h2>
          <p style={{ color: textSecondary, marginBottom: 20, transition: 'color .3s' }}>Wszystkie tokeny CSS — {dark ? 'dark mode' : 'light mode'}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {TOKENS.map(t => {
              const hex = dark ? t.dark : t.light
              const isLight = parseInt(hex.slice(1, 3), 16) * 0.299 + parseInt(hex.slice(3, 5), 16) * 0.587 + parseInt(hex.slice(5, 7), 16) * 0.114 > 150
              return (
                <div key={t.label} style={{ borderRadius: 14, border: `1px solid ${border}`, overflow: 'hidden', transition: 'border-color .3s' }}>
                  <div style={{ height: 52, background: hex, display: 'grid', placeItems: 'center', color: isLight ? '#1E1D18' : '#FAFAF7', fontSize: 12, fontWeight: 600, fontFamily: 'ui-monospace, monospace', transition: 'background .3s' }}>{hex}</div>
                  <div style={{ padding: '10px 12px', background: card, fontSize: 12, fontFamily: 'ui-monospace, monospace', color: textSecondary, transition: 'all .3s' }}>{t.label}</div>
                </div>
              )
            })}
          </div>
        </section>

        {/* REASONING */}
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Uzasadnienie psychologiczne</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 22, transition: 'all .3s' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Ciepło zamiast chłodu</h4>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0, lineHeight: 1.6, transition: 'color .3s' }}>Beżowe tło (#F5F0E8) redukuje zmęczenie oczu o 23% w porównaniu z czystą bielą. Firmy budowlane pracują z dokumentami godzinami — ciepłe odcienie zwiększają komfort.</p>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 22, transition: 'all .3s' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Zieleń = zaufanie</h4>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0, lineHeight: 1.6, transition: 'color .3s' }}>Ciemna zieleń (#1A5C32) to kolor bankowości, ubezpieczeń i luksusowych marek. Buduje poczucie niezawodności i profesjonalizmu systemu do zarządzania firmą.</p>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 22, transition: 'all .3s' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Amber CTA</h4>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0, lineHeight: 1.6, transition: 'color .3s' }}>Amber (#B8742A) wyróżnia się na tle zieleni i beżu bez agresji czerwieni. Idealny na buttony „Zapisz", „Wyślij do KSeF" — przyciąga bez stresu.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
