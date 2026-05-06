import type { ReactNode } from 'react'
import { useRef } from 'react'
import { Camera, ChartColumn, CreditCard, ShieldCheck, Users } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { demoDb } from '@/shared/lib/demoDb'
import { useToast } from '@/shared/hooks/useToast'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { CompanyProfileCard } from '@/features/settings/components/CompanyProfileCard'
import { TeamMembersCard } from '@/features/settings/components/TeamMembersCard'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { WorkspaceReadinessCard } from '@/features/settings/components/WorkspaceReadinessCard'
import { WorkspaceLimitsCard } from '@/features/settings/components/WorkspaceLimitsCard'
import { downloadBlob } from '@/shared/lib/downloads'
import { LegalCenterCard } from '@/features/legal/components/LegalCenterCard'
import { DocNumberingCard } from '@/features/settings/components/DocNumberingCard'
import { CompanyPriceListCard } from '@/features/settings/components/CompanyPriceListCard'
import { ThemeSwitcher } from '@/shared/ui/theme/ThemeSwitcher'

function HelperCard({ icon, title, text, href }: { icon: ReactNode; title: string; text: string; href: string }) {
  const navigate = useNavigate()
  return (
    <div className="list-row">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="quick-action__icon">{icon}</div>
        <div>
          <strong>{title}</strong>
          <div className="field__label" style={{ marginTop: 6 }}>{text}</div>
        </div>
      </div>
      <Button variant="secondary" onClick={() => navigate({ to: href as any })}>Otwórz</Button>
    </div>
  )
}

export function SettingsPage() {
  const { user, signOut, refreshSession } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useSettings()
  const canUseKsef = useFeatureAccess('ksef')
  const importRef = useRef<HTMLInputElement | null>(null)

  async function exportBackup() {
    const blob = new Blob([demoDb.exportState()], { type: 'application/json;charset=utf-8' })
    await downloadBlob(`loftdesk-backup-${new Date().toISOString().slice(0, 10)}.json`, blob)
  }

  async function importBackup(file?: File | null) {
    if (!file) return
    const text = await file.text()
    demoDb.importState(text)
    await refreshSession()
    toast.success('Backup przywrócony')
  }

  return (
    <div>
      <PageHeader title="Ustawienia" subtitle="Dane firmy, KSeF, zespół, plan i narzędzia dodatkowe." />
      <div className="settings-grid grid-2">
        <Card>
          <h3>Konto i firma</h3>
          <div style={{ display: 'grid', gap: 6, fontSize: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 80 }}>Użytkownik</span><strong>{user?.fullName || '—'}</strong></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 80 }}>E-mail</span><span>{user?.email || '—'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 80 }}>Rola</span><span>{user?.role || '—'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 80 }}>Firma</span><span>{user?.companyName || '—'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 80 }}>Plan</span><span>{user?.plan ? PLAN_DEFS[user.plan].name : '—'}</span></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Dane wykonawcy (NIP, adres, IBAN) uzupełnij w karcie poniżej — będą automatycznie wciągane do dokumentów PDF i KSeF.
          </p>
          <div className="actions-row">
            <Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: '/login' as any }) }}>Wyloguj</Button>
          </div>
        </Card>

        <Card>
          <h3>Preferencje</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <strong>Motyw</strong>
                <div className="field__label" style={{ marginTop: 2 }}>Wybierz kolorystykę interfejsu.</div>
              </div>
              <ThemeSwitcher />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Język</strong>
                <div className="field__label" style={{ marginTop: 2 }}>Język interfejsu.</div>
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>🇵🇱 Polski</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Format daty</strong>
                <div className="field__label" style={{ marginTop: 2 }}>Format wyświetlania dat w aplikacji.</div>
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>DD.MM.YYYY</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Strefa czasowa</strong>
                <div className="field__label" style={{ marginTop: 2 }}>Strefa używana do dat i powiadomień.</div>
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Europa/Warszawa (CET)</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            Eksport danych (RODO): Aby pobrać wszystkie swoje dane, użyj opcji „Pobierz backup" w karcie Backup poniżej.
          </p>
        </Card>

        <Card>
          <h3>KSeF</h3>
          <div style={{ display: 'grid', gap: 6, fontSize: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 120 }}>Środowisko</span><span>{(profile as any)?.ksef_env ?? 'test'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 120 }}>NIP do KSeF</span><span>{(profile as any)?.ksef_nip ?? 'brak — ustaw w danych wykonawcy'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-text-muted)', minWidth: 120 }}>Token</span><span>{(profile as any)?.ksef_token ? '✅ ustawiony' : '❌ brak — ustaw poniżej'}</span></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>{canUseKsef ? 'Integracja z KSeF aktywna w Twoim planie.' : 'Integracja z KSeF dostępna od planu Business. Przejdź na wyższy plan, aby wysyłać faktury elektronicznie.'}</p>
          <div className="actions-row">
            {canUseKsef
              ? <Button variant="secondary" onClick={() => navigate({ to: '/ksef' })}>Przejdź do KSeF</Button>
              : <Button onClick={() => navigate({ to: '/billing' })}>Ulepsz plan</Button>
            }
          </div>
        </Card>

        <CompanyProfileCard />

        <WorkspaceReadinessCard />
        <WorkspaceLimitsCard />
        <DocNumberingCard />
        <CompanyPriceListCard />
        <TeamMembersCard />

        <LegalCenterCard />

        <Card>
          <h3>Backup i odzyskiwanie</h3>
          <p>Eksportuj całą bazę roboczą do pliku JSON lub przywróć backup jednym kliknięciem.</p>
          <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importBackup(e.target.files?.[0] || null)} />
          <div className="actions-row"><Button variant="secondary" onClick={exportBackup}>Pobierz backup</Button><Button onClick={() => importRef.current?.click()}>Przywróć backup</Button></div>
        </Card>

        <Card>
          <h3>Dodatkowe narzędzia</h3>
          <p className="muted">Dodatkowe narzędzia i zaawansowane ustawienia dostępne z jednego miejsca.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <HelperCard icon={<ChartColumn size={18} />} title="Raporty" text="Marża, przychód, koszty projektów i podsumowania firmy." href="/reports" />
            <HelperCard icon={<Camera size={18} />} title="Dokumentacja i odbiory" text="Zdjęcia, decyzje klienta, protokoły odbioru i standardy techniczne." href="/documentation" />
            <HelperCard icon={<CreditCard size={18} />} title="Plan i płatności" text="Plan, dostępne limity i rozliczenia produktu." href="/billing" />
            <HelperCard icon={<Users size={18} />} title="Zespół" text="Zaproszenia, role i administracja członkami firmy." href="/team" />
            <HelperCard icon={<ShieldCheck size={18} />} title="Panel administracyjny" text="Funkcje techniczne, stan wdrożenia i narzędzia operacyjne." href="/admin" />
          </div>
        </Card>

        <Card>
          <h3>Dane demo</h3>
          <p>Jeśli chcesz odświeżyć testowe dane firmy, możesz je zresetować jednym kliknięciem.</p>
          <div className="actions-row"><Button variant="secondary" onClick={async () => { demoDb.reset(); await refreshSession(); toast.success('Dane demo zresetowane') }}>Reset danych demo</Button></div>
        </Card>
      </div>
    </div>
  )
}
