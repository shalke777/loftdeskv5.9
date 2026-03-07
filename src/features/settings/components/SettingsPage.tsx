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
import { TeamInvitationsCard } from '@/features/settings/components/TeamInvitationsCard'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { WorkspaceReadinessCard } from '@/features/settings/components/WorkspaceReadinessCard'
import { WorkspaceLimitsCard } from '@/features/settings/components/WorkspaceLimitsCard'
import { downloadBlob } from '@/shared/lib/downloads'

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
  const canUsePortal = useFeatureAccess('portal')
  const portalLinks = user ? demoDb.portal.listForCompany(user.companyId).length : 0
  const importRef = useRef<HTMLInputElement | null>(null)

  async function exportBackup() {
    const blob = new Blob([demoDb.exportState()], { type: 'application/json;charset=utf-8' })
    downloadBlob(`loftdesk-backup-${new Date().toISOString().slice(0, 10)}.json`, blob)
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
      <PageHeader title="Ustawienia" subtitle="Tutaj trafiają dodatki i administracja. W głównym menu zostają tylko kluczowe moduły operacyjne." />
      <div className="grid-2">
        <Card>
          <h3>Konto i firma</h3>
          <p>Użytkownik: {user?.fullName}</p>
          <p>E-mail: {user?.email}</p>
          <p>Rola: {user?.role}</p>
          <p>Firma: {user?.companyName}</p>
          <p>Plan: {user?.plan ? PLAN_DEFS[user.plan].name : '—'}</p>
          <div className="actions-row"><Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: '/login' as any }) }}>Wyloguj</Button></div>
        </Card>

        <Card>
          <h3>Portal klienta i dokumenty</h3>
          <p>Portal klienta: {canUsePortal ? `aktywny (${portalLinks} linki)` : 'zablokowany planem / rolą'}</p>
          <p>Podglądy i pobieranie dokumentów są dostępne w wycenach, umowach, fakturach oraz odbiorach.</p>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/estimates' })}>Wyceny</Button>
            <Button variant="secondary" onClick={() => navigate({ to: '/contracts' })}>Umowy</Button>
            <Button variant="secondary" onClick={() => navigate({ to: '/invoices' })}>Faktury PDF/XML</Button>
            {canUsePortal ? <a href="/portal/demo-token" target="_blank" rel="noreferrer"><Button variant="ghost">Portal demo</Button></a> : null}
          </div>
        </Card>

        <CompanyProfileCard />

        <Card>
          <h3>KSeF</h3>
          <p>Środowisko: {(profile as any)?.ksef_env ?? 'test'}</p>
          <p>NIP do KSeF: {(profile as any)?.ksef_nip ?? 'brak'}</p>
          <p>Token: {(profile as any)?.ksef_token ? 'ustawiony' : 'brak'}</p>
          <p>{canUseKsef ? 'Moduł jest aktywny w Twoim planie.' : 'Plan Free blokuje pełną integrację KSeF.'}</p>
          <div className="actions-row"><Button variant="secondary" onClick={() => navigate({ to: '/ksef' })}>Przejdź do KSeF</Button></div>
        </Card>

        <WorkspaceReadinessCard />
        <WorkspaceLimitsCard />
        <TeamMembersCard />
        <TeamInvitationsCard />

        <Card>
          <h3>Backup i odzyskiwanie</h3>
          <p>Eksportuj całą bazę roboczą do pliku JSON lub przywróć backup jednym kliknięciem.</p>
          <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importBackup(e.target.files?.[0] || null)} />
          <div className="actions-row"><Button variant="secondary" onClick={exportBackup}>Pobierz backup</Button><Button onClick={() => importRef.current?.click()}>Przywróć backup</Button></div>
        </Card>

        <Card>
          <h3>Dodatkowe narzędzia</h3>
          <p className="muted">Mniej ważne moduły są zebrane tutaj, żeby nie zaśmiecać głównego menu.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <HelperCard icon={<ChartColumn size={18} />} title="Raporty" text="Marża, przychód, koszty projektów i podsumowania firmy." href="/reports" />
            <HelperCard icon={<Camera size={18} />} title="Dokumentacja i odbiory" text="Zdjęcia, decyzje klienta, protokoły odbioru i standardy techniczne." href="/documentation" />
            <HelperCard icon={<CreditCard size={18} />} title="Billing" text="Plan, dostępne limity i rozliczenia produktu." href="/billing" />
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
