// =============================================================================
// ClientShell — lekki shell dla roli 'client' (v6.0)
// =============================================================================
// Zamiast pełnego App Shell z sidebar wykonawcy, klient widzi:
//   - prostą nawigację: Projekty | Chat (nowy redirect) | Profil
//   - nagłówek z imieniem klienta + wyloguj
// Renderowany przez AuthLayout gdy user.role === 'client'
// =============================================================================

import { useEffect } from 'react'
import { FolderKanban, LogOut, User } from 'lucide-react'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ClientInstallBanner } from '@/features/client-portal/components/ClientInstallBanner'

const NAV = [
  { to: '/client/dashboard', label: 'Projekty', icon: FolderKanban },
  { to: '/client/profile',   label: 'Profil',   icon: User },
] as const

export function ClientShell() {
  const { user, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  useEffect(() => {
    if (!pathname.startsWith('/client/')) {
      // Jeśli klient ma pendingProjectId (z zaproszenia), idzie od razu na projekt.
      // Bez tego — ogólny dashboard.
      const dest = user?.pendingProjectId
        ? `/client/project/${user.pendingProjectId}`
        : '/client/dashboard'
      void navigate({ to: dest })
    }
  }, [pathname, navigate, user?.pendingProjectId])

  return (
    <div className="client-shell">
      {/* ── Topbar ── */}
      <header className="client-topbar">
        <div className="client-topbar__brand">
          <span className="client-topbar__mark">LD</span>
          <span className="client-topbar__name">LoftDesk</span>
          <span className="client-topbar__badge">Portal klienta</span>
        </div>
        <div className="client-topbar__right">
          <span className="client-topbar__email">{user?.fullName || user?.email}</span>
          <button
            className="client-topbar__signout"
            onClick={async () => { await signOut(); window.location.assign('/login') }}
            title="Wyloguj"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Treść ── */}
      <main className="client-main">
        <Outlet />
      </main>

      {/* ── Dolna nawigacja ── */}
      <nav className="client-nav">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={pathname.startsWith(to) ? 'client-nav__link client-nav__link--active' : 'client-nav__link'}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <ClientInstallBanner />
    </div>
  )
}
