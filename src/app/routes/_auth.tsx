import {
  Bell,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Mic,
  Moon,
  Settings,
  Sun,
  Users,
  Wallet,
} from 'lucide-react'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { GlobalSearch } from '@/shared/ui/GlobalSearch/GlobalSearch'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { APP_NAME } from '@/shared/lib/constants'
import { InstallAppButton } from '@/shared/ui/InstallAppButton/InstallAppButton'
import {
  useOperatorNotifications,
  useOperatorUnreadCount,
  useMarkAllOperatorNotificationsRead,
  useUnreadChatCount,
} from '@/features/notifications/hooks/useOperatorNotifications'
import { useEffect, useRef, useState } from 'react'
import { LegalAcceptanceGate } from '@/features/legal/components/LegalAcceptanceGate'
import { ClientShell } from '@/features/client-portal/components/ClientShell'
import { useTheme } from '@/shared/hooks/useTheme'
import { FloatingVoiceButton } from '@/shared/components/FloatingVoiceButton'
import { GlobalRefreshButton } from '@/shared/ui/GlobalRefreshButton/GlobalRefreshButton'

type MainNavItem = {
  type?: 'route'
  to: '/dashboard' | '/clients' | '/estimates' | '/contracts' | '/invoices' | '/projects' | '/ksef' | '/settings' | '/chat' | '/expenses' | '/notes' | '/documents'
  label: string
  icon: typeof LayoutDashboard
  feature?: 'ksef'
}

const mainNavItems: MainNavItem[] = [
  { to: '/dashboard',  label: 'Start',      icon: LayoutDashboard },
  { to: '/projects',   label: 'Projekty',   icon: FolderKanban },
  { to: '/chat',       label: 'Chat',       icon: MessageSquare },
  { to: '/documents',  label: 'Dokumenty',  icon: FileStack },
  { to: '/expenses',   label: 'Koszty',     icon: Wallet },
]

const moreNavItems: MainNavItem[] = [
  { to: '/clients',  label: 'Kontrahenci', icon: Users },
  { to: '/notes',    label: 'Notatki',     icon: Mic },
  { to: '/settings', label: 'Konto',       icon: Settings },
]

const mobileNav: MainNavItem[] = [
  { to: '/projects',   label: 'Projekty',   icon: FolderKanban },
  { to: '/chat',       label: 'Chat',       icon: MessageSquare },
  { to: '/dashboard',  label: 'Start',      icon: LayoutDashboard },
  { to: '/documents',  label: 'Dokumenty',  icon: FileStack },
  { to: '/notes',      label: 'Notatki',    icon: Mic },
  { to: '/settings',   label: 'Konto',      icon: Settings },
]

