import { supabase } from '@/shared/lib/supabase'
import { demoDb } from '@/shared/lib/demoDb'
import { getAppOrigin } from '@/shared/lib/native'

export const authApi = {
  async signIn(email: string, password: string) {
    if (!supabase) {
      const user = demoDb.users.byEmail(email)
      if (!user) throw new Error('Użytkownik nie istnieje w demo')
      if (user.password !== password) throw new Error('Niepoprawne hasło demo')
      return { user: { id: user.id, email: user.email }, session: { access_token: 'demo' } }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },
  async register(input: { email: string; password: string; companyName: string; fullName: string; nip?: string }) {
    if (!supabase) {
      const user = demoDb.users.createCompanyOwner({
        email: input.email,
        password: input.password,
        companyName: input.companyName,
        fullName: input.fullName,
        nip: input.nip,
      })
      return { user: { id: user.id, email: user.email }, session: { access_token: 'demo' } }
    }
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${getAppOrigin()}/auth/callback`,
        data: {
          full_name: input.fullName,
          company: input.companyName,
          nip: input.nip || '',
        },
      },
    })
    if (error) {
      if (error.status === 429 || error.message?.includes('429')) {
        throw new Error('Zbyt wiele prób rejestracji. Odczekaj chwilę i spróbuj ponownie.')
      }
      throw error
    }
    return data
  },
}
