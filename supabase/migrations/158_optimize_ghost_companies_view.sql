-- =============================================================================
-- Migration 158: Optimize ghost_companies_candidates view
-- =============================================================================
-- Problem with mig-157 VIEW definition:
--   The JOIN to cm_real (newer memberships) causes row fan-out when a user
--   belongs to multiple invited companies, producing duplicate ghost rows
--   per candidate and slowing down the scan.
--
-- Fix:
--   Replace the JOIN with:
--     - EXISTS subquery  →  detects real membership (no fan-out, short-circuits)
--     - Scalar subqueries →  pulls real_company_id / real_role / real_since
--                            for the single newest real membership
--
--   The five NOT EXISTS data checks (clients/projects/invoices/contracts/
--   cost_estimates) are unchanged — they were already optimal.
--
-- Idempotent: CREATE OR REPLACE VIEW is safe to re-run.
-- =============================================================================

CREATE OR REPLACE VIEW public.ghost_companies_candidates AS
SELECT
  c.id                  AS company_id,
  c.name                AS company_name,
  c.created_at          AS company_created_at,
  cm_owner.user_id      AS owner_user_id,
  cm_owner.created_at   AS owner_membership_created_at,
  -- Scalar subqueries: one pass, no fan-out, deterministic (newest real row)
  (
    SELECT cm2.company_id
    FROM   public.company_members cm2
    WHERE  cm2.user_id    = cm_owner.user_id
      AND  cm2.company_id != c.id
      AND  cm2.created_at > cm_owner.created_at
    ORDER  BY cm2.created_at DESC
    LIMIT  1
  ) AS real_company_id,
  (
    SELECT cm2.role
    FROM   public.company_members cm2
    WHERE  cm2.user_id    = cm_owner.user_id
      AND  cm2.company_id != c.id
      AND  cm2.created_at > cm_owner.created_at
    ORDER  BY cm2.created_at DESC
    LIMIT  1
  ) AS real_role,
  (
    SELECT cm2.created_at
    FROM   public.company_members cm2
    WHERE  cm2.user_id    = cm_owner.user_id
      AND  cm2.company_id != c.id
      AND  cm2.created_at > cm_owner.created_at
    ORDER  BY cm2.created_at DESC
    LIMIT  1
  ) AS real_membership_created_at

FROM public.companies c
  JOIN public.company_members cm_owner
       ON  cm_owner.company_id = c.id
       AND cm_owner.role       = 'owner'

WHERE
  -- User has at least one newer membership in a different company (real invite)
  EXISTS (
    SELECT 1
    FROM   public.company_members cm2
    WHERE  cm2.user_id    = cm_owner.user_id
      AND  cm2.company_id != c.id
      AND  cm2.created_at > cm_owner.created_at
  )
  -- Ghost company carries no real data (all short-circuit on first hit)
  AND NOT EXISTS (SELECT 1 FROM public.clients        WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.projects       WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoices       WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.contracts      WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cost_estimates WHERE company_id = c.id);

COMMENT ON VIEW public.ghost_companies_candidates IS
  'Migration 158: Optimized ghost company detection view (no JOIN fan-out). '
  'A ghost company: user owns it, user also belongs to a newer invited company, '
  'and the ghost has zero real data. Use cleanup_ghost_company(user_id) to remove.';

NOTIFY pgrst, 'reload schema';
