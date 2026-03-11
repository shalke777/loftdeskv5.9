-- =============================================================================
-- Migration 033: Conversations (chat) + Expense invoices
-- =============================================================================

BEGIN;

-- ── PART 1: Conversations / Chat ─────────────────────────────────────────────
-- A conversation is tied to a company + optionally a client and/or project.
-- Messages are company-side only (operator writes directly from the app).
-- Client-side messages still arrive via existing portal_messages table &
-- portal token flow — we read those and expose them in the new chat view.

CREATE TABLE IF NOT EXISTS public.conversations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id          uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id         uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  portal_token_id    uuid,       -- link to existing portal_tokens row (optional)
  subject              text,
  last_message_at      timestamptz,
  last_message_preview text,                    -- last message content (first 160 chars)
  last_message_sender  text DEFAULT 'operator', -- 'operator' | 'client' | 'note'
  unread_count         int  NOT NULL DEFAULT 0,
  archived             boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender           text        NOT NULL CHECK (sender IN ('operator','client','note')),
  -- 'note' = internal note, not visible to client
  content          text        NOT NULL,
  attachment_url   text,
  attachment_name  text,
  read             boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_company_idx
  ON public.conversations (company_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_conv_idx
  ON public.conversation_messages (conversation_id, created_at ASC);

ALTER TABLE public.conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages  ENABLE ROW LEVEL SECURITY;

-- RLS: company members can see/write their company's data
DROP POLICY IF EXISTS "conversations_rw_own" ON public.conversations;
CREATE POLICY "conversations_rw_own" ON public.conversations
  FOR ALL USING (company_id = my_company_id());

DROP POLICY IF EXISTS "conversation_messages_rw_own" ON public.conversation_messages;
CREATE POLICY "conversation_messages_rw_own" ON public.conversation_messages
  FOR ALL USING (company_id = my_company_id());

-- ── PART 2: Expense invoices ─────────────────────────────────────────────────
-- Cost invoices scanned / uploaded by the operator.

CREATE TABLE IF NOT EXISTS public.expense_invoices (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  -- raw file
  file_url         text,
  file_name        text,
  -- parsed / edited data
  invoice_number   text,
  vendor           text,
  vendor_nip       text,
  issue_date       date,
  amount_net       numeric(14,2),
  amount_vat       numeric(14,2),
  amount_gross     numeric(14,2),
  description      text,
  -- metadata
  status           text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','parsed','review','assigned','error')),
  parse_raw        jsonb,       -- full OCR/AI JSON response for debugging
  duplicate_of     uuid        REFERENCES public.expense_invoices(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_invoices_company_idx
  ON public.expense_invoices (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS expense_invoices_project_idx
  ON public.expense_invoices (project_id)
  WHERE project_id IS NOT NULL;

-- Soft-duplicate detection index: unique number per company
CREATE UNIQUE INDEX IF NOT EXISTS expense_invoices_number_company_uidx
  ON public.expense_invoices (company_id, invoice_number)
  WHERE invoice_number IS NOT NULL AND invoice_number <> '';

ALTER TABLE public.expense_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_invoices_rw_own" ON public.expense_invoices;
CREATE POLICY "expense_invoices_rw_own" ON public.expense_invoices
  FOR ALL USING (company_id = my_company_id());

COMMIT;
