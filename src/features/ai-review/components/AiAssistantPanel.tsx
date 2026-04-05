// =============================================================================
// AiAssistantPanel — lightweight project-scoped AI assistant
// =============================================================================
// Embedded inside AiRunReviewPanel. Helps the operator understand the current
// analysis: scope, risks, missing data, catalog matches, and next steps.
//
// Architecture:
//   - Preset question chips → answered locally from run data (instant, free)
//   - Custom question → calls backend ai-project-assistant endpoint
//   - No open-ended chat feel, no conversation history across runs
//   - Read-only — never modifies business state
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import type { AiAnalysisRun, AiScopeItem, AiQuestion, AiRisk } from '../api/ai-review.api'
import type { ServiceCatalogItem } from '@/entities/service_catalog/model'
import { matchCatalogItem } from '@/features/service-catalog'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { netlifyFn } from '@/shared/lib/functions'
import { supabase } from '@/shared/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  run:        AiAnalysisRun
  scope:      AiScopeItem[]
  questions:  AiQuestion[]
  risks:      AiRisk[]
  catalog?:   ServiceCatalogItem[]
  projectId:  string
}

interface AssistantAnswer {
  question: string
  answer:   string
  source:   'local' | 'ai'
}

// ── Preset question chips ────────────────────────────────────────────────────

const PRESET_CHIPS = [
  { id: 'summary',    label: '🔍 Co AI wykryło?',                    icon: '🔍' },
  { id: 'risks',      label: '⚠️ Jakie są ryzyka?',                  icon: '⚠️' },
  { id: 'missing',    label: '📋 Czego brakuje do wyceny?',          icon: '📋' },
  { id: 'uncertain',  label: '❓ Które pozycje są niepewne?',         icon: '❓' },
  { id: 'catalog',    label: '📚 Dlaczego pozycje nie dopasowały się?', icon: '📚' },
  { id: 'checklist',  label: '✅ Co poprawić przed draftem?',         icon: '✅' },
] as const

type PresetId = typeof PRESET_CHIPS[number]['id']

// ── Local answer generators ──────────────────────────────────────────────────

function generateLocalAnswer(
  chipId: PresetId,
  run: AiAnalysisRun,
  scope: AiScopeItem[],
  questions: AiQuestion[],
  risks: AiRisk[],
  catalog?: ServiceCatalogItem[],
): string {
  switch (chipId) {
    case 'summary': return buildSummary(run, scope, questions, risks)
    case 'risks': return buildRisksAnswer(risks)
    case 'missing': return buildMissingAnswer(scope, questions)
    case 'uncertain': return buildUncertainAnswer(scope)
    case 'catalog': return buildCatalogAnswer(scope, catalog)
    case 'checklist': return buildChecklist(scope, questions, risks)
  }
}

function buildSummary(run: AiAnalysisRun, scope: AiScopeItem[], questions: AiQuestion[], risks: AiRisk[]): string {
  const roomLabel = run.room_type === 'bathroom' ? 'Łazienka' : run.room_type === 'wc' ? 'WC' : run.room_type
  const conf = run.confidence_summary != null ? `${run.confidence_summary}%` : 'brak danych'

  const categories = new Map<string, number>()
  for (const s of scope) {
    categories.set(s.category, (categories.get(s.category) ?? 0) + 1)
  }
  const catList = Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, n]) => `• ${cat}: ${n} poz.`)
    .join('\n')

  const lines = [
    `AI przeanalizowało pomieszczenie typu **${roomLabel}**.`,
    `Pewność ogólna: **${conf}**.`,
    `Wykryto **${scope.length}** pozycji zakresu, **${questions.length}** pytań i **${risks.length}** ryzyk.`,
  ]

  if (catList) {
    lines.push('', 'Główne kategorie prac:', catList)
  }

  if (run.missing_data) {
    lines.push('', '⚠ AI sygnalizuje brakujące dane wejściowe — odpowiedzi na pytania mogą poprawić jakość.')
  }

  return lines.join('\n')
}

