import { useRef, useState } from 'react'
import { Camera, CheckCircle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { uploadProjectAsset } from '@/shared/lib/uploadProjectAsset'
import { getDataScope } from '@/shared/lib/dataScope'
import { useToast } from '@/shared/hooks/useToast'

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface Props {
  projectId: string
}

export function QuickPhotoButton({ projectId }: Props) {
  const inputRef              = useRef<HTMLInputElement>(null)
  const [state, setState]     = useState<UploadState>('idle')
  const toast                 = useToast()

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (state === 'uploading') return
    inputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be picked again
    e.target.value = ''

    setState('uploading')
    try {
      const scope  = await getDataScope()
      const result = await uploadProjectAsset(file, scope.companyId, 'project-photos')

      if (!supabase) throw new Error('Supabase nie jest skonfigurowany')

      const now   = new Date().toISOString()
      const title = file.name.replace(/\.[^.]+$/, '') || 'Zdjęcie'

      const { error } = await supabase.from('project_photo_docs').insert({
        company_id: scope.companyId,
        client_id:  null,
        project_id: projectId,
        title,
        category:  'progress',
        taken_at:   now,
        image_url:  result.url,
        note:       null,
      })

      if (error) throw error

      setState('done')
      toast.success('Zdjęcie dodane')
      window.setTimeout(() => setState('idle'), 2000)
    } catch (err) {
      setState('error')
      const msg = err instanceof Error ? err.message : 'Błąd przesyłania'
      toast.error('Błąd zdjęcia', msg)
      window.setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="proj-action-btn"
        title="Dodaj zdjęcie"
        onClick={handleClick}
        disabled={state === 'uploading'}
        aria-label="Szybkie zdjęcie projektu"
        style={{
          color: state === 'done'
            ? 'var(--color-brand)'
            : 'var(--color-text-muted)',
          opacity: state === 'uploading' ? 0.6 : 1,
        }}
      >
        {state === 'done'
          ? <CheckCircle size={14} />
          : <Camera size={14} />
        }
      </button>
    </>
  )
}
