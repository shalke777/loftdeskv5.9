// netlify/lib/scope/assertProjectAccess.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sprint P2-FIX — Scoped Access Layer for Netlify functions.
//
// Closes the "service_role + body.{id} without ownership check" IDOR class.
// All AI / report endpoints that previously trusted user-supplied IDs MUST
// now route reads/writes through this guard.
//
// Pattern:
//   const { sb, userId, companyId, project } = await assertProjectAccess(event, projectId)
//   // → 401 if no JWT, 403 if not a member of project's company, 404 if missing
//   // → all subsequent queries use derived companyId, never body.company_id
// ─────────────────────────────────────────────────────────────────────────────
import type { HandlerEvent } from '@netlify/functions'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface ScopeResult {
  sb: SupabaseClient                    // service-role client (callers reuse it)
  userId: string
  companyId: string
  project: { id: string; company_id: string; [k: string]: unknown }
}

export interface ScopeError {
  status: number
  code: string
  message: string
}

export interface VoiceNoteScopeResult {
  sb: SupabaseClient
  userId: string
  companyId: string
  note: { id: string; project_id: string | null; company_id: string | null; transcript: string | null; status: string | null; [k: string]: unknown }
}

const SUPABASE_URL  = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const ANON_KEY      = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function err(status: number, code: string, message: string): ScopeError {
  return { status, code, message }
}

/**
 * Resolve the bearer token's user id without trusting any request body.
 * Returns null if header missing/invalid (caller should respond 401).
 */
async function resolveUserId(event: HandlerEvent): Promise<string | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null
  const header = event.headers['authorization'] ?? event.headers['Authorization']
  if (!header?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(header.slice(7))
    return user?.id ?? null
  } catch {
    return null
  }
}

function serviceClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

/**
 * Authorize a project-scoped request.
 *
 * Flow:
 *   1. Read user id from JWT (Bearer <token>) — never from body.
 *   2. Look up project by id with service-role.
 *   3. Verify the user is a member of project.company_id via company_members.
 *
 * Returns ScopeError (status code + JSON-safe message) on failure so callers
 * can render `return { statusCode: e.status, body: JSON.stringify({ error: e.code }) }`.
 */
export async function assertProjectAccess(
  event: HandlerEvent,
  projectId: string | null | undefined,
): Promise<ScopeResult | ScopeError> {
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    return err(400, 'missing_project_id', 'project_id is required')
  }
  const sb = serviceClient()
  if (!sb) return err(503, 'supabase_not_configured', 'Service role not configured')

  const userId = await resolveUserId(event)
  if (!userId) return err(401, 'unauthorized', 'Bearer token required')

  const { data: project, error: projErr } = await sb
    .from('projects')
    .select('*')
    .eq('id', projectId.trim())
    .maybeSingle()

  if (projErr) return err(500, 'project_lookup_failed', 'Could not verify project')
  if (!project) return err(404, 'project_not_found', 'Project not found')
  const companyId = (project as { company_id?: string }).company_id
  if (!companyId) return err(403, 'project_access_denied', 'Project has no company')

  const { data: member, error: memErr } = await sb
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memErr) return err(500, 'access_check_failed', 'Could not verify membership')
  if (!member) return err(403, 'project_access_denied', 'Not a member of this company')

  return {
    sb,
    userId,
    companyId,
    project: project as ScopeResult['project'],
  }
}

/**
 * Authorize a voice-note-scoped request.
 * Voice notes carry their own (project_id, company_id) so we resolve company
 * via the note row, then verify membership.
 */
export async function assertVoiceNoteAccess(
  event: HandlerEvent,
  noteId: string | null | undefined,
): Promise<VoiceNoteScopeResult | ScopeError> {
  if (!noteId || typeof noteId !== 'string' || !noteId.trim()) {
    return err(400, 'missing_note_id', 'note_id is required')
  }
  const sb = serviceClient()
  if (!sb) return err(503, 'supabase_not_configured', 'Service role not configured')

  const userId = await resolveUserId(event)
  if (!userId) return err(401, 'unauthorized', 'Bearer token required')

  const { data: note, error: noteErr } = await sb
    .from('voice_notes')
    .select('id, project_id, company_id, transcript, status')
    .eq('id', noteId.trim())
    .maybeSingle()

  if (noteErr) return err(500, 'note_lookup_failed', 'Could not verify note')
  if (!note) return err(404, 'note_not_found', 'Voice note not found')

  // Prefer note.company_id; fall back to project lookup if column missing.
  let companyId = (note as { company_id?: string | null }).company_id ?? null
  if (!companyId && (note as { project_id?: string | null }).project_id) {
    const { data: proj } = await sb
      .from('projects')
      .select('company_id')
      .eq('id', (note as { project_id: string }).project_id)
      .maybeSingle()
    companyId = (proj as { company_id?: string } | null)?.company_id ?? null
  }
  if (!companyId) return err(403, 'note_access_denied', 'Note has no resolvable company')

  const { data: member } = await sb
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) return err(403, 'note_access_denied', 'Not a member of this company')

  return {
    sb,
    userId,
    companyId,
    note: note as VoiceNoteScopeResult['note'],
  }
}

/**
 * Resolve (userId, companyId) from JWT alone — for endpoints that only need
 * to scope writes to the caller's company (e.g. memory-add).
 */
export async function getAuthScope(
  event: HandlerEvent,
): Promise<{ sb: SupabaseClient; userId: string; companyId: string } | ScopeError> {
  const sb = serviceClient()
  if (!sb) return err(503, 'supabase_not_configured', 'Service role not configured')

  const userId = await resolveUserId(event)
  if (!userId) return err(401, 'unauthorized', 'Bearer token required')

  const { data: member } = await sb
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle()
  const companyId = (member as { company_id?: string } | null)?.company_id ?? null
  if (!companyId) return err(403, 'no_company', 'User has no company membership')

  return { sb, userId, companyId }
}

export function isScopeError(v: unknown): v is ScopeError {
  return !!v && typeof v === 'object' && 'status' in (v as object) && 'code' in (v as object)
}

export function scopeErrorResponse(e: ScopeError, cors: Record<string, string> = {}) {
  return {
    statusCode: e.status,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify({ error: e.code, message: e.message }),
  }
}
