-- =============================================================================
-- Migration 032: Sequential invoice number generator
--
-- Fixes invoice numbering: replaces timestamp-based pseudo-random numbers
-- with proper per-company / per-year sequential numbers.
--
-- Format: FV/{YYYY}/{NNN}  e.g.  FV/2026/001
--
-- The counter table guarantees atomicity: INSERT ... ON CONFLICT DO UPDATE
-- is a single atomic operation in PostgreSQL — no race conditions.
-- =============================================================================

BEGIN;

-- ── Counter table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  company_id  uuid  NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year        int   NOT NULL,
  last_seq    int   NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);

-- Pre-seed counters from existing invoices so we don't restart at 1 for
-- companies that already have data in the table.
INSERT INTO public.invoice_counters (company_id, year, last_seq)
SELECT
  company_id,
  date_part('year', issue_date)::int AS year,
  count(*)::int                      AS last_seq
FROM public.invoices
WHERE company_id IS NOT NULL
  AND issue_date IS NOT NULL
GROUP BY company_id, date_part('year', issue_date)::int
ON CONFLICT (company_id, year) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Only the function (SECURITY DEFINER) writes to this table.
-- Direct user access is not needed.
DROP POLICY IF EXISTS "invoice_counters_deny_direct" ON public.invoice_counters;
CREATE POLICY "invoice_counters_deny_direct" ON public.invoice_counters
  FOR ALL USING (false);

-- ── Function ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := date_part('year', now())::int;
  v_seq  int;
BEGIN
  -- Atomic increment: single statement, serialized by PK row lock
  INSERT INTO public.invoice_counters (company_id, year, last_seq)
  VALUES (p_company_id, v_year, 1)
  ON CONFLICT (company_id, year)
  DO UPDATE SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'FV/' || v_year || '/' || lpad(v_seq::text, 3, '0');
END;
$$;

-- Grant execute to the anon/authenticated roles used by Supabase's API
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO service_role;

COMMIT;