function buildRisksAnswer(risks: AiRisk[]): string {
  if (risks.length === 0) return 'AI nie wykryło istotnych ryzyk w tym zakresie. ✅'

  const high   = risks.filter(r => r.severity === 'high')
  const medium = risks.filter(r => r.severity === 'medium')
  const low    = risks.filter(r => r.severity === 'low')

  const lines: string[] = [`Wykryto **${risks.length}** ryzyk:`]

  if (high.length > 0) {
    lines.push('', '🔴 **Wysokie:**')
    high.forEach(r => lines.push(`• ${r.title}${r.description ? ` — ${r.description}` : ''}`))
  }
  if (medium.length > 0) {
    lines.push('', '🟡 **Średnie:**')
    medium.forEach(r => lines.push(`• ${r.title}${r.description ? ` — ${r.description}` : ''}`))
  }
  if (low.length > 0) {
    lines.push('', '🟢 **Niskie:**')
    low.forEach(r => lines.push(`• ${r.title}`))
  }

  const open = risks.filter(r => r.status === 'open').length
  if (open > 0) {
    lines.push('', `⏳ ${open} z ${risks.length} ryzyk wymaga jeszcze potwierdzenia.`)
  }

  return lines.join('\n')
}

function buildMissingAnswer(scope: AiScopeItem[], questions: AiQuestion[]): string {
  const lines: string[] = []

  const missingPrice = scope.filter(s =>
    ['accepted', 'modified'].includes(s.review_status)
    && s.missing_price
    && !s.price_confirmed_by_operator,
  )
  const unanswered = questions.filter(q => q.status === 'unanswered')
  const pending = scope.filter(s => s.review_status === 'pending')

  if (missingPrice.length === 0 && unanswered.length === 0 && pending.length === 0) {
    return 'Wszystko wygląda kompletnie — możesz utworzyć draft wyceny. ✅'
  }

  if (pending.length > 0) {
    lines.push(`📌 **${pending.length}** pozycji czeka na przegląd (zaakceptuj, zmodyfikuj lub odrzuć).`)
  }

  if (missingPrice.length > 0) {
    lines.push(`💰 **${missingPrice.length}** zaakceptowanych pozycji nie ma ceny:`)
    missingPrice.slice(0, 5).forEach(s => lines.push(`• ${s.description}`))
    if (missingPrice.length > 5) lines.push(`• …i ${missingPrice.length - 5} więcej`)
    lines.push('Uzupełnij ceny po utworzeniu draftu wyceny.')
  }

  if (unanswered.length > 0) {
    const critical = unanswered.filter(q => q.severity === 'critical_for_scope')
    lines.push(`❓ **${unanswered.length}** pytań bez odpowiedzi${critical.length > 0 ? ` (${critical.length} krytycznych)` : ''}.`)
    critical.slice(0, 3).forEach(q => lines.push(`• ${q.text}`))
    lines.push('Odpowiedzi zwiększą dokładność wyceny.')
  }

  return lines.join('\n')
}

function buildUncertainAnswer(scope: AiScopeItem[]): string {
  const lowConf = scope.filter(s => s.confidence != null && s.confidence < 60)
  const medConf = scope.filter(s => s.confidence != null && s.confidence >= 60 && s.confidence < 80)

  if (lowConf.length === 0 && medConf.length === 0) {
    return 'Wszystkie pozycje mają dobrą pewność (≥80%). ✅'
  }

  const lines: string[] = []

  if (lowConf.length > 0) {
    lines.push(`🔴 **Niska pewność (<60%)** — ${lowConf.length} pozycji:`)
    lowConf.slice(0, 5).forEach(s =>
      lines.push(`• ${s.description} — ${s.confidence}%`),
    )
    if (lowConf.length > 5) lines.push(`• …i ${lowConf.length - 5} więcej`)
    lines.push('Te pozycje wymagają ręcznej weryfikacji ilości i cen.')
  }

  if (medConf.length > 0) {
    lines.push('', `🟡 **Średnia pewność (60-79%)** — ${medConf.length} pozycji:`)
    medConf.slice(0, 3).forEach(s =>
      lines.push(`• ${s.description} — ${s.confidence}%`),
    )
    lines.push('Sprawdź ilości — mogą wymagać korekty.')
  }

  return lines.join('\n')
}

