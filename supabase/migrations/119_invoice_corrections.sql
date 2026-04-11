-- =============================================================================
-- Migration 119: Invoice corrections (Faktury Korygujące)
--
-- Adds:
--   1. corrected_invoice_id — FK to original invoice (NULL for regular invoices)
--   2. correction_reason    — required text describing what is being corrected
--   3. invoice_type check updated to include 'correction'
--   4. 'correction' doc_type handled by next_doc_number (KOR prefix)
-- =============================================================================

-- ── 1. Add correction columns ────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS corrected_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correction_reason    text;

-- ── 2. Extend invoice_type check to include 'correction' ─────────────────────
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('standard','advance','final','partial','correction'));

-- ── 3. Update next_doc_number to handle 'correction' doc_type (KOR prefix) ───
-- Drop and recreate so the CASE covers 'correction'
DROP FUNCTION IF EXISTS public.next_doc_number(uuid, text, date);

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
  SELECT COALESCE(
    NULLIF(trim((doc_number_config -> p_doc_type ->> 'prefix')), ''),
    CASE p_doc_type
      WHEN 'estimate'   THEN 'WY'
      WHEN 'contract'   THEN 'UM'
      WHEN 'invoice'    THEN 'FV'
      WHEN 'correction' THEN 'KOR'
      ELSE upper(left(p_doc_type, 3))
    END
  )
  INTO v_prefix
  FROM public.companies
  WHERE id = p_company_id;

  IF v_prefix IS NULL THEN
    v_prefix := CASE p_doc_type
      WHEN 'estimate'   THEN 'WY'
      WHEN 'contract'   THEN 'UM'
      WHEN 'invoice'    THEN 'FV'
      WHEN 'correction' THEN 'KOR'
      ELSE upper(left(p_doc_type, 3))
    END;
  END IF;

  INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
  VALUES (p_company_id, p_doc_type, v_year, v_month, 1)
  ON CONFLICT (company_id, doc_type, year, month)
  DO UPDATE SET last_seq = doc_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN v_prefix || '/' || v_year || '/' || lpad(v_month::text, 2, '0') || '/' || v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text, date) TO service_role;
