// =============================================================================
// portal-project.api.ts — stub
// =============================================================================
// The `project_portal_tokens` table was removed in migration 051 (dropped via
// CASCADE). This stub keeps existing import sites from crashing while a proper
// replacement is planned.
//
// Callers that depended on these tokens (ExpenseApprovalModal, ProjectThreadsTab)
// will receive empty lists and should gracefully handle the absence of tokens.
//
// Document sending to clients now goes through /.netlify/functions/send-document
// with a `project_id` payload — it auto-provisions client_accounts access and
// generates a Supabase magic link without URL tokens.
// =============================================================================

export interface ProjectPortalToken {
  id:           string
  project_id:   string
  company_id:   string
  token_hash:   string
  client_name:  string | null
  client_email: string | null
  active:       boolean
  expires_at:   string | null
  revoked_at:   string | null
  created_at:   string
}

/** Always returns [] — table was dropped in migration 051. */
export async function listProjectPortalTokens(_projectId: string): Promise<ProjectPortalToken[]> {
  return []
}

/** Throws — table was dropped in migration 051. Use send-document flow instead. */
export async function createProjectPortalToken(_opts: {
  company_id:  string
  project_id:  string
  client_name: string
}): Promise<{ raw_token: string; id: string }> {
  throw new Error(
    'project_portal_tokens table has been removed (migration 051). ' +
    'Use /.netlify/functions/send-document with project_id to invite clients.',
  )
}
