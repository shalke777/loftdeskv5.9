import { VoiceNotesList } from '@/features/notes/components/VoiceNotesList'
import { AiTypeChooserPage } from '@/features/expenses/components/AiTypeChooserPage'

export function AiRoutePage() {
  return (
    <div style={{ padding: '0 0 80px' }}>
      <section style={{ marginBottom: 32, padding: '0 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          🎤 Notatki głosowe
        </h3>
        <VoiceNotesList />
      </section>
      <AiTypeChooserPage />
    </div>
  )
}
