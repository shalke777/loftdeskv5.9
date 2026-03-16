-- Migration 051: Portal Phase 5 — DROP project_portal_tokens
-- Removes the legacy URL-token invitation mechanism entirely.
-- Phase 4 (migration 050) already dropped: project_portal_sessions,
-- portal_messages, client_tokens, and all portal RPCs/views.
--
-- After this migration the canonical invite flow is:
--   operator JWT → client-identify (Netlify fn) → client_accounts upsert
--   → project_client_access upsert → signInWithOtp magic link
--   → /auth/callback?mode=client&project_id=<id>

BEGIN;

-- Step 1: Drop the token table.
--   CASCADE removes the FK constraint on cost_approvals.portal_token_id
--   (and any other untracked FK pointing here).
DROP TABLE IF EXISTS public.project_portal_tokens CASCADE;

-- Step 2: Drop the now-orphaned column from cost_approvals.
--   The FK was removed by CASCADE above; the column itself needs an
--   explicit ALTER because CASCADE does not drop non-FK columns.
ALTER TABLE IF EXISTS public.cost_approvals
  DROP COLUMN IF EXISTS portal_token_id;

-- Step 3: Drop the soft-reference column from conversations.
--   conversations.portal_token_id was added in migration 033 as a plain UUID
--   with NO FK constraint (only a comment linking to portal_tokens rows).
--   Now that project_portal_tokens is gone, the column is permanently orphaned.
ALTER TABLE IF EXISTS public.conversations
  DROP COLUMN IF EXISTS portal_token_id;

COMMIT;
