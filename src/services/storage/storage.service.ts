import { isDemoMode, supabase } from '@/shared/lib/supabase'

const MAX_LOGO_SIZE = 512 * 1024 // 500 KB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

export const storageService = {
  upload: async (file: File) => ({ path: `uploads/${file.name}` }),

  async uploadLogo(file: File, companyId: string): Promise<string> {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Dozwolone formaty: PNG, JPG, SVG, WebP')
    }
    if (file.size > MAX_LOGO_SIZE) {
      throw new Error('Maksymalny rozmiar logo to 500 KB')
    }
    if (isDemoMode || !supabase) {
      return URL.createObjectURL(file)
    }

    const ext = file.name.split('.').pop() || 'png'
    const path = `${companyId}/logo.${ext}`

    const { error } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error

    const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
    return `${data.publicUrl}?t=${Date.now()}`
  },

  async deleteLogo(companyId: string): Promise<void> {
    if (isDemoMode || !supabase) return

    const { data } = await supabase.storage.from('company-logos').list(companyId)
    if (data?.length) {
      const files = data.map((f) => `${companyId}/${f.name}`)
      await supabase.storage.from('company-logos').remove(files)
    }
  },
}