function buildCatalogAnswer(scope: AiScopeItem[], catalog?: ServiceCatalogItem[]): string {
  if (!catalog?.length) {
    return 'Katalog usług jest pusty lub nie załadowany. Dopasowanie nie jest możliwe.'
  }

  let strong = 0, partial = 0, none = 0
  const partialItems: string[] = []
  const noneItems: string[] = []

  for (const item of scope) {
    const name = item.title ?? item.description ?? ''
    const mr = matchCatalogItem(name, catalog)
    if (mr.best?.tier === 'strong') { strong++ }
    else if (mr.best?.tier === 'partial') {
      partial++
      if (partialItems.length < 3) {
        partialItems.push(`• "${name}" → częściowo: ${mr.best.canonical_name} (${mr.best.confidence}%, ${mr.best.match_reason})`)
      }
    } else {
      none++
      if (noneItems.length < 3) {
        const alt = mr.alternatives[0]
        noneItems.push(`• "${name}"${alt ? ` — najbliższe: ${alt.canonical_name} (${alt.confidence}%)` : ''}`)
      }
    }
  }

  const lines = [
    `Dopasowanie do katalogu usług (${catalog.length} pozycji):`,
    `• ✅ **${strong}** pewnych dopasowań`,
    `• ⚠️ **${partial}** częściowych`,
    `• ❌ **${none}** bez dopasowania`,
  ]

  if (partial > 0 || none > 0) {
    lines.push('')
    lines.push('**Dlaczego częściowe dopasowania?**')
    lines.push('AI używa nazw kreatywnych lub złożonych, które nie pasują 1:1 do katalogu.')
    lines.push('Synonimy i normalizacja pomagają, ale nietypowe sformułowania mogą nie trafić.')
  }

  if (partialItems.length > 0) {
    lines.push('', 'Przykłady częściowych:')
    lines.push(...partialItems)
  }

  if (noneItems.length > 0) {
    lines.push('', 'Przykłady bez dopasowania:')
    lines.push(...noneItems)
    lines.push('', 'Te pozycje możesz ręcznie przypisać do katalogu w edytorze wyceny.')
  }

  return lines.join('\n')
}

function buildChecklist(scope: AiScopeItem[], questions: AiQuestion[], risks: AiRisk[]): string {
  const checks: string[] = []
  let allGood = true

  const pending = scope.filter(s => s.review_status === 'pending').length
  if (pending > 0) {
    checks.push(`❌ Przejrzyj ${pending} pozycji oczekujących na decyzję`)
    allGood = false
  } else {
    checks.push('✅ Wszystkie pozycje przejrzane')
  }

  const unanswered = questions.filter(q => q.status === 'unanswered')
  const critical = unanswered.filter(q => q.severity === 'critical_for_scope')
  if (critical.length > 0) {
    checks.push(`❌ Odpowiedz na ${critical.length} krytycznych pytań`)
    allGood = false
  } else if (unanswered.length > 0) {
    checks.push(`⚠️ ${unanswered.length} pytań opcjonalnych bez odpowiedzi (nie blokuje draftu)`)
  } else {
    checks.push('✅ Wszystkie pytania odpowiedziane')
  }

  const openRisks = risks.filter(r => r.status === 'open' && r.severity === 'high')
  if (openRisks.length > 0) {
    checks.push(`⚠️ ${openRisks.length} wysokich ryzyk do potwierdzenia`)
  } else {
    checks.push('✅ Ryzyka potwierdzone')
  }

  const accepted = scope.filter(s => s.review_status === 'accepted' || s.review_status === 'modified')
  const missingPrice = accepted.filter(s => s.missing_price && !s.price_confirmed_by_operator)
  if (missingPrice.length > 0) {
    checks.push(`⚠️ ${missingPrice.length} pozycji bez ceny — uzupełnisz w edytorze wyceny`)
  }

  if (accepted.length === 0 && scope.length > 0) {
    checks.push('❌ Brak zaakceptowanych pozycji — draft wyceny będzie pusty')
    allGood = false
  }

  const lines = ['**Checklist przed utworzeniem draftu:**', '', ...checks]

  if (allGood) {
    lines.push('', '🟢 Możesz utworzyć draft wyceny.')
  } else {
    lines.push('', '🟡 Popraw powyższe punkty, aby draft był kompletny.')
  }

  return lines.join('\n')
}

// ── Custom question (backend call) ──────────────────────────────────────────

