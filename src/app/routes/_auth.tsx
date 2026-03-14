import {
  Bell,
  Calculator,
  CreditCard,
  ExternalLink,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Receipt,
  Settings,
  Shield,
  Users,
  Wallet,
} from 'lucide-react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { APP_NAME } from '@/shared/lib/constants'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import { usePortalNotifications } from '@/features/portal/hooks/usePortalNotifications'
import { useEffect, useRef, useState } from 'react'
import { LegalAcceptanceGate } from '@/features/legal/components/LegalAcceptanceGate'
import { ClientShell } from '@/features/client-portal/components/ClientShell'

type MainNavItem = {
  type?: 'route'
  to: '/dashboard' | '/clients' | '/estimates' | '/contracts' | '/invoices' | '/projects' | '/ksef' | '/settings' | '/chat' | '/expenses'
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
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/expenses', label: 'Koszty', icon: Wallet },
  { to: '/ksef', label: 'KSeF', icon: Shield, feature: 'ksef' },
  { to: '/settings', label: 'Ustawienia', icon: Settings },
]

// ── Primary bar (4 items + Więcej button) — order per spec ──────────────────
const mobileNavPrimary: MainNavItem[] = [
  { to: '/dashboard', label: 'Tablica',    icon: LayoutDashboard },
  { to: '/projects',  label: 'Projekty',   icon: FolderKanban },
  { to: '/clients',   label: 'Kontrahent', icon: Users },
  { to: '/estimates', label: 'Wycena',     icon: Calculator },
  { to: '/chat',      label: 'Chat',       icon: MessageSquare },
]
// ── More drawer items (Umowa + overflow) ─────────────────────────────────────
const mobileNavMore: MainNavItem[] = [
  { to: '/contracts', label: 'Umowa',      icon: FileText },
  { to: '/invoices',  label: 'Faktura',    icon: Receipt },
  { to: '/expenses',  label: 'Koszty',     icon: Wallet },
  { to: '/settings',  label: 'Ustawienia', icon: Settings },
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
  const { notifications, unreadCount, markAllRead, dbUnreadCount } = usePortalNotifications(user?.id ?? null)
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [navVisible, setNavVisible] = useState(true)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    if (!showNotifications) return
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showNotifications])

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastScrollYRef.current + 8) { setNavVisible(false); setMoreOpen(false) }
      else if (y < lastScrollYRef.current - 4) setNavVisible(true)
      lastScrollYRef.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) return <div className="page-loading">Ładowanie sesji...</div>
  if (!user) return <AuthScreen />

  // Klient (v6.0) — lekki shell bez nawigacji wykonawcy
  if (user.role === 'client') return <ClientShell />

  const featureFlags = { ksef: canUseKsef } as const
  const visibleMainNav = mainNavItems.filter((item) => !item.feature || featureFlags[item.feature])
  const visibleMobileNavPrimary = mobileNavPrimary.filter((item) => !item.feature || featureFlags[item.feature])
  const visibleMobileNavMore = mobileNavMore.filter((item) => !item.feature || featureFlags[item.feature])
  const moreActive = visibleMobileNavMore.some((item) => isActive(pathname, item)) ||
    (canUsePortal && pathname.startsWith('/portal-inbox'))

  return (
    <>
      {/* Acceptance gate — renders as full-screen overlay when required docs are missing */}
      <LegalAcceptanceGate />
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
		  {canUsePortal ? (
			<Link to="/portal-inbox" className={pathname.startsWith('/portal-inbox') ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}>
			  <MessageSquare size={18} />
			  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
				Portal
				{dbUnreadCount > 0 && (
				  <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
					{dbUnreadCount > 99 ? '99+' : dbUnreadCount}
				  </span>
				)}
			  </span>
			</Link>
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
            <Link to="/billing" className={user.plan === 'free' ? 'shell-pill shell-pill--upgrade' : 'shell-pill'} style={{ textDecoration: 'none', cursor: 'pointer' }}>
              {user.plan === 'free' ? '⭐ Przejdź na Business' : `Plan: ${user.plan}`}
            </Link>
            <div ref={notifRef} style={{ position: 'relative' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: n.type === 'accepted' ? '#16a34a' : n.type === 'rejected' ? '#dc2626' : '#1d4ed8' }}>
                            {n.type === 'accepted' ? '✅ Akceptacja' : n.type === 'rejected' ? '❌ Odrzucenie' : '💬 Wiadomość'}
                          </span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            {new Date(n.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ marginTop: 3, fontWeight: 500, fontSize: 12, color: '#374151' }}>{n.clientName}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.text.replace(/\[img:data:image\/[^\]]{0,20}[^\]]*\]/g, '[zdjęcie]')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <InstallAppButton compact />
          </div>
        </header>
        <main className="shell-content"><Outlet /></main>
        {/* ── Fixed bottom nav bar — mobile only ───────────────────────── */}
        <nav className={`mobile-nav${navVisible ? '' : ' mobile-nav--hidden'}`}>
          {visibleMobileNavPrimary.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item)
            const isChat = item.to === '/chat'
            return (
              <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                className={active ? 'mobile-nav__link mobile-nav__link--active' : 'mobile-nav__link'}>
                <span className="mobile-nav__icon-wrap">
                  <Icon size={20} />
                  {isChat && dbUnreadCount > 0 && (
                    <span className="mobile-nav__badge">
                      {dbUnreadCount > 99 ? '99+' : dbUnreadCount}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button
            className={`mobile-nav__more-btn${moreActive ? ' mobile-nav__link--active' : ''}`}
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="Więcej"
          >
            <MoreHorizontal size={20} />
            <span>Więcej</span>
          </button>
        </nav>

        {/* ── Więcej bottom sheet ──────────────────────────────────────── */}
        {moreOpen && (
          <>
            <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
            <div className="mobile-more-sheet">
              <div className="mobile-more-sheet__handle" />
              <div className="mobile-more-sheet__grid">
                {visibleMobileNavMore.map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item)
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                      className={active ? 'mobile-more-sheet__link mobile-more-sheet__link--active' : 'mobile-more-sheet__link'}>
                      <Icon size={24} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
                {canUsePortal && (
                  <Link to="/portal-inbox" onClick={() => setMoreOpen(false)}
                    className={pathname.startsWith('/portal-inbox') ? 'mobile-more-sheet__link mobile-more-sheet__link--active' : 'mobile-more-sheet__link'}>
                    <ExternalLink size={24} />
                    <span>Portal</span>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
    </>
  )
}
