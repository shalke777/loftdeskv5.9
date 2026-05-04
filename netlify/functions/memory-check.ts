// memory-check.ts — Rule-based contradiction detection
// POST { project_id, new_content, topic? } + Bearer auth
// Returns { conflict: boolean, existing_entry?, description? }
import type { Handler } from '@netlify/functions'
import { assertProjectAccess, isScopeError, scopeErrorResponse } from '../lib/scope/assertProjectAccess'

// Extract amounts (Polish: 1000 zł, 5 000 PLN, 2500.00, etc.)
function extractAmounts(text: string): number[] {
  const matches = text.match(/\d[\d\s]*(?:[.,]\d{1,2})?/g) ?? []
  return matches
    .map(m => parseFloat(m.replace(/\s/g, '').replace(',', '.')))
    .filter(n => !isNaN(n) && n > 10)
}

// Detect if two amounts are "conflicting" (same order of magnitude but different value)
function amountsConflict(a: number[], b: number[]): number | null {
  for (const x of a) {
    for (const y of b) {
      const ratio = Math.max(x, y) / Math.min(x, y)
      // Same scale (within 10x) but different (>10% diff)
      if (ratio < 10 && Math.abs(x - y) / Math.max(x, y) > 0.10) {
        return x
      }
    }
  }
  return null
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const anonKey    = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
  void supabaseUrl; void anonKey

  let body: { project_id?: string; new_content?: string; topic?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }
  if (!body.project_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'project_id required' }) }
  if (!body.new_content?.trim()) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'new_content required' }) }

  // Sprint P2-FIX: scoped access — JWT + membership + project ownership.
  const scope = await assertProjectAccess(event, body.project_id)
  if (isScopeError(scope)) return scopeErrorResponse(scope, cors)
  const { sb, project } = scope
  const projectId = project.id as string

  const { data: entries } = await sb
    .from('project_memory_entries')
    .select('id, memory_type, topic, content, created_at')
    .eq('project_id', projectId)
    .in('memory_type', ['decision', 'amount', 'preference'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (!entries?.length) {
    return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ conflict: false }) }
  }

  const newAmounts = extractAmounts(body.new_content)
  const newContentLower = body.new_content.toLowerCase()

  for (const entry of entries) {
    // Amount conflict check
    if (newAmounts.length > 0) {
      const existingAmounts = extractAmounts(entry.content)
      if (existingAmounts.length > 0) {
        const conflictAmount = amountsConflict(newAmounts, existingAmounts)
        if (conflictAmount !== null) {
          return {
            statusCode: 200,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conflict: true,
              existing_entry: entry,
              description: `Możliwy konflikt kwoty: nowa wartość (~${conflictAmount}) różni się od wcześniejszego wpisu "${entry.content.slice(0, 80)}"`,
            }),
          }
        }
      }
    }

    // Simple keyword contradiction for decisions (negation words)
    if (entry.memory_type === 'decision' && body.topic && entry.topic === body.topic) {
      const existingLower = entry.content.toLowerCase()
      const negationWords = ['nie ', 'bez ', 'rezygnacja', 'anulowanie', 'zmiana']
      const hasNegation = negationWords.some(w => newContentLower.includes(w) !== existingLower.includes(w))
      if (hasNegation) {
        return {
          statusCode: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conflict: true,
            existing_entry: entry,
            description: `Możliwy konflikt z wcześniejszą decyzją: "${entry.content.slice(0, 80)}"`,
          }),
        }
      }
    }
  }

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ conflict: false }),
  }
}
