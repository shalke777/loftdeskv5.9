-- =============================================================================
-- Migration 079: Sequential document number generator for estimates + contracts
--
-- Root cause fixed:
--   estimates.api.ts used Date.now().toString().slice(-4)  → quasi-random 4-digit ms suffix
--   contracts.api.ts used Date.now().toString().slice(-4)  → same bug
--   invoices.api.ts had next_invoice_number (mig 032) but format lacked month
--
-- New format: {PREFIX}/{YYYY}/{MM}/{N}
--   Estimates → WY/2026/03/1
--   Contracts → UM/2026/03/5
--   Invoices  → FV/2026/03/18
--
-- Counter is atomic: INSERT ... ON CONFLICT DO UPDATE is a single PG operation.
-- Separate counter per (company_id, doc_type, year, month).
-- =============================================================================

-- ── Counter table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.doc_counters (
  company_id  uuid    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type    text    NOT NULL,   -- 'estimate' | 'contract' | 'invoice'
  year        int     NOT NULL,
  month       int     NOT NULL,
  last_seq    int     NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, doc_type, year, month)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.doc_counters ENABLE ROW LEVEL SECURITY;

-- Direct writes are never needed — the SECURITY DEFINER function handles all mutations.
DROP POLICY IF EXISTS "doc_counters_deny_direct" ON public.doc_counters;
CREATE POLICY "doc_counters_deny_direct" ON public.doc_counters
  FOR ALL USING (false);

-- ── Pre-seed from existing estimates ─────────────────────────────────────────
-- Counts per (company, year, month) so the next number continues from current data.

INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
SELECT
  e.company_id,
  'estimate',
  date_part('year',  e.created_at)::int,
  date_part('month', e.created_at)::int,
  count(*)::int
FROM public.cost_estimates e
INNER JOIN public.companies c ON c.id = e.company_id
WHERE e.company_id IS NOT NULL
  AND e.created_at IS NOT NULL
GROUP BY e.company_id,
         date_part('year',  e.created_at)::int,
         date_part('month', e.created_at)::int
ON CONFLICT (company_id, doc_type, year, month) DO NOTHING;

-- ── Pre-seed from existing contracts ─────────────────────────────────────────

INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
SELECT
  ct.company_id,
  'contract',
  date_part('year',  ct.created_at)::int,
  date_part('month', ct.created_at)::int,
  count(*)::int
FROM public.contracts ct
INNER JOIN public.companies c ON c.id = ct.company_id
WHERE ct.company_id IS NOT NULL
  AND ct.created_at IS NOT NULL
GROUP BY ct.company_id,
         date_part('year',  ct.created_at)::int,
         date_part('month', ct.created_at)::int
ON CONFLICT (company_id, doc_type, year, month) DO NOTHING;

-- ── Pre-seed from existing invoices (month-granular, uses issue_date) ─────────
-- Distinct from invoice_counters (migration 032) which is year-based.
-- These seeds allow next_doc_number to produce sensible continuations.

INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
SELECT
  i.company_id,
  'invoice',
  date_part('year',  i.issue_date)::int,
  date_part('month', i.issue_date)::int,
  count(*)::int
FROM public.invoices i
INNER JOIN public.companies c ON c.id = i.company_id
WHERE i.company_id IS NOT NULL
  AND i.issue_date IS NOT NULL
GROUP BY i.company_id,
         date_part('year',  i.issue_date)::int,
         date_part('month', i.issue_date)::int
ON CONFLICT (company_id, doc_type, year, month) DO NOTHING;

-- ── Function ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.next_doc_number(p_company_id uuid, p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year   int  := date_part('year',  now())::int;
  v_month  int  := date_part('month', now())::int;
  v_seq    int;
  v_prefix text;
BEGIN
  v_prefix := CASE p_doc_type
    WHEN 'estimate' THEN 'WY'
    WHEN 'contract' THEN 'UM'
    WHEN 'invoice'  THEN 'FV'
    ELSE upper(left(p_doc_type, 2))
  END;

  -- Atomic increment: PK row lock, single statement, no race
  INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
  VALUES (p_company_id, p_doc_type, v_year, v_month, 1)
  ON CONFLICT (company_id, doc_type, year, month)
  DO UPDATE SET last_seq = doc_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Format: PREFIX/YYYY/MM/N  (month zero-padded, sequence NOT padded per UX examples)
  RETURN v_prefix || '/' || v_year || '/' || lpad(v_month::text, 2, '0') || '/' || v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text) TO service_role;
