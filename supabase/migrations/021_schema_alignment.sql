-- Migration 021: Add missing columns required by the v5.9 frontend API layer
-- All ALTER TABLE ADD COLUMN IF NOT EXISTS — safe to re-run

-- ── clients: city, postal_code, contact_person ──
alter table clients add column if not exists city text;
alter table clients add column if not exists postal_code text;
alter table clients add column if not exists contact_person text;

-- ── cost_estimates: notes, valid_until ──
alter table cost_estimates add column if not exists notes text;
alter table cost_estimates add column if not exists valid_until date;

-- ── cost_estimate_items: name, vat_rate ──
alter table cost_estimate_items add column if not exists name text;
alter table cost_estimate_items add column if not exists vat_rate integer not null default 23;

-- ── invoices: notes, contract_id, invoice_type, sale_date, issue_place,
--             payment_method, bank_account, tranche_id, advance_total ──
alter table invoices add column if not exists notes text;
alter table invoices add column if not exists contract_id uuid references contracts(id) on delete set null;
alter table invoices add column if not exists invoice_type text not null default 'standard';
alter table invoices add column if not exists sale_date date;
alter table invoices add column if not exists issue_place text;
alter table invoices add column if not exists payment_method text not null default 'transfer';
alter table invoices add column if not exists bank_account text;
alter table invoices add column if not exists tranche_id text;
alter table invoices add column if not exists advance_total numeric(14,2);

-- ── invoice_items: tranche_label ──
alter table invoice_items add column if not exists tranche_label text not null default '';

-- ── contracts: estimate_id, start_date, end_date, location,
--              value_net, vat_rate, template_name, template_content,
--              custom_paragraphs, tranches ──
alter table contracts add column if not exists estimate_id uuid references cost_estimates(id) on delete set null;
alter table contracts add column if not exists start_date date;
alter table contracts add column if not exists end_date date;
alter table contracts add column if not exists location text;
alter table contracts add column if not exists value_net numeric(14,2);
alter table contracts add column if not exists vat_rate integer;
alter table contracts add column if not exists template_name text;
alter table contracts add column if not exists template_content text;
alter table contracts add column if not exists custom_paragraphs jsonb not null default '[]'::jsonb;
alter table contracts add column if not exists tranches jsonb not null default '[]'::jsonb;

-- ── indexes ──
create index if not exists idx_invoices_contract on invoices(contract_id);
create index if not exists idx_contracts_estimate on contracts(estimate_id);

-- ── grant execute on bootstrap function to authenticated role ──
grant execute on function public.bootstrap_my_company(text, text) to authenticated;
grant execute on function public.bootstrap_my_company(text, text) to anon;
