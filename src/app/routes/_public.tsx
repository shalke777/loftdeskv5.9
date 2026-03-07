import { Outlet, useRouterState } from '@tanstack/react-router'

export function PublicLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const shellClass = pathname.startsWith('/portal/') || pathname.startsWith('/join/') ? 'public-shell public-shell--portal' : 'public-shell public-shell--landing'
  return (
    <main className={shellClass}>
      <Outlet />
    </main>
  )
}
