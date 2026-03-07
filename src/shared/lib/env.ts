
export interface FrontendEnvStatus {
  mode: 'demo' | 'supabase-first'
  hasSupabaseUrl: boolean
  hasSupabaseAnonKey: boolean
  hasDataMode: boolean
  hasPublicBaseUrl: boolean
  publicBaseUrl: string | null
}

export function getFrontendEnvStatus(): FrontendEnvStatus {
  const env = import.meta.env
  const hasSupabaseUrl = Boolean(env.VITE_SUPABASE_URL)
  const hasSupabaseAnonKey = Boolean(env.VITE_SUPABASE_ANON_KEY)
  const hasDataMode = Boolean(env.VITE_DATA_MODE)
  const hasPublicBaseUrl = Boolean(env.VITE_PUBLIC_BASE_URL)
  const mode = hasSupabaseUrl && hasSupabaseAnonKey && env.VITE_DATA_MODE !== 'demo' ? 'supabase-first' : 'demo'

  return {
    mode,
    hasSupabaseUrl,
    hasSupabaseAnonKey,
    hasDataMode,
    hasPublicBaseUrl,
    publicBaseUrl: env.VITE_PUBLIC_BASE_URL ?? null,
  }
}
