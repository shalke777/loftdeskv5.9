import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Project } from '@/entities/project/model'
import type { PhotoDocumentation } from '@/entities/documentation/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import {
  useProjectPhotos,
  useCreatePhoto,
  useDeletePhoto,
} from '@/features/documentation/hooks/useDocumentation'

type PhotoCategory = PhotoDocumentation['category']

const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  before:   'Przed realizacją',
  progress: 'W trakcie',
  after:    'Po realizacji',
  issue:    'Problem',
  handover: 'Odbiór',
}

const CATEGORY_BADGE: Record<PhotoCategory, 'default' | 'success' | 'warning' | 'danger'> = {
  before:   'default',
  progress: 'warning',
  after:    'success',
  issue:    'danger',
  handover: 'default',
}

const EMPTY_FORM = { title: '', image_url: '', category: 'progress' as PhotoCategory, note: '' }

export function ProjectPhotosSection({ project }: { project: Project }) {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const { data: photos = [], isLoading } = useProjectPhotos(project.id)
  const createPhoto = useCreatePhoto()
  const deletePhoto = useDeletePhoto()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  function invalidateProjectPhotos() {
    void qc.invalidateQueries({ queryKey: ['documentation', 'project-photos', project.id] })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setFormError('Podaj tytuł zdjęcia')
      return
    }
    setFormError(null)
    createPhoto.mutate(
      {
        company_id: companyId,
        client_id:  project.client_id ?? null,
        project_id: project.id,
        title:      form.title.trim(),
        category:   form.category,
        taken_at:   new Date().toISOString(),
        image_url:  form.image_url.trim(),
        note:       form.note.trim(),
      },
      {
        onSuccess: () => {
          invalidateProjectPhotos()
          setForm(EMPTY_FORM)
          setShowForm(false)
        },
      },
    )
  }

  function handleDelete(id: string) {
    deletePhoto.mutate(id, { onSuccess: invalidateProjectPhotos })
  }

  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Zdjęcia z realizacji</h4>
        {!showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            + Dodaj zdjęcie
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            display:      'grid',
            gap:          8,
            marginBottom: 16,
            padding:      12,
            background:   'var(--color-bg-subtle, #F8F9FA)',
            borderRadius: 6,
          }}
        >
          <input
            placeholder="Tytuł zdjęcia *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            style={{ width: '100%' }}
          />
          <input
            placeholder="URL zdjęcia (opcjonalnie)"
            value={form.image_url}
            onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
            type="url"
            style={{ width: '100%' }}
          />
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as PhotoCategory }))}
            style={{ width: '100%' }}
          >
            <option value="before">Przed realizacją</option>
            <option value="progress">W trakcie</option>
            <option value="after">Po realizacji</option>
            <option value="issue">Problem</option>
            <option value="handover">Odbiór</option>
          </select>
          <input
            placeholder="Notatka (opcjonalnie)"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            style={{ width: '100%' }}
          />
          {formError && (
            <p style={{ color: 'var(--color-danger)', fontSize: 12, margin: 0 }}>{formError}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" disabled={createPhoto.isPending}>
              {createPhoto.isPending ? 'Zapisuję…' : 'Zapisz'}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setShowForm(false); setFormError(null) }}
            >
              Anuluj
            </Button>
          </div>
        </form>
      )}

      {isLoading && <p style={{ fontSize: 12, color: '#A7ABB3' }}>Ładowanie…</p>}

      {!isLoading && photos.length === 0 && !showForm && (
        <p style={{ fontSize: 12, color: '#A7ABB3' }}>Brak zdjęć z realizacji.</p>
      )}

      {photos.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {photos.map(photo => (
            <div
              key={photo.id}
              style={{
                display:       'flex',
                gap:           10,
                alignItems:    'flex-start',
                padding:       '8px 0',
                borderBottom:  '1px solid var(--color-border)',
              }}
            >
              {photo.image_url ? (
                <img
                  src={photo.image_url}
                  alt={photo.title}
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width:           56,
                    height:          56,
                    background:      'var(--color-bg-muted, #EFF0F1)',
                    borderRadius:    4,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    fontSize:        22,
                    flexShrink:      0,
                  }}
                >
                  📷
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {photo.title}
                </p>
                <Badge variant={CATEGORY_BADGE[photo.category] ?? 'default'}>
                  {CATEGORY_LABELS[photo.category] ?? photo.category}
                </Badge>
                {photo.note && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {photo.note}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deletePhoto.isPending}
                style={{
                  background: 'none',
                  border:     'none',
                  cursor:     deletePhoto.isPending ? 'default' : 'pointer',
                  color:      'var(--color-danger)',
                  padding:    '0 4px',
                  fontSize:   16,
                  opacity:    deletePhoto.isPending ? 0.4 : 1,
                }}
                title="Usuń zdjęcie"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
