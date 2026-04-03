// =============================================================================
// AiProgressSteps — Timer-based progress indicator for AI analysis
// =============================================================================
// Shows sequential stages during long-running AI analysis.
// Not real streaming — timer-based transitions for better UX.

import { useState, useEffect } from 'react'

interface ProgressStage {
  label: string
  durationMs: number
}

const DEFAULT_STAGES: ProgressStage[] = [
  { label: 'Przesyłanie danych…', durationMs: 2000 },
  { label: 'AI analizuje pomieszczenie…', durationMs: 13000 },
  { label: 'Przygotowywanie wyników…', durationMs: 15000 },
]

const PROJECT_STAGES: ProgressStage[] = [
  { label: 'Przesyłanie dokumentu…', durationMs: 2000 },
  { label: 'AI analizuje projekt…', durationMs: 18000 },
  { label: 'Rozpoznawanie pomieszczeń i materiałów…', durationMs: 12000 },
  { label: 'Przygotowywanie wyników…', durationMs: 10000 },
]

export function AiProgressSteps({ variant = 'room' }: { variant?: 'room' | 'project' }) {
  const stages = variant === 'project' ? PROJECT_STAGES : DEFAULT_STAGES
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let idx = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    let cumulative = 0
    for (let i = 1; i < stages.length; i++) {
      cumulative += stages[i - 1].durationMs
      const nextIdx = i
      timers.push(setTimeout(() => setActiveIndex(nextIdx), cumulative))
    }

    return () => timers.forEach(clearTimeout)
  }, [stages.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
      {stages.map((stage, i) => {
        const isDone = i < activeIndex
        const isActive = i === activeIndex
        return (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: isDone ? 0.5 : isActive ? 1 : 0.35,
              transition: 'opacity 0.4s ease',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, flexShrink: 0,
              background: isDone ? '#10B981' : isActive ? '#2563EB' : '#E5E7EB',
              color: isDone || isActive ? '#fff' : '#9CA3AF',
            }}>
              {isDone ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#111827' : '#6B7280',
            }}>
              {stage.label}
            </span>
            {isActive && (
              <div className="spinner" style={{ width: 14, height: 14, marginLeft: 'auto' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
