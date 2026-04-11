-- =============================================================================
-- Migration 118: next_doc_number — issue_date aware + prefix from settings + reset RPC
--
-- Fixes:
--   1. next_doc_number used now() — backdated invoices (issue_date in past month)
--      got the current month's counter bumped and wrong month in the number.
--      Fix: accept p_issue_date date DEFAULT NULL; when set, use it for year/month.
--
--   2. Custom prefix stored in companies.doc_number_config was ignored by the function.
--      Fix: read prefix from doc_number_config when set.
--
--   3. No way to reset a monthly counter after deleting test documents.
--      Fix: add reset_doc_counter(company_id, doc_type, year, month, value) RPC.
--
-- Backward compat:
--   Existing callers that pass only (p_company_id, p_doc_type) continue to work —
--   p_issue_date defaults to NULL → falls back to now()::date (current behaviour).
-- =============================================================================

-- ── Drop old 2-parameter overload so we can replace it with the 3-param version ──
DROP FUNCTION IF EXISTS public.next_doc_number(uuid, text);

-- ── Updated function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_company_id  uuid,
  p_doc_type    text,
  p_issue_date  date DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_date date := COALESCE(p_issue_date, now()::date);
  v_year     int  := date_part('year',  v_ref_date)::int;
  v_month    int  := date_part('month', v_ref_date)::int;
  v_seq      int;
  v_prefix   text;
BEGIN
  -- Read custom prefix from companies.doc_number_config (set via Settings UI).
  -- Falls back to hardcoded default when not configured.
  SELECT COALESCE(
    NULLIF(trim((doc_number_config -> p_doc_type ->> 'prefix')), ''),
    CASE p_doc_type
      WHEN 'estimate' THEN 'WY'
      WHEN 'contract' THEN 'UM'
      WHEN 'invoice'  THEN 'FV'
      ELSE upper(left(p_doc_type, 2))
    END
  )
  INTO v_prefix
  FROM public.companies
  WHERE id = p_company_id;

  -- Defensive fallback when company row is missing
  IF v_prefix IS NULL THEN
    v_prefix := CASE p_doc_type
      WHEN 'estimate' THEN 'WY'
      WHEN 'contract' THEN 'UM'
      WHEN 'invoice'  THEN 'FV'
      ELSE upper(left(p_doc_type, 2))
    END;
  END IF;

  -- Atomic increment — single PK-locked statement, no race conditions
  INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
  VALUES (p_company_id, p_doc_type, v_year, v_month, 1)
  ON CONFLICT (company_id, doc_type, year, month)
  DO UPDATE SET last_seq = doc_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Format: PREFIX/YYYY/MM/N
  RETURN v_prefix || '/' || v_year || '/' || lpad(v_month::text, 2, '0') || '/' || v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text, date) TO service_role;

-- ── Reset function ────────────────────────────────────────────────────────────
-- Allows operators/owners to reset (or set) the counter for a specific month.
-- p_value = 0  → next document in that month will receive number 1
-- p_value = 5  → next document will receive number 6
--
-- Security: only members of the company may reset its own counters.
-- The SECURITY DEFINER bypasses the doc_counters RLS (deny-all), but the
-- explicit membership check ensures users can only touch their own company.
CREATE OR REPLACE FUNCTION public.reset_doc_counter(
  p_company_id  uuid,
  p_doc_type    text,
  p_year        int,
  p_month       int,
  p_value       int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must be a member of the target company
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Brak uprawnień do firmy %', p_company_id;
  END IF;

  -- Upsert counter to requested value
  INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
  VALUES (p_company_id, p_doc_type, p_year, p_month, p_value)
  ON CONFLICT (company_id, doc_type, year, month)
  DO UPDATE SET last_seq = p_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_doc_counter(uuid, text, int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_doc_counter(uuid, text, int, int, int) TO service_role;
