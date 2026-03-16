-- Migration 053: Monthly invoice number reset + new format YYYY/MM/N
-- Format change: FV/YYYY/NNN → YYYY/MM/N  (e.g. 2026/03/1, 2026/03/2, 2026/04/1)
-- Reset: per calendar month, not per year. Counter is atomic (INSERT … ON CONFLICT DO UPDATE).
-- Note: old invoice_counters table (year-only PK) is dropped and recreated with year+month PK.

BEGIN;

-- Drop the old counter table (just sequence metadata — regeneratable from invoices)
DROP TABLE IF EXISTS public.invoice_counters CASCADE;

-- Recreate with monthly primary key for per-month numbering restart
CREATE TABLE public.invoice_counters (
  company_id  uuid  NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year        int   NOT NULL,
  month       int   NOT NULL,
  last_seq    int   NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year, month)
);

-- Pre-seed: count existing invoices per company per year+month
INSERT INTO public.invoice_counters (company_id, year, month, last_seq)
SELECT
  company_id,
  date_part('year',  issue_date)::int AS year,
  date_part('month', issue_date)::int AS month,
  count(*)::int                       AS last_seq
FROM public.invoices
WHERE company_id IS NOT NULL
  AND issue_date IS NOT NULL
GROUP BY
  company_id,
  date_part('year',  issue_date)::int,
  date_part('month', issue_date)::int
ON CONFLICT (company_id, year, month) DO NOTHING;

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_counters_deny_direct" ON public.invoice_counters;
CREATE POLICY "invoice_counters_deny_direct" ON public.invoice_counters
  FOR ALL USING (false);

-- Recreate the generator function with new format: YYYY/MM/N
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year  int := date_part('year',  now())::int;
  v_month int := date_part('month', now())::int;
  v_seq   int;
BEGIN
  INSERT INTO public.invoice_counters (company_id, year, month, last_seq)
  VALUES (p_company_id, v_year, v_month, 1)
  ON CONFLICT (company_id, year, month)
  DO UPDATE SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Format: YYYY/MM/N — month zero-padded, sequence without padding
  RETURN v_year || '/' || lpad(v_month::text, 2, '0') || '/' || v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO service_role;

COMMIT;
