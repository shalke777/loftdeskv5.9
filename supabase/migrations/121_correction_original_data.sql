-- Migration 121: store snapshot of header-level fields before correction
-- original_data stores: client_id, client_name, client_nip, issue_date, sale_date,
-- due_date, issue_place, payment_method, bank_account, notes
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_data jsonb;
