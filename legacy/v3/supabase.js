import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || ''
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const IS_DEMO = !supabaseUrl || !supabaseKey

export const supabase = IS_DEMO
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    })

// Helper — throws on error
export async function sbQuery(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}
