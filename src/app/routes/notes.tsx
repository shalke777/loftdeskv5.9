import { Mic } from 'lucide-react'
import { VoiceNotesList } from '@/features/notes/components/VoiceNotesList'

export function NotesRoutePage() {
  return (
    <div style={{ padding: '0 0 80px' }}>
      <div style={{ padding: '16px 16px 0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mic size={22} style={{ color: 'var(--color-brand)' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Notatki głosowe</h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Nagrania, transkrypcje i ekstrakcja danych AI
            </p>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        <VoiceNotesList />
      </div>
    </div>
  )
}
