-- LoftDesk v5.8: dokumentacja klient-firma, akceptacje zmian, protokoły odbioru, zdjęcia i standardy
create table if not exists client_decisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid,
  project_id uuid,
  related_estimate_id uuid,
  title text not null,
  description text,
  decision_type text not null default 'change',
  status text not null default 'pending_client',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  client_comment text
);

create table if not exists handover_protocols (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid,
  project_id uuid,
  title text not null,
  status text not null default 'draft',
  protocol_date date,
  summary text,
  notes text,
  checklist jsonb not null default '[]'::jsonb
);

create table if not exists project_photo_docs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid,
  project_id uuid,
  title text not null,
  category text not null default 'progress',
  taken_at timestamptz,
  image_url text,
  note text
);

create table if not exists technical_standards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid,
  project_id uuid,
  title text not null,
  category text not null default 'technical_standard',
  source_label text,
  content text not null,
  requires_client_acceptance boolean not null default false,
  accepted_by_client boolean not null default false
);
