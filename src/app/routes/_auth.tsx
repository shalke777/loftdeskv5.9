import {
  Bell,
  Calculator,
  CreditCard,
  ExternalLink,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Shield,
  Users,
} from 'lucide-react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { APP_NAME } from '@/shared/lib/constants'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import { usePortalTokens } from '@/features/portal/hooks/usePortalData'
import { usePortalNotifications } from '@/features/portal/hooks/usePortalNotifications'
import { useState } from 'react'

type MainNavItem = {
  type?: 'route'
  to: '/dashboard' | '/clients' | '/estimates' | '/contracts' | '/invoices' | '/projects' | '/ksef' | '/settings'
  label: string
  icon: typeof LayoutDashboard
  feature?: 'ksef'
}

const mainNavItems: MainNavItem[] = [
  { to: '/dashboard', label: 'Tablica', icon: LayoutDashboard },
  { to: '/clients', label: 'Kontrahenci', icon: Users },
  { to: '/estimates', label: 'Wycena', icon: Calculator },
  { to: '/contracts', label: 'Umowa', icon: FileText },
  { to: '/invoices', label: 'Faktura', icon: Receipt },
  { to: '/projects', label: 'Projekty', icon: FolderKanban },
  { to: '/ksef', label: 'KSeF', icon: Shield, feature: 'ksef' },
  { to: '/settings', label: 'Ustawienia', icon: Settings },
]

const mobileNav: MainNavItem[] = [
  { to: '/dashboard', label: 'Tablica', icon: LayoutDashboard },
  { to: '/estimates', label: 'Wycena', icon: Calculator },
  { to: '/invoices', label: 'Faktura', icon: Receipt },
  { to: '/settings', label: 'Ustawienia', icon: Settings },
]

function isActive(pathname: string, item: MainNavItem) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function AuthLayout() {
  const { user, signOut, loading } = useAuth()
  const companyId = useCompanyId()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const canUsePortal = useFeatureAccess('portal')
  const canUseKsef = useFeatureAccess('ksef')
  const { data: portalTokens } = usePortalTokens(companyId ?? '')
  const firstPortalUrl = canUsePortal ? (portalTokens ?? []).find((t) => t.active)?.url ?? null : null
  const { notifications, unreadCount, markAllRead } = usePortalNotifications(user?.id ?? null)
  const [showNotifications, setShowNotifications] = useState(false)

  if (loading) return <div className="page-loading">Ładowanie sesji...</div>
  if (!user) return <AuthScreen />

  const featureFlags = { ksef: canUseKsef } as const
  const visibleMainNav = mainNavItems.filter((item) => !item.feature || featureFlags[item.feature])
  const visibleMobileNav = mobileNav.filter((item) => !item.feature || featureFlags[item.feature])
  const isPortalActive = pathname.startsWith('/portal/')

  return (
    <div className="app-shell">
      <aside className="sidebar">
		<div className="sidebar__brand">
		  <div className="sidebar__brand-mark">LD</div>
		  <div>
			<strong>{APP_NAME}</strong>
		  </div>
		</div>

		<div className="sidebar__section-label">Główne moduły</div>
		<nav className="sidebar__nav sidebar__nav--main">
		  {visibleMainNav.map((item) => {
			const Icon = item.icon
			const active = isActive(pathname, item)

			return (
			  <Link key={item.to} to={item.to} className={active ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}>
				<Icon size={18} />
				<span>{item.label}</span>
			  </Link>
			)
		  })}
		  {firstPortalUrl ? (
			<a href={firstPortalUrl} target="_blank" rel="noreferrer" className={isPortalActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}>
			  <ExternalLink size={18} />
			  <span>Portal</span>
			</a>
		  ) : null}
		</nav>

        <div className="sidebar__footer">
          <InstallAppButton compact />
          <Button variant="ghost" onClick={async () => { await signOut(); window.location.assign('/login') }} icon={<LogOut size={16} />}>
            Wyloguj
          </Button>
        </div>
      </aside>

      <section className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar__left">
            <div>
              <strong>{user.companyName}</strong>
              <div className="field__label">LoftDesk: wyceny, umowy, faktury, portal klienta i realizacja</div>
            </div>
          </div>
          <div className="shell-topbar__right">
            <span className="shell-pill">Plan: {user.plan}</span>
            <div style={{ position: 'relative' }}>
              <Button variant="ghost" size="sm" onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) markAllRead() }} icon={<Bell size={18} />}>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700,
                    borderRadius: '50%', minWidth: 18, height: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', lineHeight: 1,
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
              {showNotifications && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 999,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: 340, maxHeight: 400, overflow: 'auto',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: 14 }}>
                    Powiadomienia z portalu
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px 16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                      Brak powiadomień
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((n) => (
                      <div key={n.id} style={{
                        padding: '10px 16px', borderBottom: '1px solid #f9fafb',
                        background: n.read ? '#fff' : '#f0f9ff',
                        fontSize: 13,
                      }}>
                        <div style={{ fontWeight: 500, color: n.type === 'accepted' ? '#16a34a' : n.type === 'rejected' ? '#dc2626' : '#1d4ed8' }}>
                          {n.type === 'accepted' ? '✅ Akceptacja' : n.type === 'rejected' ? '❌ Odrzucenie' : '💬 Wiadomość'}
                        </div>
                        <div style={{ marginTop: 2, color: '#374151' }}>{n.text}</div>
                        <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 11 }}>
                          {new Date(n.created_at).toLocaleString('pl-PL')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {firstPortalUrl ? <a href={firstPortalUrl} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm">Portal klienta</Button></a> : null}
            <InstallAppButton compact />
          </div>
        </header>
        <main className="shell-content"><Outlet /></main>
        <nav className="mobile-nav">
          {visibleMobileNav.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item)
            return (
              <Link key={item.to} to={item.to} className={active ? 'mobile-nav__link mobile-nav__link--active' : 'mobile-nav__link'}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          {firstPortalUrl ? (
            <a href={firstPortalUrl} target="_blank" rel="noreferrer" className={isPortalActive ? 'mobile-nav__link mobile-nav__link--active' : 'mobile-nav__link'}>
              <ExternalLink size={18} />
              <span>Portal</span>
            </a>
          ) : null}
        </nav>
      </section>
    </div>
  )
}
