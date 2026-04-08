-- Migration 115: Invoice payment reminders
-- Adds:
--   1. invoice_reminders table — tracks every reminder sent per invoice
--   2. reminder_count, last_reminder_at columns on invoices
--   3. Extend operator_notifications type check to include 'payment_reminder'

-- ─── 1. invoice_reminders table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id       UUID NOT NULL REFERENCES public.invoices(id)  ON DELETE CASCADE,
  reminder_number  INTEGER NOT NULL CHECK (reminder_number IN (1, 2, 3)),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_email  TEXT,
  status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message    TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_id
  ON public.invoice_reminders (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_company_id
  ON public.invoice_reminders (company_id);

-- ─── 2. Reminder tracking fields on invoices ──────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at  TIMESTAMPTZ;

-- ─── 3. RLS on invoice_reminders ──────────────────────────────────────────────

ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

-- Operators can read/insert reminders for their own company
CREATE POLICY "invoice_reminders_operator_select"
  ON public.invoice_reminders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_reminders_operator_insert"
  ON public.invoice_reminders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role bypasses RLS — scheduled function uses service role key

-- ─── 4. Extend operator_notifications type check ──────────────────────────────

ALTER TABLE public.operator_notifications
  DROP CONSTRAINT IF EXISTS operator_notifications_type_check;

ALTER TABLE public.operator_notifications
  ADD CONSTRAINT operator_notifications_type_check
  CHECK (type IN (
    'client_message',
    'client_approval_response',
    'missing_costs',
    'payment_reminder'
  ));
