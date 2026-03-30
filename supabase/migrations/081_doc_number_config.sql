-- 081_doc_number_config.sql
-- Configurable document numbering per company per doc type.
-- Adds doc_number_config jsonb column to companies and updates
-- next_doc_number() to read prefix and start_seq from that config.
--
-- Config shape (per column value):
--   {
--     "estimate": { "prefix": "WY", "start_seq": 1 },
--     "contract":  { "prefix": "UM", "start_seq": 1 },
--     "invoice":   { "prefix": "FV", "start_seq": 1 }
--   }
--
-- Rules:
--   prefix    — applied to every future document of that type (immediate)
--   start_seq — used only when a new monthly series row is inserted for the
--               first time in doc_counters (i.e. new month or brand-new company)
--               Has NO effect on an already-running series for the current month.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS doc_number_config jsonb DEFAULT NULL;

-- Replace next_doc_number to respect per-company config
CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_company_id uuid,
  p_doc_type   text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year        int  := date_part('year',  now())::int;
  v_month       int  := date_part('month', now())::int;
  v_seq         int;
  v_prefix      text;
  v_start_seq   int  := 1;
  v_config      jsonb;
  v_type_config jsonb;
BEGIN
  -- Load company-level numbering config (single lookup, indexed by PK)
  SELECT doc_number_config INTO v_config
  FROM public.companies
  WHERE id = p_company_id;

  IF v_config IS NOT NULL THEN
    v_type_config := v_config -> p_doc_type;
  END IF;

  -- Resolve prefix: company config → hardcoded Polish defaults
  v_prefix := CASE
    WHEN v_type_config IS NOT NULL AND (v_type_config ->> 'prefix') IS NOT NULL AND trim(v_type_config ->> 'prefix') <> ''
      THEN upper(trim(v_type_config ->> 'prefix'))
    WHEN p_doc_type = 'estimate' THEN 'WY'
    WHEN p_doc_type = 'contract' THEN 'UM'
    WHEN p_doc_type = 'invoice'  THEN 'FV'
    ELSE upper(left(p_doc_type, 2))
  END;

  -- Resolve start_seq: only matters when starting a fresh monthly series
  IF v_type_config IS NOT NULL AND (v_type_config ->> 'start_seq') IS NOT NULL THEN
    v_start_seq := greatest(1, (v_type_config ->> 'start_seq')::int);
  END IF;

  -- Atomic increment — uses PK row lock, race-safe
  INSERT INTO public.doc_counters (company_id, doc_type, year, month, last_seq)
  VALUES (p_company_id, p_doc_type, v_year, v_month, v_start_seq)
  ON CONFLICT (company_id, doc_type, year, month)
  DO UPDATE SET last_seq = doc_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Format: PREFIX/YYYY/MM/N  (month zero-padded, sequence not padded)
  RETURN v_prefix || '/' || v_year || '/' || lpad(v_month::text, 2, '0') || '/' || v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_doc_number(uuid, text) TO service_role;
