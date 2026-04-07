import { getDataScope } from '@/shared/lib/dataScope'
import { supabase } from '@/shared/lib/supabase'

export interface VoiceNote {
  id: string
  company_id: string
  project_id: string | null
  title: string
  transcript: string
  audio_url: string | null
  status: 'raw' | 'processing' | 'processed' | 'error'
  extracted_result: VoiceNoteExtractedResult | null
  created_at: string
  updated_at: string
}

export interface VoiceNoteExtractedResult {
  summary: string
  action_items: string[]
  amounts: Array<{ description: string; amount: number; currency: string }>
  decisions: string[]
  estimate_hint: string | null
}

export interface CreateVoiceNoteInput {
  project_id?: string | null
  title: string
  transcript: string
  audio_url?: string | null
}

export const voiceNotesApi = {
  async create(input: CreateVoiceNoteInput): Promise<VoiceNote> {
    if (!supabase) throw new Error('Supabase not available')
    const scope = await getDataScope()
    const { data, error } = await supabase
      .from('voice_notes')
      .insert({
        company_id: scope.companyId,
        project_id: input.project_id ?? null,
        title: input.title,
        transcript: input.transcript,
        audio_url: input.audio_url ?? null,
        status: 'raw' as const,
      })
      .select()
      .single()
    if (error) throw error
    return data as VoiceNote
  },

  async listByCompany(): Promise<VoiceNote[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('voice_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as VoiceNote[]
  },

  async listByProject(projectId: string): Promise<VoiceNote[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('voice_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as VoiceNote[]
  },

  async markProcessed(id: string, result: VoiceNoteExtractedResult): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ status: 'processed', extracted_result: result, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async markProcessing(id: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async markError(id: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async update(id: string, patch: Partial<Pick<VoiceNote, 'title' | 'transcript'>>): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async updateTitle(id: string, title: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async updateTranscript(id: string, transcript: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ transcript, status: 'raw', extracted_result: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async resetToRaw(id: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('voice_notes')
      .update({ status: 'raw', extracted_result: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.from('voice_notes').delete().eq('id', id)
    if (error) throw error
  },
}
