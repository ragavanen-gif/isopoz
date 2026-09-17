-- ISOPoz — Migration 0002 : workflow commercial (demandes, devis, documents/modèles)
-- Exécuter après 0001_core.sql. Idempotent autant que possible.

-- ============================================================
-- Enums de statuts
-- ============================================================
do $$ begin
  create type request_status as enum
    ('nouvelle','a_traiter','en_etude','devis_a_preparer','devis_envoye','devis_accepte','refusee','annulee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum
    ('brouillon','envoye','en_attente','accepte','refuse','expire','annule');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Demandes clients
-- ============================================================
create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  received_at date not null default current_date,
  subject text not null,
  description text,
  manager_id uuid references public.users(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','email')),
  status request_status not null default 'nouvelle',
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_requests_updated on public.customer_requests;
create trigger trg_requests_updated before update on public.customer_requests
  for each row execute function public.set_updated_at();
create index if not exists idx_requests_client on public.customer_requests(client_id);
create index if not exists idx_requests_status on public.customer_requests(status);

-- ============================================================
-- Devis
-- ============================================================
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  request_id uuid references public.customer_requests(id) on delete set null,
  project_id uuid,  -- FK ajoutée en Phase 3 (chantiers)
  issue_date date not null default current_date,
  valid_until date,
  subject text,
  status quote_status not null default 'brouillon',
  payment_terms text,
  notes text,
  subtotal_cents bigint not null default 0,   -- total HT après remises
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,       -- TTC
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_quotes_updated on public.quotes;
create trigger trg_quotes_updated before update on public.quotes
  for each row execute function public.set_updated_at();
create index if not exists idx_quotes_client on public.quotes(client_id);
create index if not exists idx_quotes_status on public.quotes(status);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position integer not null default 0,
  kind text not null default 'prestation' check (kind in ('prestation','produit')),
  label text not null,
  description text,
  qty numeric(12,2) not null default 1,
  unit_price_cents bigint not null default 0,
  discount_bps integer not null default 0,    -- remise en points de base (1000 = 10%)
  vat_bps integer not null default 2000,       -- TVA en points de base (2000 = 20%)
  line_total_cents bigint not null default 0,  -- HT après remise (calculé serveur)
  created_at timestamptz not null default now()
);
create index if not exists idx_quote_items_quote on public.quote_items(quote_id);

-- ============================================================
-- Modèles de documents (versionnés) & documents
-- ============================================================
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  doc_type text not null,   -- devis, facture, contrat, bon_commande, bon_livraison, courrier, relance
  scope text not null default 'company' check (scope in ('company','personal')),
  owner_id uuid references public.users(id) on delete set null,
  current_version_id uuid,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_templates_updated on public.document_templates;
create trigger trg_templates_updated before update on public.document_templates
  for each row execute function public.set_updated_at();

create table if not exists public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  version integer not null default 1,
  body text not null default '',   -- contient les variables {{...}}
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
alter table public.document_templates
  drop constraint if exists document_templates_current_version_fk;
alter table public.document_templates
  add constraint document_templates_current_version_fk
  foreign key (current_version_id) references public.document_template_versions(id) on delete set null;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  employee_id uuid,  -- RH (FK ajoutée en Phase 3)
  year integer not null,
  doc_type text not null,
  ref_date date not null default current_date,
  reference text,
  name text not null,
  storage_path text,           -- chemin dans Supabase Storage (bucket privé)
  rendered_body text,          -- corps figé si généré depuis un modèle (règle 10)
  amount_cents bigint,
  status text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Classement Client→Année→Type OU Salarié→Année→Type (exclusif)
  constraint documents_owner_chk check (client_id is not null or employee_id is not null)
);
create index if not exists idx_documents_client on public.documents(client_id, year, doc_type);
create index if not exists idx_documents_employee on public.documents(employee_id, year, doc_type);

