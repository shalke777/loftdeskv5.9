// ProjectStagesPanel — C2: Fakturowanie progresywne
// Shows stage_started events as interactive progress list.
// "Zakończ etap" creates stage_completed event.
// If project has contract with planned tranches → prompts invoice creation.
import { useState, useMemo } from 'react'
import { CheckCircle2, Circle, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { useProjectTimeline } from '@/features/projects/hooks/useProjectTimeline'
import { useContracts } from '@/features/contracts/hooks/useContracts'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { createTimelineEvent } from '@/features/projects/lib/timeline'
import type { ContractTranche } from '@/entities/contract/model'

interface Props {
  projectId: string
  /** Called when user wants to create invoice from a tranche — passes projectId */
  onRequestInvoice: (projectId: string) => void
}

export function ProjectStagesPanel({ projectId, onRequestInvoice }: Props) {
  const companyId = useCompanyId()
  const { data: events = [], refetch } = useProjectTimeline(projectId)
  const { data: allContracts = [] } = useContracts()

  const [completing, setCompleting] = useState<string | null>(null)
  // After completing a stage: { stageTitle, tranches } to show invoice prompt
  const [invoicePrompt, setInvoicePrompt] = useState<{ stageTitle: string; tranches: ContractTranche[] } | null>(null)

  // Find stages and which are completed
  const { stages, completedIds } = useMemo(() => {
    const started = events.filter(e => e.event_type === 'stage_started')
    const completedTitles = new Set(
      events.filter(e => e.event_type === 'stage_completed').map(e => e.title)
    )
    return {
      stages: started,
      completedIds: new Set(started.filter(s => completedTitles.has(s.title)).map(s => s.id)),
    }
  }, [events])

  // Project contract + planned tranches
  const projectContract = useMemo(
    () => allContracts.find(c => c.project_id === projectId) ?? null,
    [allContracts, projectId],
  )
  const plannedTranches: ContractTranche[] = useMemo(
    () => (projectContract?.tranches ?? []).filter(t => t.status === 'planned'),
    [projectContract],
  )

  if (stages.length === 0) return null

  async function handleComplete(stageId: string, stageTitle: string) {
    if (!companyId) return
    setCompleting(stageId)
    try {
      await createTimelineEvent({
        company_id: companyId,
        project_id: projectId,
        event_type: 'stage_completed',
        visibility: 'client_shared',
        title: stageTitle,
        actor_type: 'operator',
        payload: { completed_stage_id: stageId },
      })
      await refetch()
      if (plannedTranches.length > 0) {
        setInvoicePrompt({ stageTitle, tranches: plannedTranches })
      }
    } finally {
      setCompleting(null)
    }
  }

  const doneCount = completedIds.size
  const totalCount = stages.length

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Etapy projektu
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
            {doneCount}/{totalCount} ukończonych
          </span>
        </div>
        {totalCount > 0 && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{Math.round(doneCount / totalCount * 100)}%</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 4, background: 'var(--color-border)', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          borderRadius: 4,
          background: doneCount === totalCount ? 'var(--color-success)' : 'var(--color-brand)',
          width: `${totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Stages list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {stages.map((stage) => {
          const done = completedIds.has(stage.id)
          const isCompleting = completing === stage.id
          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: done ? 'var(--color-success-soft, rgba(16,185,129,0.07))' : 'var(--color-surface-soft)',
                border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : 'var(--color-border)'}`,
                transition: 'background 0.2s',
              }}
            >
              {done
                ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                : <Circle size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              }
              <span style={{
                flex: 1,
                fontSize: 13,
                fontWeight: done ? 400 : 600,
                color: done ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                textDecoration: done ? 'line-through' : 'none',
              }}>
                {stage.title}
              </span>
              {!done && (
                <button
                  type="button"
                  disabled={isCompleting}
                  onClick={() => handleComplete(stage.id, stage.title)}
                  style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '4px 10px', borderRadius: 6,
                    background: 'var(--color-brand)', color: '#fff',
                    border: 'none', cursor: isCompleting ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    opacity: isCompleting ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {isCompleting ? <Loader2 size={11} className="spinner" /> : <ChevronRight size={11} />}
                  {isCompleting ? 'Zapisywanie…' : 'Zakończ'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Invoice prompt — appears after completing a stage if planned tranches exist */}
      {invoicePrompt && (
        <div style={{
          marginTop: 14,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--color-info-soft, rgba(96,165,250,0.1))',
          border: '1px solid rgba(96,165,250,0.3)',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} style={{ color: 'var(--color-info)' }} />
            Etap „{invoicePrompt.stageTitle}" zakończony
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginBottom: 10 }}>
            Umowa ma {invoicePrompt.tranches.length} {invoicePrompt.tranches.length === 1 ? 'nierozliczoną transzę' : 'nierozliczone transze'}:
            <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
              {invoicePrompt.tranches.map(t => (
                <li key={t.id} style={{ padding: '2px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} />{t.label}</span>
                  <span style={{ fontWeight: 700 }}>{t.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { setInvoicePrompt(null); onRequestInvoice(projectId) }}
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Generuj fakturę
            </button>
            <button
              type="button"
              onClick={() => setInvoicePrompt(null)}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
            >
              Później
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
