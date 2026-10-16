// Only resume this application's consent page, never an arbitrary redirect URL.
export function mcpLoginReturn(pathname: string, search: string): string | null {
  if (pathname !== '/oauth/consent') return null
  const params = new URLSearchParams(search)
  const ids = params.getAll('authorization_id')
  if (ids.length !== 1 || !/^[A-Za-z0-9_-]{16,256}$/.test(ids[0])) return null
  return `/oauth/consent?authorization_id=${encodeURIComponent(ids[0])}`
}
