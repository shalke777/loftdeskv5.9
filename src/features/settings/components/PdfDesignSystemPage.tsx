// =============================================================================
// PdfDesignSystem — Visual style guide + document previews for LoftDesk PDFs
// Route: /pdf-design (accessible from Settings → Konto)
// =============================================================================
import type React from 'react'

const DS = {
  colors: {
    primary:    { hex: '#0F172A', label: 'tekst główny' },
    accent:     { hex: '#16A34A', label: 'akcent / kwoty' },
    gray:       { hex: '#6B7280', label: 'tekst wtórny' },
    border:     { hex: '#E5E7EB', label: 'linie / ramki' },
    background: { hex: '#F9FAFB', label: 'tło dokumentu' },
    white:      { hex: '#FFFFFF', label: 'karty / pola' },
  },
  type: [
    { name: 'H1', size: '24px', weight: 600, sample: 'Faktura VAT FV/2024/001' },
    { name: 'H2', size: '16px', weight: 600, sample: 'Dane sprzedawcy' },
    { name: 'H3', size: '12px', weight: 500, sample: 'Pozycje kosztorysowe' },
    { name: 'Body', size: '11px', weight: 400, sample: 'Wykonanie prac wykończeniowych' },
    { name: 'Meta', size: '9px', weight: 400, sample: 'Data wystawienia: 16.04.2024' },
  ],
  spacing: [8, 12, 16, 24, 32],
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(15,23,42,0.07), 0 0 0 1px #E5E7EB',
  padding: 20,
}

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6B7280',
  marginBottom: 10,
}

// ── Reusable document section styles ─────────────────────────────────────────

function DocHeader({ title, number, date, company }: { title: string; number: string; date: string; company: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #E5E7EB' }}>
      <div>
        <div style={{ fontSize: 8, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>LoftDesk</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>{number}</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, color: '#6B7280', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 10 }}>{company}</div>
        <div>Data: {date}</div>
      </div>
    </div>
  )
}

function DocParties({ seller, buyer }: { seller: string[]; buyer: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
      {[{ title: 'Sprzedawca', lines: seller }, { title: 'Nabywca', lines: buyer }].map(({ title, lines }) => (
        <div key={title} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
          {lines.map((l, i) => <div key={i} style={{ fontSize: 9, color: i === 0 ? '#0F172A' : '#6B7280', fontWeight: i === 0 ? 600 : 400, lineHeight: 1.6 }}>{l}</div>)}
        </div>
      ))}
    </div>
  )
}

function DocTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 12 }}>
      <thead>
        <tr style={{ background: '#0F172A' }}>
          {['Opis', 'Ilość', 'Cena netto', 'Wartość brutto'].map((h, i) => (
            <th key={h} style={{ padding: '6px 8px', color: '#fff', fontWeight: 600, textAlign: i > 1 ? 'right' : 'left', fontSize: 9 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([desc, qty, net, gross], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
            <td style={{ padding: '6px 8px', color: '#0F172A' }}>{desc}</td>
            <td style={{ padding: '6px 8px', color: '#6B7280', textAlign: 'right' }}>{qty}</td>
            <td style={{ padding: '6px 8px', color: '#6B7280', textAlign: 'right' }}>{net}</td>
            <td style={{ padding: '6px 8px', color: '#0F172A', fontWeight: 500, textAlign: 'right' }}>{gross}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DocSummary({ netto, vat, brutto }: { netto: string; vat: string; brutto: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <div style={{ minWidth: 180 }}>
        {[['Wartość netto', netto, false], ['VAT (23%)', vat, false], ['Do zapłaty', brutto, true]].map(([k, v, bold]) => (
          <div key={k as string} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: bold ? '8px 10px' : '4px 10px',
            background: bold ? '#16A34A' : 'transparent',
            borderRadius: bold ? 6 : 0,
            marginTop: bold ? 4 : 0,
          }}>
            <span style={{ fontSize: 9, color: bold ? '#fff' : '#6B7280', fontWeight: bold ? 700 : 400 }}>{k as string}</span>
            <span style={{ fontSize: bold ? 12 : 9, color: bold ? '#fff' : '#0F172A', fontWeight: bold ? 800 : 600 }}>{v as string}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DocFooter({ bank, email }: { bank: string; email: string }) {
  return (
    <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#9CA3AF' }}>
      <span>Bank: {bank}</span>
      <span>{email}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PdfDesignSystemPage() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh', padding: 32, color: '#0F172A' }}>

      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>System stylów PDF</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>LoftDesk · Design System · Faktury, Wyceny, Umowy</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEWA KOLUMNA: STYLE SYSTEM ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Logo */}
          <div style={{ ...card }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#16A34A', textTransform: 'uppercase' }}>LoftDesk</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', marginTop: 4 }}>System stylów dokumentów</div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>v5.9 · 2024</div>
          </div>

          {/* Colors */}
          <div style={{ ...card }}>
            <div style={label}>Kolory</div>
            {Object.values(DS.colors).map(({ hex, label: desc }) => (
              <div key={hex} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{hex}</div>
                  <div style={{ fontSize: 9, color: '#6B7280' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Typography */}
          <div style={{ ...card }}>
            <div style={label}>Typografia · Inter</div>
            {DS.type.map(t => (
              <div key={t.name} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A' }}>{t.name}</span>
                  <span style={{ fontSize: 9, color: '#9CA3AF' }}>{t.size} / {t.weight === 600 ? 'SemiBold' : t.weight === 500 ? 'Medium' : 'Regular'}</span>
                </div>
                <div style={{ fontSize: t.size, fontWeight: t.weight, color: '#0F172A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sample}</div>
              </div>
            ))}
          </div>

          {/* Spacing */}
          <div style={{ ...card }}>
            <div style={label}>Odstępy</div>
            {DS.spacing.map(px => (
              <div key={px} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: px, height: px, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#0F172A' }}>{px}px</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRAWA CZĘŚĆ: KOMPONENTY + DOKUMENTY ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KOMPONENTY */}
          <div>
            <div style={{ ...label, marginBottom: 12 }}>Komponenty</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>

              {/* Header component */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>Header dokumentu</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>LoftDesk</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Faktura VAT</div>
                    <div style={{ fontSize: 9, color: '#6B7280' }}>FV/2024/001</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 8, color: '#6B7280' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>Firma Remontowa</div>
                    <div>16.04.2024</div>
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>Strony dokumentu</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {['Sprzedawca', 'Nabywca'].map(t => (
                    <div key={t} style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>{t}</div>
                      <div style={{ fontSize: 8, color: '#0F172A', fontWeight: 600 }}>Nazwa firmy</div>
                      <div style={{ fontSize: 8, color: '#9CA3AF' }}>NIP: 000-000-00-00</div>
                      <div style={{ fontSize: 8, color: '#9CA3AF' }}>ul. Przykładowa 1</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>Tabela pozycji</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
                  <thead>
                    <tr style={{ background: '#0F172A' }}>
                      {['Opis', 'Ilość', 'Brutto'].map((h, i) => <th key={h} style={{ padding: '4px 6px', color: '#fff', textAlign: i > 0 ? 'right' : 'left' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[['Tynkowanie', '45 m²', '3 600 zł'], ['Malowanie', '45 m²', '2 250 zł']].map(([d, q, p], i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                        <td style={{ padding: '4px 6px', color: '#0F172A' }}>{d}</td>
                        <td style={{ padding: '4px 6px', color: '#6B7280', textAlign: 'right' }}>{q}</td>
                        <td style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>{p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>Podsumowanie</div>
                {[['Netto', '4 756,10 zł', false], ['VAT 23%', '1 093,90 zł', false], ['Do zapłaty', '5 850,00 zł', true]].map(([k, v, bold]) => (
                  <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: bold ? '7px 8px' : '3px 0', background: bold ? '#16A34A' : 'transparent', borderRadius: bold ? 6 : 0, marginTop: bold ? 6 : 0 }}>
                    <span style={{ fontSize: 9, color: bold ? '#fff' : '#6B7280' }}>{k as string}</span>
                    <span style={{ fontSize: bold ? 11 : 9, fontWeight: bold ? 800 : 600, color: bold ? '#fff' : '#0F172A' }}>{v as string}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ ...card, gridColumn: 'span 2' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>Stopka</div>
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF' }}>
                  <span>Bank: PKO BP · Nr konta: 12 3456 7890 1234 5678 9012 3456</span>
                  <span>kontakt@firma.pl · tel. +48 600 000 000</span>
                </div>
              </div>
            </div>
          </div>

          {/* PRZYKŁADOWE DOKUMENTY */}
          <div>
            <div style={{ ...label, marginBottom: 12 }}>Przykładowe dokumenty</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>

              {/* FAKTURA */}
              <div style={{ ...card, fontSize: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Faktura VAT</div>
                <DocHeader title="Faktura VAT" number="FV/2024/042" date="16.04.2024" company="Firma Remontowa Sp. z o.o." />
                <DocParties
                  seller={['Firma Remontowa Sp. z o.o.', 'NIP: 123-456-78-90', 'ul. Budowlana 12, Warszawa']}
                  buyer={['Jan Kowalski', 'ul. Willowa 5/2', '00-001 Warszawa']}
                />
                <DocTable rows={[
                  ['Tynkowanie ścian', '45 m²', '80,00 zł', '3 936,00 zł'],
                  ['Malowanie (2× warstwa)', '45 m²', '50,00 zł', '2 460,00 zł'],
                  ['Materiały', '1 kpl', '420,00 zł', '516,60 zł'],
                ]} />
                <DocSummary netto="5 534,96 zł" vat="1 273,04 zł" brutto="6 808,00 zł" />
                <DocFooter bank="PKO BP · 12 3456 7890 1234 5678" email="biuro@firma.pl" />
              </div>

              {/* WYCENA */}
              <div style={{ ...card, fontSize: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Kosztorys</div>
                <DocHeader title="Kosztorys robót" number="WYC/2024/018" date="16.04.2024" company="Firma Remontowa Sp. z o.o." />
                <DocParties
                  seller={['Firma Remontowa Sp. z o.o.', 'NIP: 123-456-78-90']}
                  buyer={['Jan Kowalski', 'ul. Willowa 5/2, Warszawa']}
                />

                {[
                  { stage: 'Etap 1 — Prace przygotowawcze', items: ['Skucie starych tynków · 45 m² · 1 350 zł', 'Gruntowanie podłoża · 45 m² · 270 zł'], total: '1 620 zł' },
                  { stage: 'Etap 2 — Wykończenie', items: ['Tynkowanie cienkowarstwowe · 45 m² · 3 600 zł', 'Malowanie 2× · 45 m² · 2 250 zł', 'Materiały · 1 kpl · 520 zł'], total: '6 370 zł' },
                ].map(({ stage, items, total }) => (
                  <div key={stage} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#0F172A', background: '#F9FAFB', padding: '5px 8px', borderRadius: 5, marginBottom: 5 }}>{stage}</div>
                    {items.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', fontSize: 9, color: '#374151' }}>
                        <span style={{ color: '#16A34A', fontSize: 8 }}>✓</span> {item}
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', fontSize: 9, fontWeight: 600, color: '#16A34A', paddingRight: 8, marginTop: 3 }}>Etap: {total}</div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6B7280' }}>Razem brutto</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#16A34A' }}>7 990 zł</span>
                </div>
              </div>

              {/* UMOWA */}
              <div style={{ ...card, fontSize: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Umowa</div>
                <DocHeader title="Umowa o roboty budowlane" number="UM/2024/007" date="16.04.2024" company="Firma Remontowa Sp. z o.o." />

                {[
                  { par: '§1 Przedmiot umowy', text: 'Wykonawca zobowiązuje się do wykonania robót remontowo-wykończeniowych w lokalu mieszkalnym przy ul. Willowej 5/2 w Warszawie, zgodnie z zatwierdzonym kosztorysem.' },
                  { par: '§2 Wynagrodzenie', text: 'Strony ustalają wynagrodzenie ryczałtowe w wysokości 7 990 zł brutto (słownie: siedem tysięcy dziewięćset dziewięćdziesiąt złotych). Płatność w dwóch ratach: 50% zaliczki i 50% po odbiorze.' },
                  { par: '§3 Termin realizacji', text: 'Wykonawca zobowiązuje się do wykonania prac w terminie 21 dni roboczych od daty wpłaty zaliczki, nie później niż do dnia 15.05.2024 r.' },
                  { par: '§4 Gwarancja', text: 'Wykonawca udziela 24-miesięcznej gwarancji na wykonane prace, liczonej od dnia bezusterkowego odbioru końcowego.' },
                ].map(({ par, text }) => (
                  <div key={par} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>{par}</div>
                    <div style={{ color: '#374151', lineHeight: 1.6 }}>{text}</div>
                  </div>
                ))}

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {['Wykonawca', 'Inwestor'].map(role => (
                    <div key={role}>
                      <div style={{ borderTop: '1px solid #0F172A', paddingTop: 5 }}>
                        <div style={{ fontSize: 8, color: '#6B7280' }}>{role}</div>
                        <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>podpis i pieczęć</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