async function askCustomQuestion(
  question: string,
  run: AiAnalysisRun,
  scope: AiScopeItem[],
  questions: AiQuestion[],
  risks: AiRisk[],
  companyId: string,
  projectId: string,
): Promise<string> {
  // Build compact context summary for the backend
  const context = {
    room_type: run.room_type,
    confidence: run.confidence_summary,
    scope_count: scope.length,
    scope_summary: scope.slice(0, 15).map(s => ({
      desc: (s.description ?? '').slice(0, 80),
      cat: s.category,
      status: s.review_status,
      conf: s.confidence,
      missing_price: s.missing_price,
    })),
    questions_count: questions.length,
    unanswered: questions.filter(q => q.status === 'unanswered').map(q => q.text).slice(0, 5),
    risks_summary: risks.map(r => ({ title: r.title, severity: r.severity, status: r.status })),
    missing_data: run.missing_data,
  }

  // Get auth token
  const authHeaders: Record<string, string> = {}
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`
  }

  const resp = await fetch(netlifyFn('ai-project-assistant'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      question,
      company_id: companyId,
      project_id: projectId,
      run_id: run.id,
      context,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    if (resp.status === 429) return '⚠ Limit zapytań do asystenta wyczerpany. Spróbuj za chwilę.'
    return `⚠ Błąd asystenta (${resp.status}). Spróbuj ponownie.`
  }

  const data = await resp.json()
  return data.answer ?? 'Brak odpowiedzi.'
}

// ── Main component ──────────────────────────────────────────────────────────

export function AiAssistantPanel({ run, scope, questions, risks, catalog, projectId }: Props) {
  const { user }  = useAuth()
  const companyId = useCompanyId()
  const [answers, setAnswers] = useState<AssistantAnswer[]>([])
  const [loading, setLoading] = useState(false)
  const [customQ, setCustomQ] = useState('')
  const [expanded, setExpanded] = useState(false)

  const handlePreset = useCallback((chipId: PresetId, label: string) => {
    const answer = generateLocalAnswer(chipId, run, scope, questions, risks, catalog)
    setAnswers(prev => [...prev, { question: label, answer, source: 'local' }])
    setExpanded(true)
  }, [run, scope, questions, risks, catalog])

  const handleCustom = useCallback(async () => {
    const q = customQ.trim()
    if (!q || loading) return
    setLoading(true)
    setExpanded(true)
    try {
      const answer = await askCustomQuestion(q, run, scope, questions, risks, companyId, projectId)
      setAnswers(prev => [...prev, { question: q, answer, source: 'ai' }])
      setCustomQ('')
    } finally {
      setLoading(false)
    }
  }, [customQ, loading, run, scope, questions, risks, companyId, projectId])

  return (
    <div
      style={{
        marginTop:    12,
        padding:      '14px 16px',
        borderRadius: 10,
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            Asystent AI — zapytaj o tę analizę
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {expanded ? '▲ zwiń' : '▼ rozwiń'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {/* Disclaimer */}
          <div style={{
            fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 10,
            fontStyle: 'italic', lineHeight: 1.4,
          }}>
            Odpowiedzi oparte na bieżącej analizie. Sugestie AI wymagają weryfikacji operatora.
          </div>

          {/* Preset question chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {PRESET_CHIPS.map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handlePreset(chip.id, chip.label)}
                disabled={loading}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 500,
                  borderRadius: 16, cursor: loading ? 'not-allowed' : 'pointer',
                  color: 'var(--color-primary, var(--color-info))',
                  background: 'var(--color-primary-soft, rgba(37,99,235,0.06))',
                  border: '1px solid rgba(37,99,235,0.2)',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Custom question input */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              type="text"
              value={customQ}
              onChange={e => setCustomQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustom()}
              placeholder="Zadaj własne pytanie o tę analizę…"
              disabled={loading}
              style={{
                flex: 1, padding: '7px 10px', fontSize: 12,
                borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-soft, var(--color-surface-soft))',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleCustom}
              disabled={loading || !customQ.trim()}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 8, cursor: loading || !customQ.trim() ? 'not-allowed' : 'pointer',
                color: '#fff',
                background: loading || !customQ.trim() ? 'var(--color-text-muted)' : 'var(--color-primary, var(--color-info))',
                border: 'none', transition: 'background 0.15s',
              }}
            >
              {loading ? '⏳' : 'Zapytaj'}
            </button>
          </div>

          {/* Answers */}
          {answers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {answers.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: a.source === 'ai'
                      ? 'rgba(37,99,235,0.04)'
                      : 'var(--color-surface-soft, var(--color-surface-soft))',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary, var(--color-info))', marginBottom: 4 }}>
                    {a.question}
                    {a.source === 'ai' && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                        (odpowiedź AI)
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--color-text-secondary)',
                    lineHeight: 1.5, whiteSpace: 'pre-line',
                  }}>
                    {formatAnswer(a.answer)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clear button */}
          {answers.length > 2 && (
            <button
              type="button"
              onClick={() => setAnswers([])}
              style={{
                marginTop: 6, padding: '3px 8px', fontSize: 10,
                color: 'var(--color-text-muted)', background: 'transparent',
                border: 'none', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Wyczyść odpowiedzi
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Simple markdown-like bold formatting for answers */
function formatAnswer(text: string): string {
  // Replace **bold** with just the text (no HTML in pre-line render)
  // For now keep as-is — whiteSpace: pre-line handles line breaks
  return text
}
