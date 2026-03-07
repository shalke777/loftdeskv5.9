-- LoftDesk v5.9: Projekt jako automatyczna paczka dokumentów
-- Migration 018: project_documents, project_timeline, assignment_queue, export_jobs
-- + ALTER cost_estimates (add project_id) + ALTER projects (add completeness fields)

-- ── 1. Rozszerzenie tabeli projects ─────────────────────────────────────────
alter table projects
  add column if not exists investment_address   text,
  add column if not exists completeness_score   smallint not null default 0,
  add column if not exists completeness_flags   jsonb not null default '{}',
  add column if not exists archived_at          timestamptz;

-- ── 2. Rozszerzenie cost_estimates o project_id ──────────────────────────────
alter table cost_estimates
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists cost_estimates_project_id_idx on cost_estimates(project_id);

-- ── 3. Tabela project_documents ──────────────────────────────────────────────
create table if not exists project_documents (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id) on delete cascade,
  project_id           uuid not null references projects(id) on delete cascade,
  doc_type             text not null check (
                         doc_type in ('estimate','contract','invoice','attachment','note','protocol','other')
                       ),
  doc_id               uuid not null,
  assignment_status    text not null default 'confirmed'
                         check (assignment_status in ('confirmed','pending','rejected')),
  linked_automatically boolean not null default false,
  linked_manually      boolean not null default false,
  source_doc_type      text,
  source_doc_id        uuid,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, project_id, doc_type, doc_id)
);

create index if not exists proj_docs_project_idx on project_documents(project_id);
create index if not exists proj_docs_doc_idx     on project_documents(doc_type, doc_id);
create index if not exists proj_docs_active_idx  on project_documents(company_id, project_id)
  where archived_at is null;

-- ── 4. Tabela project_timeline ───────────────────────────────────────────────
create table if not exists project_timeline (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists proj_timeline_project_idx on project_timeline(project_id, created_at desc);

-- ── 5. Tabela assignment_queue ───────────────────────────────────────────────
create table if not exists assignment_queue (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id) on delete cascade,
  doc_type             text not null,
  doc_id               uuid not null,
  suggested_project_id uuid references projects(id) on delete set null,
  confidence           smallint default 0,
  reason               text,
  resolved_at          timestamptz,
  resolved_by          uuid references auth.users(id) on delete set null,
  resolution           text check (resolution in ('accepted','rejected','reassigned','skipped')),
  created_at           timestamptz not null default now(),
  unique (company_id, doc_type, doc_id)
);

create index if not exists assignment_queue_pending_idx
  on assignment_queue(company_id)
  where resolved_at is null;

-- ── 6. Tabela export_jobs ────────────────────────────────────────────────────
create table if not exists export_jobs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending','processing','done','error')),
  doc_ids      uuid[] not null default '{}',
  file_url     text,
  manifest     jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists export_jobs_project_idx on export_jobs(project_id, created_at desc);

-- ── 7. Trigger: updated_at na project_documents ─────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_documents_updated_at on project_documents;
create trigger project_documents_updated_at
  before update on project_documents
  for each row execute function touch_updated_at();

-- ── 8. RLS: project_documents ────────────────────────────────────────────────
alter table project_documents enable row level security;

drop policy if exists "pd_select" on project_documents;
create policy "pd_select" on project_documents
  for select using (company_id = my_company_id());

drop policy if exists "pd_insert" on project_documents;
create policy "pd_insert" on project_documents
  for insert with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin','manager')
  );

drop policy if exists "pd_update" on project_documents;
create policy "pd_update" on project_documents
  for update
  using (company_id = my_company_id())
  with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin','manager')
  );

drop policy if exists "pd_delete" on project_documents;
create policy "pd_delete" on project_documents
  for delete using (
    company_id = my_company_id()
    and my_role() in ('owner','admin')
  );

-- ── 9. RLS: project_timeline ─────────────────────────────────────────────────
alter table project_timeline enable row level security;

drop policy if exists "pt_select" on project_timeline;
create policy "pt_select" on project_timeline
  for select using (company_id = my_company_id());

drop policy if exists "pt_insert" on project_timeline;
create policy "pt_insert" on project_timeline
  for insert with check (company_id = my_company_id());

-- ── 10. RLS: assignment_queue ────────────────────────────────────────────────
alter table assignment_queue enable row level security;

drop policy if exists "aq_select" on assignment_queue;
create policy "aq_select" on assignment_queue
  for select using (company_id = my_company_id());

drop policy if exists "aq_insert" on assignment_queue;
create policy "aq_insert" on assignment_queue
  for insert with check (company_id = my_company_id());

drop policy if exists "aq_update" on assignment_queue;
create policy "aq_update" on assignment_queue
  for update
  using (company_id = my_company_id())
  with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin','manager')
  );

-- ── 11. RLS: export_jobs ─────────────────────────────────────────────────────
alter table export_jobs enable row level security;

drop policy if exists "ej_select" on export_jobs;
create policy "ej_select" on export_jobs
  for select using (company_id = my_company_id());

drop policy if exists "ej_insert" on export_jobs;
create policy "ej_insert" on export_jobs
  for insert with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin','manager')
  );
