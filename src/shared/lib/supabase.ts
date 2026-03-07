import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const requestedMode = import.meta.env.VITE_DATA_MODE

export const hasSupabaseConfig = Boolean(url && anonKey)
export const isDemoMode = requestedMode === 'demo' || !hasSupabaseConfig

export const supabase = !isDemoMode && url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function getSupabaseUserId() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}
