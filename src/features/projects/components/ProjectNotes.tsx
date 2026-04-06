import { useState, useEffect } from 'react'
import type { Project } from '@/entities/project/model'
import { Card } from '@/shared/ui/Card/Card'
import { supabase } from '@/shared/lib/supabase'

export function ProjectNotes({ project }: { project: Project }) {
  const [localNotes, setLocalNotes] = useState(project.notes ?? '')

  // Synchronizuj z prop gdy projekt się zmienia
  useEffect(() => {
    setLocalNotes(project.notes ?? '')
  }, [project.notes])

  // Nasłuchuj custom event emitowanego przez FloatingVoiceButton po zapisaniu notatki
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.projectId === project.id) {
        if (supabase) {
          supabase
            .from('projects')
            .select('notes')
            .eq('id', project.id)
            .single()
            .then(({ data }) => {
              if (data?.notes !== undefined) {
                setLocalNotes(data.notes ?? '')
              }
            })
        }
      }
    }
    window.addEventListener('project-notes-updated', handler as EventListener)
    return () => window.removeEventListener('project-notes-updated', handler as EventListener)
  }, [project.id])

  return (
    <Card>
      <h4>Notatki realizacyjne</h4>
      <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {localNotes || 'Brak notatek dla projektu.'}
      </p>
    </Card>
  )
}