function isActive(pathname: string, item: MainNavItem) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function AuthLayout() {
  const { user, signOut, loading } = useAuth()
  const companyId = useCompanyId()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const canUsePortal = useFeatureAccess('portal')
  const { theme, toggleTheme } = useTheme()
  const { data: notifications = [] } = useOperatorNotifications()
  const { data: unreadCount = 0 } = useOperatorUnreadCount()
  const { data: chatUnreadCount = 0 } = useUnreadChatCount()
  const markAllReadMutation = useMarkAllOperatorNotificationsRead()
  function markAllRead() { markAllReadMutation.mutate() }
  const [showNotifications, setShowNotifications] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [moreExpanded, setMoreExpanded] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

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

  if (loading) return <div className="page-loading">Ładowanie sesji...</div>
  if (!user) return <AuthScreen />

  // Klient (v6.0) — lekki shell bez nawigacji wykonawcy
  if (user.role === 'client') return <ClientShell />

  // Guard: operator który ręcznie wpisał /client/* → wróć do dashboardu
  // RLS chroni dane, ale bez tego guardu operator widzi pusty client shell wewnątrz sidebar
  if (pathname.startsWith('/client/')) {
    if (typeof window !== 'undefined') window.location.replace('/dashboard')
    return null
  }

  const visibleMobileNav = mobileNav

  return (
    <>
      {/* Acceptance gate — renders as full-screen overlay when required docs are missing */}
      <LegalAcceptanceGate />
      <FloatingVoiceButton />
      <div className="app-shell">
      <aside className="sidebar">
		<div className="sidebar__brand">
		  <div className="sidebar__brand-mark">LD</div>
		  <div>
			<strong>{APP_NAME}</strong>
		  </div>
		</div>

		<nav className="sidebar__nav sidebar__nav--main">
		  {mainNavItems.map((item) => {
			const Icon = item.icon
			const active = isActive(pathname, item)

			return (
			  <Link key={item.to} to={item.to} className={active ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}>
				<Icon size={18} />
				{item.to === '/chat' && chatUnreadCount > 0 ? (
				  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					{item.label}
					<span style={{ background: 'var(--color-error)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
					  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
					</span>
				  </span>
				) : (
				  <span>{item.label}</span>
				)}
			  </Link>
			)
		  })}
		  {canUsePortal ? (
			<Link to="/portal-inbox" className={pathname.startsWith('/portal-inbox') ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}>
			  <MessageSquare size={18} />
			  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
				Portal
				{unreadCount > 0 && (
				  <span style={{ background: 'var(--color-error)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
					{unreadCount > 99 ? '99+' : unreadCount}
				  </span>
				)}
			  </span>
			</Link>
		  ) : null}

		  {/* ⋯ Konto — collapsible section */}
		  <button
			type="button"
			onClick={() => setMoreExpanded(e => !e)}
			className="sidebar__link"
			style={{ border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', marginTop: 4 }}
		  >
			{moreExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
			<span>Konto</span>
		  </button>
		  {moreExpanded && moreNavItems.map((item) => {
			const Icon = item.icon
			const active = isActive(pathname, item)
			return (
			  <Link key={item.to} to={item.to} className={active ? 'sidebar__link sidebar__link--active' : 'sidebar__link'} style={{ paddingLeft: 28 }}>
				<Icon size={16} />
				<span style={{ fontSize: 13 }}>{item.label}</span>
			  </Link>
			)
		  })}
		</nav>

        <div className="sidebar__footer">
          <InstallAppButton compact />
        </div>
      </aside>

      <section className="shell-main">
        <header className="shell-topbar">
          <GlobalSearch />
          <div className="shell-topbar__right">
            <Link to="/billing" className={user.plan === 'free' ? 'shell-pill shell-pill--upgrade' : 'shell-pill'} style={{ textDecoration: 'none', cursor: 'pointer' }}>
              {user.plan === 'free' ? '⭐ Przejdź na Business' : `Plan: ${user.plan}`}
            </Link>
            <div ref={notifRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <Button variant="ghost" size="sm" onClick={() => {
                const opening = !showNotifications
                setShowNotifications(opening)
                if (opening && notifRef.current) {
                  const rect = notifRef.current.getBoundingClientRect()
                  setDropdownPos({
                    top: rect.bottom + 4,
                    left: Math.max(8, rect.right - Math.min(340, window.innerWidth - 16)),
                  })
                  markAllRead()
                }
              }} icon={<Bell size={18} />} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: 'var(--color-error)', color: '#fff', fontSize: 11, fontWeight: 700,
                  borderRadius: '50%', minWidth: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', lineHeight: 1, pointerEvents: 'none',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {showNotifications && dropdownPos && (
                <div style={{
                  position: 'fixed',
                  top: dropdownPos.top,
                  right: Math.max(8, window.innerWidth - dropdownPos.left - Math.min(340, window.innerWidth - 16)),
                  zIndex: 9999,
                  background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg, 10px)',
                  boxShadow: 'var(--shadow-lg)',
                  width: Math.min(340, window.innerWidth - 16),
                  maxHeight: `min(400px, calc(100dvh - ${dropdownPos.top + 8}px))`,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                    Powiadomienia
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px 16px', color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' }}>
                      Brak powiadomień
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((n) => (
                      <button key={n.id} onClick={() => {
                        setShowNotifications(false)
                        navigate({ to: n.project_id ? `/projects/${n.project_id}` as any : '/projects' as any })
                      }} style={{
                        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                        padding: '10px 16px', borderBottom: '1px solid var(--color-border)',
                        background: n.read_at ? 'var(--color-card)' : 'var(--color-sidebar-active)',
                        fontSize: 13, border: 'none',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: n.type === 'client_approval_response' ? 'var(--color-success)' : n.type === 'missing_costs' ? 'var(--color-warning)' : 'var(--color-brand)' }}>
                            {n.type === 'client_approval_response' ? '✅ Odpowiedź klienta' : n.type === 'missing_costs' ? '⚠ Brakujące koszty' : '💬 Wiadomość od klienta'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            {new Date(n.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {n.project_name && (
                          <div style={{ marginTop: 3, fontWeight: 500, fontSize: 12, color: 'var(--color-text-primary)' }}>{n.project_name}</div>
                        )}
                        {n.body && (
                          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.body}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                  </div>
                </div>
              )}
            </div>
            <InstallAppButton compact />
            <GlobalRefreshButton />
            {/* Mic button — visible only on mobile (FAB hidden on mobile) */}
            <span className="topbar-mic">
              <FloatingVoiceButton inHeader />
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-soft, rgba(0,0,0,0.06))'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              title="Wyloguj"
              onClick={async () => { await signOut(); window.location.assign('/login') }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-soft, rgba(0,0,0,0.06))'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="shell-content"><Outlet /></main>
        <nav className="mobile-nav">
          {visibleMobileNav.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item)
            const isStart = item.to === '/dashboard'
            if (isStart) {
              return (
                <Link key={item.to} to={item.to} className="mobile-nav__link" style={{ position: 'relative' }}>
                  <span style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--color-brand)',
                    color: '#fff',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.32)',
                    marginTop: -24,
                    border: '4px solid var(--color-bg, #fff)',
                    transition: 'transform 0.15s',
                    gap: 2,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1 }}>START</span>
                  </span>
                </Link>
              )
            }
            return (
              <Link key={item.to} to={item.to} className={active ? 'mobile-nav__link mobile-nav__link--active' : 'mobile-nav__link'}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          {canUsePortal ? null : null}
        </nav>
      </section>
    </div>
    </>
  )
}