-- ============================================================
-- Recalcul serveur des totaux d'un devis (source de vérité)
-- ============================================================
create or replace function public.recompute_quote_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_subtotal bigint; v_vat bigint;
begin
  -- Recalcule chaque ligne : HT après remise, arrondi au centime.
  update public.quote_items qi
    set line_total_cents = round(qi.qty * qi.unit_price_cents * (1 - qi.discount_bps / 10000.0))
    where qi.quote_id = p_quote_id;

  select
    coalesce(sum(line_total_cents), 0),
    coalesce(sum(round(line_total_cents * vat_bps / 10000.0)), 0)
    into v_subtotal, v_vat
  from public.quote_items where quote_id = p_quote_id;

  update public.quotes
    set subtotal_cents = v_subtotal,
        vat_cents = v_vat,
        total_cents = v_subtotal + v_vat
    where id = p_quote_id;
end; $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.customer_requests         enable row level security;
alter table public.quotes                     enable row level security;
alter table public.quote_items                enable row level security;
alter table public.document_templates         enable row level security;
alter table public.document_template_versions enable row level security;
alter table public.documents                  enable row level security;

-- Demandes
drop policy if exists req_select on public.customer_requests;
create policy req_select on public.customer_requests for select
  using ( auth_is_super_admin() or auth_has_permission('requests.view') );
drop policy if exists req_insert on public.customer_requests;
create policy req_insert on public.customer_requests for insert
  with check ( auth_is_super_admin() or auth_has_permission('requests.create') );
drop policy if exists req_update on public.customer_requests;
create policy req_update on public.customer_requests for update
  using ( auth_is_super_admin() or auth_has_permission('requests.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('requests.edit') );
drop policy if exists req_delete on public.customer_requests;
create policy req_delete on public.customer_requests for delete
  using ( auth_is_super_admin() or auth_has_permission('requests.delete') );

-- Devis
drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes for select
  using ( auth_is_super_admin() or auth_has_permission('quotes.view') );
drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes for insert
  with check ( auth_is_super_admin() or auth_has_permission('quotes.create') );
drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes for update
  using ( auth_is_super_admin() or auth_has_permission('quotes.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('quotes.edit') );
drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes for delete
  using ( auth_is_super_admin() or auth_has_permission('quotes.delete') );

-- Lignes de devis : alignées sur quotes.view / quotes.edit
drop policy if exists qitems_select on public.quote_items;
create policy qitems_select on public.quote_items for select
  using ( auth_is_super_admin() or auth_has_permission('quotes.view') );
drop policy if exists qitems_write on public.quote_items;
create policy qitems_write on public.quote_items for all
  using ( auth_is_super_admin() or auth_has_permission('quotes.edit') or auth_has_permission('quotes.create') )
  with check ( auth_is_super_admin() or auth_has_permission('quotes.edit') or auth_has_permission('quotes.create') );

-- Modèles
drop policy if exists tpl_select on public.document_templates;
create policy tpl_select on public.document_templates for select
  using ( auth_is_super_admin() or auth_has_permission('templates.view') );
drop policy if exists tpl_write on public.document_templates;
create policy tpl_write on public.document_templates for all
  using ( auth_is_super_admin() or auth_has_permission('templates.create') or auth_has_permission('templates.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('templates.create') or auth_has_permission('templates.edit') );

drop policy if exists tplv_select on public.document_template_versions;
create policy tplv_select on public.document_template_versions for select
  using ( auth_is_super_admin() or auth_has_permission('templates.view') );
drop policy if exists tplv_write on public.document_template_versions;
create policy tplv_write on public.document_template_versions for all
  using ( auth_is_super_admin() or auth_has_permission('templates.create') or auth_has_permission('templates.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('templates.create') or auth_has_permission('templates.edit') );

-- Documents
drop policy if exists docs_select on public.documents;
create policy docs_select on public.documents for select
  using ( auth_is_super_admin() or auth_has_permission('documents.view') );
drop policy if exists docs_write on public.documents;
create policy docs_write on public.documents for all
  using ( auth_is_super_admin() or auth_has_permission('documents.upload') or auth_has_permission('documents.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('documents.upload') or auth_has_permission('documents.edit') );
