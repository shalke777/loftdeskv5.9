import { createClient } from '@supabase/supabase-js'
import { nativeAuthStorage } from '@/shared/lib/nativeAuthStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const requestedMode = import.meta.env.VITE_DATA_MODE

export const hasSupabaseConfig = Boolean(url && anonKey)
export const isDemoMode = requestedMode === 'demo' || !hasSupabaseConfig

export const supabase = !isDemoMode && url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        // Use Preferences (Keychain/SharedPreferences) on native, localStorage on web.
        // Prevents WKWebView storage eviction from logging users out unexpectedly.
        storage: nativeAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

if (import.meta.env.DEV) {
  console.info('[supabase] project url:', url ?? '(brak — tryb demo)')
  console.info('[supabase] isDemoMode:', isDemoMode)
}

export async function getSupabaseUserId() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}
