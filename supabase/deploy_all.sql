-- ISOPoz — Script de déploiement complet (Phases 0-6 + RH)
-- À coller en UNE fois dans Supabase → SQL Editor → Run. Idempotent.


-- ============================================================
-- >>> migrations/0001_core.sql
-- ============================================================
-- ISOPoz — Migration 0001 : noyau (users, rôles, permissions, RLS, audit, clients)
-- À exécuter dans le SQL editor Supabase (ou via CLI). Idempotent autant que possible.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Utilitaire : updated_at automatique
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================
-- Utilisateurs (miroir de auth.users)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  status text not null default 'active' check (status in ('active','disabled')),
  is_super_admin boolean not null default false,
  employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

-- Création automatique de la ligne miroir à l'inscription auth
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- Rôles & permissions
-- ============================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,          -- ex: clients.create
  module text not null,              -- ex: clients
  label text not null
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- Overrides individuels (grant/deny) pour la granularité par utilisateur
create table if not exists public.user_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted boolean not null,
  primary key (user_id, permission_id)
);

-- ============================================================
-- Helpers RLS
-- ============================================================
create or replace function public.auth_is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.users where id = auth.uid()), false);
$$;

-- Permission effective : (rôles) ∪ (grant) ∖ (deny), super admin bypass
create or replace function public.auth_has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    coalesce((select is_super_admin from public.users where id = auth.uid()), false)
    or (
      exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = auth.uid() and p.key = perm
      )
      and not exists (
        select 1 from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = auth.uid() and p.key = perm and up.granted = false
      )
    )
    or exists (
      select 1 from public.user_permissions up
      join public.permissions p on p.id = up.permission_id
      where up.user_id = auth.uid() and p.key = perm and up.granted = true
    );
$$;

-- Liste des clés de permission effectives de l'utilisateur courant (pour l'UI)
create or replace function public.my_permission_keys()
returns setof text language sql stable security definer set search_path = public as $$
  select p.key from public.permissions p
  where public.auth_has_permission(p.key);
$$;

-- ============================================================
-- Audit log (règle 11)
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index if not exists idx_audit_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_at on public.audit_log(at desc);

-- ============================================================
-- Paramètres entreprise & séquences de numérotation
-- ============================================================
create table if not exists public.company_settings (
  id boolean primary key default true check (id),   -- singleton
  name text not null default 'ISOPoz',
  logo_path text,
  address text,
  siret text,
  vat_number text,
  default_vat_bps integer not null default 2000,
  quote_prefix text not null default 'DEV',
  invoice_prefix text not null default 'FAC',
  project_prefix text not null default 'CH',
  request_prefix text not null default 'DEM',
  order_prefix text not null default 'CMD',
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.number_sequences (
  scope text not null,
  year integer not null,
  last_value integer not null default 0,
  primary key (scope, year)
);

-- Génère une référence PREFIX-YYYY-NNN de façon atomique
create or replace function public.next_reference(p_scope text, p_prefix text, p_year integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_next integer;
begin
  insert into public.number_sequences (scope, year, last_value)
  values (p_scope, p_year, 1)
  on conflict (scope, year) do update set last_value = public.number_sequences.last_value + 1
  returning last_value into v_next;
  return p_prefix || '-' || p_year::text || '-' || lpad(v_next::text, 3, '0');
end; $$;

-- ============================================================
-- Clients & contacts
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  name text not null,
  type text not null default 'pro' check (type in ('pro','particulier')),
  address text,
  postal_code text,
  city text,
  country text default 'France',
  phone text,
  email text,
  website text,
  siret text,
  vat_number text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();
create index if not exists idx_clients_name on public.clients(name);
create index if not exists idx_clients_deleted on public.clients(deleted_at);

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_contacts_client on public.client_contacts(client_id);

-- ============================================================
-- Notifications
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(user_id, read_at);

-- ============================================================
-- RLS
-- ============================================================
alter table public.users             enable row level security;
alter table public.roles             enable row level security;
alter table public.permissions       enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.user_roles        enable row level security;
alter table public.user_permissions  enable row level security;
alter table public.audit_log         enable row level security;
alter table public.company_settings  enable row level security;
alter table public.clients           enable row level security;
alter table public.client_contacts   enable row level security;
alter table public.notifications     enable row level security;

-- users : chacun lit sa ligne ; admin.users gère tout
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users for select
  using ( id = auth.uid() or auth_is_super_admin() or auth_has_permission('admin.users') );
drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users for all
  using ( auth_is_super_admin() or auth_has_permission('admin.users') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.users') );

-- roles / permissions : lecture large aux authentifiés (nécessaire pour l'UI), écriture admin
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select using ( auth.uid() is not null );
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all
  using ( auth_is_super_admin() or auth_has_permission('admin.roles') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.roles') );

drop policy if exists perms_read on public.permissions;
create policy perms_read on public.permissions for select using ( auth.uid() is not null );
drop policy if exists perms_write on public.permissions;
create policy perms_write on public.permissions for all
  using ( auth_is_super_admin() )
  with check ( auth_is_super_admin() );

drop policy if exists rp_read on public.role_permissions;
create policy rp_read on public.role_permissions for select using ( auth.uid() is not null );
drop policy if exists rp_write on public.role_permissions;
create policy rp_write on public.role_permissions for all
  using ( auth_is_super_admin() or auth_has_permission('admin.roles') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.roles') );

drop policy if exists ur_read on public.user_roles;
create policy ur_read on public.user_roles for select
  using ( user_id = auth.uid() or auth_is_super_admin() or auth_has_permission('admin.users') );
drop policy if exists ur_write on public.user_roles;
create policy ur_write on public.user_roles for all
  using ( auth_is_super_admin() or auth_has_permission('admin.users') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.users') );

drop policy if exists up_read on public.user_permissions;
create policy up_read on public.user_permissions for select
  using ( user_id = auth.uid() or auth_is_super_admin() or auth_has_permission('admin.permissions') );
drop policy if exists up_write on public.user_permissions;
create policy up_write on public.user_permissions for all
  using ( auth_is_super_admin() or auth_has_permission('admin.permissions') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.permissions') );

-- audit : lecture admin.audit, écriture via service_role (bypass RLS)
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select
  using ( auth_is_super_admin() or auth_has_permission('admin.audit') );

-- company_settings : lecture authentifiés, écriture admin.settings
drop policy if exists settings_read on public.company_settings;
create policy settings_read on public.company_settings for select using ( auth.uid() is not null );
drop policy if exists settings_write on public.company_settings;
create policy settings_write on public.company_settings for all
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.settings') );

-- clients
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select
  using ( auth_is_super_admin() or auth_has_permission('clients.view') );
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert
  with check ( auth_is_super_admin() or auth_has_permission('clients.create') );
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update
  using ( auth_is_super_admin() or auth_has_permission('clients.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('clients.edit') );
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete
  using ( auth_is_super_admin() or auth_has_permission('clients.delete') );

-- client_contacts : aligné sur clients
drop policy if exists cc_select on public.client_contacts;
create policy cc_select on public.client_contacts for select
  using ( auth_is_super_admin() or auth_has_permission('clients.view') );
drop policy if exists cc_write on public.client_contacts;
create policy cc_write on public.client_contacts for all
  using ( auth_is_super_admin() or auth_has_permission('clients.edit') )
  with check ( auth_is_super_admin() or auth_has_permission('clients.edit') );

-- notifications : chacun les siennes
drop policy if exists notif_self on public.notifications;
create policy notif_self on public.notifications for select using ( user_id = auth.uid() );
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update
  using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );


-- ============================================================
-- >>> migrations/0002_commercial.sql
-- ============================================================
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


-- ============================================================
-- >>> migrations/0003_storage.sql
-- ============================================================
-- ISOPoz — Migration 0003 : buckets Storage (documents clients & RH)
-- Exécuter après 0002. Les buckets sont PRIVÉS : aucun accès anon/authenticated.
-- Tout accès passe par des URL signées générées côté serveur (service_role)
-- APRÈS contrôle de permission applicatif. Voir docs/05.

insert into storage.buckets (id, name, public)
values ('client-docs', 'client-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('hr-docs', 'hr-docs', false)
on conflict (id) do nothing;

-- Aucune policy permissive sur storage.objects pour ces buckets :
-- RLS étant activée par défaut, seuls les appels service_role (serveur) y accèdent.
-- Les téléchargements se font via createSignedUrl (route /api/documents/[id]/download).


-- ============================================================
-- >>> migrations/0004_operations.sql
-- ============================================================
-- ISOPoz — Migration 0004 : opérations (chantiers, planning, équipes, salariés, matériel)
-- Exécuter après 0003. Idempotent autant que possible.

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type project_status as enum
    ('a_planifier','planifie','en_preparation','en_cours','suspendu','termine','a_facturer','facture','cloture','annule');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workday_status as enum
    ('planifiee','realisee','a_valider','validee','comptabilisee');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Salariés
-- ============================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  type text not null default 'cdi' check (type in ('cdi','cdd','ephemere')),
  daily_rate_cents bigint,            -- pour les éphémères
  status text not null default 'active' check (status in ('active','inactive')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated before update on public.employees
  for each row execute function public.set_updated_at();
create index if not exists idx_employees_type on public.employees(type);

-- Lien users.employee_id (renseigné en 0001 sans FK) -> FK maintenant
alter table public.users drop constraint if exists users_employee_fk;
alter table public.users
  add constraint users_employee_fk foreign key (employee_id)
  references public.employees(id) on delete set null;

-- documents.employee_id -> FK maintenant (RH)
alter table public.documents drop constraint if exists documents_employee_fk;
alter table public.documents
  add constraint documents_employee_fk foreign key (employee_id)
  references public.employees(id) on delete cascade;

-- ============================================================
-- Équipes
-- ============================================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_lead_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  primary key (team_id, employee_id)
);

-- ============================================================
-- Matériel
-- ============================================================
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reference text,
  category text,
  quantity integer not null default 1,
  condition text,
  location text,
  purchase_date date,
  value_cents bigint,
  status text not null default 'available' check (status in ('available','maintenance','retired')),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_equipment_updated on public.equipment;
create trigger trg_equipment_updated before update on public.equipment
  for each row execute function public.set_updated_at();

-- ============================================================
-- Chantiers
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,   -- règle 5 : réf. devis conservée
  address text,
  start_date date,
  end_date_planned date,
  end_date_actual date,
  manager_id uuid references public.users(id) on delete set null,
  team_lead_id uuid references public.employees(id) on delete set null,
  status project_status not null default 'a_planifier',
  description text,
  notes text,
  quote_total_cents bigint not null default 0,   -- figé à la création
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create index if not exists idx_projects_client on public.projects(client_id);
create index if not exists idx_projects_status on public.projects(status);

-- FK quotes.project_id -> projects (ajout différé depuis 0002)
alter table public.quotes drop constraint if exists quotes_project_fk;
alter table public.quotes
  add constraint quotes_project_fk foreign key (project_id)
  references public.projects(id) on delete set null;

create table if not exists public.project_employees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_on_site text,
  created_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create table if not exists public.project_equipment (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  qty integer not null default 1,
  reserved_from date,
  reserved_to date,
  status text not null default 'reserved' check (status in ('reserved','returned','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists idx_project_equipment_eq on public.project_equipment(equipment_id);

create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null default 'other' check (category in ('labor','equipment','goods','transport','other')),
  label text not null,
  amount_cents bigint not null default 0,
  incurred_at date not null default current_date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_project_costs_project on public.project_costs(project_id);

create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  at timestamptz not null default now(),
  type text not null,
  message text not null,
  user_id uuid references public.users(id) on delete set null
);
create index if not exists idx_project_events_project on public.project_events(project_id, at desc);

-- ============================================================
-- Planning
-- ============================================================
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_schedules_date on public.schedules(date);

create table if not exists public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (employee_id is not null or equipment_id is not null)
);
create index if not exists idx_sched_assign_emp on public.schedule_assignments(employee_id);

-- ============================================================
-- Journées éphémères
-- ============================================================
create table if not exists public.ephemeral_workdays (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  date date not null,
  fraction numeric(3,1) not null default 1.0 check (fraction in (0.5, 1.0)),
  status workday_status not null default 'planifiee',
  validated_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_workdays_updated on public.ephemeral_workdays;
create trigger trg_workdays_updated before update on public.ephemeral_workdays
  for each row execute function public.set_updated_at();
create index if not exists idx_workdays_emp on public.ephemeral_workdays(employee_id, date);

-- ============================================================
-- Demandes salarié (repos / matériel)
-- ============================================================
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null default 'repos' check (kind in ('repos','absence')),
  date_from date not null,
  date_to date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','accepted','refused')),
  decided_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  label text not null,
  qty integer not null default 1,
  status text not null default 'pending' check (status in ('pending','accepted','refused')),
  decided_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Détection de conflits de planning (salarié sur créneaux chevauchants)
-- ============================================================
create or replace function public.schedule_conflicts(p_employee_id uuid, p_date date, p_start time, p_end time, p_exclude_schedule uuid default null)
returns table (schedule_id uuid, project_reference text, start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select s.id, p.reference, s.start_time, s.end_time
  from public.schedule_assignments sa
  join public.schedules s on s.id = sa.schedule_id
  join public.projects p on p.id = s.project_id
  where sa.employee_id = p_employee_id
    and s.date = p_date
    and (p_exclude_schedule is null or s.id <> p_exclude_schedule)
    and s.start_time < p_end
    and s.end_time > p_start;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.employees            enable row level security;
alter table public.teams                enable row level security;
alter table public.team_members         enable row level security;
alter table public.equipment            enable row level security;
alter table public.projects             enable row level security;
alter table public.project_employees    enable row level security;
alter table public.project_equipment    enable row level security;
alter table public.project_costs        enable row level security;
alter table public.project_events       enable row level security;
alter table public.schedules            enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.ephemeral_workdays   enable row level security;
alter table public.leave_requests       enable row level security;
alter table public.material_requests    enable row level security;

-- Helper macro-pattern : select via perm.view, write via perm.create/edit
-- (chaque table déclare ses policies explicitement pour rester lisible)

-- employees
drop policy if exists emp_sel on public.employees;
create policy emp_sel on public.employees for select using ( auth_is_super_admin() or auth_has_permission('employees.view') or auth_has_permission('ephemeral.view') );
drop policy if exists emp_ins on public.employees;
create policy emp_ins on public.employees for insert with check ( auth_is_super_admin() or auth_has_permission('employees.create') or auth_has_permission('ephemeral.create') );
drop policy if exists emp_upd on public.employees;
create policy emp_upd on public.employees for update using ( auth_is_super_admin() or auth_has_permission('employees.edit') or auth_has_permission('ephemeral.edit') ) with check ( auth_is_super_admin() or auth_has_permission('employees.edit') or auth_has_permission('ephemeral.edit') );
drop policy if exists emp_del on public.employees;
create policy emp_del on public.employees for delete using ( auth_is_super_admin() or auth_has_permission('employees.delete') );

-- teams / team_members
drop policy if exists team_sel on public.teams;
create policy team_sel on public.teams for select using ( auth_is_super_admin() or auth_has_permission('teams.view') );
drop policy if exists team_wr on public.teams;
create policy team_wr on public.teams for all using ( auth_is_super_admin() or auth_has_permission('teams.create') or auth_has_permission('teams.edit') ) with check ( auth_is_super_admin() or auth_has_permission('teams.create') or auth_has_permission('teams.edit') );
drop policy if exists tm_sel on public.team_members;
create policy tm_sel on public.team_members for select using ( auth_is_super_admin() or auth_has_permission('teams.view') );
drop policy if exists tm_wr on public.team_members;
create policy tm_wr on public.team_members for all using ( auth_is_super_admin() or auth_has_permission('teams.edit') or auth_has_permission('teams.create') ) with check ( auth_is_super_admin() or auth_has_permission('teams.edit') or auth_has_permission('teams.create') );

-- equipment
drop policy if exists eq_sel on public.equipment;
create policy eq_sel on public.equipment for select using ( auth_is_super_admin() or auth_has_permission('equipment.view') );
drop policy if exists eq_ins on public.equipment;
create policy eq_ins on public.equipment for insert with check ( auth_is_super_admin() or auth_has_permission('equipment.create') );
drop policy if exists eq_upd on public.equipment;
create policy eq_upd on public.equipment for update using ( auth_is_super_admin() or auth_has_permission('equipment.edit') ) with check ( auth_is_super_admin() or auth_has_permission('equipment.edit') );
drop policy if exists eq_del on public.equipment;
create policy eq_del on public.equipment for delete using ( auth_is_super_admin() or auth_has_permission('equipment.delete') );

-- projects + sous-tables
drop policy if exists proj_sel on public.projects;
create policy proj_sel on public.projects for select using ( auth_is_super_admin() or auth_has_permission('projects.view') );
drop policy if exists proj_ins on public.projects;
create policy proj_ins on public.projects for insert with check ( auth_is_super_admin() or auth_has_permission('projects.create') );
drop policy if exists proj_upd on public.projects;
create policy proj_upd on public.projects for update using ( auth_is_super_admin() or auth_has_permission('projects.edit') ) with check ( auth_is_super_admin() or auth_has_permission('projects.edit') );
drop policy if exists proj_del on public.projects;
create policy proj_del on public.projects for delete using ( auth_is_super_admin() or auth_has_permission('projects.delete') );

do $$
declare t text;
begin
  foreach t in array array['project_employees','project_equipment','project_costs','project_events'] loop
    execute format('drop policy if exists %I_sel on public.%I;', t, t);
    execute format('create policy %I_sel on public.%I for select using ( auth_is_super_admin() or auth_has_permission(''projects.view'') );', t, t);
    execute format('drop policy if exists %I_wr on public.%I;', t, t);
    execute format('create policy %I_wr on public.%I for all using ( auth_is_super_admin() or auth_has_permission(''projects.edit'') ) with check ( auth_is_super_admin() or auth_has_permission(''projects.edit'') );', t, t);
  end loop;
end $$;

-- planning
drop policy if exists sch_sel on public.schedules;
create policy sch_sel on public.schedules for select using ( auth_is_super_admin() or auth_has_permission('planning.view') );
drop policy if exists sch_wr on public.schedules;
create policy sch_wr on public.schedules for all using ( auth_is_super_admin() or auth_has_permission('planning.create') or auth_has_permission('planning.edit') ) with check ( auth_is_super_admin() or auth_has_permission('planning.create') or auth_has_permission('planning.edit') );
drop policy if exists sa_sel on public.schedule_assignments;
create policy sa_sel on public.schedule_assignments for select using ( auth_is_super_admin() or auth_has_permission('planning.view') );
drop policy if exists sa_wr on public.schedule_assignments;
create policy sa_wr on public.schedule_assignments for all using ( auth_is_super_admin() or auth_has_permission('planning.create') or auth_has_permission('planning.edit') ) with check ( auth_is_super_admin() or auth_has_permission('planning.create') or auth_has_permission('planning.edit') );

-- éphémères
drop policy if exists wd_sel on public.ephemeral_workdays;
create policy wd_sel on public.ephemeral_workdays for select using ( auth_is_super_admin() or auth_has_permission('ephemeral.view') );
drop policy if exists wd_wr on public.ephemeral_workdays;
create policy wd_wr on public.ephemeral_workdays for all using ( auth_is_super_admin() or auth_has_permission('ephemeral.create') or auth_has_permission('ephemeral.edit') or auth_has_permission('ephemeral.validate') ) with check ( auth_is_super_admin() or auth_has_permission('ephemeral.create') or auth_has_permission('ephemeral.edit') or auth_has_permission('ephemeral.validate') );

-- demandes salarié : lecture/écriture côté gestionnaire (employees.*) ; le portail salarié viendra ensuite
drop policy if exists lr_sel on public.leave_requests;
create policy lr_sel on public.leave_requests for select using ( auth_is_super_admin() or auth_has_permission('employees.view') );
drop policy if exists lr_wr on public.leave_requests;
create policy lr_wr on public.leave_requests for all using ( auth_is_super_admin() or auth_has_permission('employees.edit') ) with check ( auth_is_super_admin() or auth_has_permission('employees.edit') );
drop policy if exists mr_sel on public.material_requests;
create policy mr_sel on public.material_requests for select using ( auth_is_super_admin() or auth_has_permission('employees.view') );
drop policy if exists mr_wr on public.material_requests;
create policy mr_wr on public.material_requests for all using ( auth_is_super_admin() or auth_has_permission('employees.edit') ) with check ( auth_is_super_admin() or auth_has_permission('employees.edit') );


-- ============================================================
-- >>> migrations/0005_finance.sql
-- ============================================================
-- ISOPoz — Migration 0005 : finance (factures, paiements, relances)
-- Exécuter après 0004. Idempotent autant que possible.

-- ============================================================
-- Enum
-- ============================================================
do $$ begin
  create type invoice_status as enum
    ('brouillon','envoyee','en_attente','partiellement_payee','payee','en_retard','annulee');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Factures
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,      -- règle 6
  project_id uuid references public.projects(id) on delete set null,  -- règle 6
  issue_date date not null default current_date,
  due_date date,
  status invoice_status not null default 'brouillon',
  payment_terms text,
  notes text,
  subtotal_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_invoices_updated on public.invoices;
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();
create index if not exists idx_invoices_client on public.invoices(client_id);
create index if not exists idx_invoices_status on public.invoices(status);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  label text not null,
  description text,
  qty numeric(12,2) not null default 1,
  unit_price_cents bigint not null default 0,
  vat_bps integer not null default 2000,
  line_total_cents bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoice_items_inv on public.invoice_items(invoice_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  paid_at date not null default current_date,
  amount_cents bigint not null,
  method text,
  reference text,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  level integer not null default 1,
  sent_at timestamptz not null default now(),
  template_id uuid references public.document_templates(id) on delete set null,
  channel text default 'email',
  note text,
  created_by uuid references public.users(id) on delete set null
);
create index if not exists idx_reminders_invoice on public.reminders(invoice_id);

-- ============================================================
-- Recalcul serveur des totaux d'une facture
-- ============================================================
create or replace function public.recompute_invoice_totals(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_subtotal bigint; v_vat bigint;
begin
  update public.invoice_items ii
    set line_total_cents = round(ii.qty * ii.unit_price_cents)
    where ii.invoice_id = p_invoice_id;
  select coalesce(sum(line_total_cents),0), coalesce(sum(round(line_total_cents * vat_bps / 10000.0)),0)
    into v_subtotal, v_vat
  from public.invoice_items where invoice_id = p_invoice_id;
  update public.invoices
    set subtotal_cents = v_subtotal, vat_cents = v_vat, total_cents = v_subtotal + v_vat
    where id = p_invoice_id;
end; $$;

-- Recalcule le statut d'une facture selon les paiements (hors brouillon/annulée).
create or replace function public.refresh_invoice_status(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total bigint; v_paid bigint; v_status invoice_status;
begin
  select total_cents, status into v_total, v_status from public.invoices where id = p_invoice_id;
  if v_status in ('brouillon','annulee') then return; end if;
  select coalesce(sum(amount_cents),0) into v_paid from public.payments where invoice_id = p_invoice_id;
  if v_paid >= v_total and v_total > 0 then
    update public.invoices set status = 'payee' where id = p_invoice_id;
  elsif v_paid > 0 then
    update public.invoices set status = 'partiellement_payee' where id = p_invoice_id;
  else
    update public.invoices set status = 'en_attente' where id = p_invoice_id;
  end if;
end; $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments      enable row level security;
alter table public.reminders     enable row level security;

drop policy if exists inv_sel on public.invoices;
create policy inv_sel on public.invoices for select using ( auth_is_super_admin() or auth_has_permission('invoices.view') );
drop policy if exists inv_ins on public.invoices;
create policy inv_ins on public.invoices for insert with check ( auth_is_super_admin() or auth_has_permission('invoices.create') );
drop policy if exists inv_upd on public.invoices;
create policy inv_upd on public.invoices for update using ( auth_is_super_admin() or auth_has_permission('invoices.edit') or auth_has_permission('invoices.send') or auth_has_permission('invoices.mark_paid') ) with check ( auth_is_super_admin() or auth_has_permission('invoices.edit') or auth_has_permission('invoices.send') or auth_has_permission('invoices.mark_paid') );
drop policy if exists inv_del on public.invoices;
create policy inv_del on public.invoices for delete using ( auth_is_super_admin() or auth_has_permission('invoices.delete') );

drop policy if exists ii_sel on public.invoice_items;
create policy ii_sel on public.invoice_items for select using ( auth_is_super_admin() or auth_has_permission('invoices.view') );
drop policy if exists ii_wr on public.invoice_items;
create policy ii_wr on public.invoice_items for all using ( auth_is_super_admin() or auth_has_permission('invoices.create') or auth_has_permission('invoices.edit') ) with check ( auth_is_super_admin() or auth_has_permission('invoices.create') or auth_has_permission('invoices.edit') );

drop policy if exists pay_sel on public.payments;
create policy pay_sel on public.payments for select using ( auth_is_super_admin() or auth_has_permission('payments.view') or auth_has_permission('invoices.view') );
drop policy if exists pay_wr on public.payments;
create policy pay_wr on public.payments for all using ( auth_is_super_admin() or auth_has_permission('payments.create') or auth_has_permission('payments.edit') ) with check ( auth_is_super_admin() or auth_has_permission('payments.create') or auth_has_permission('payments.edit') );

drop policy if exists rem_sel on public.reminders;
create policy rem_sel on public.reminders for select using ( auth_is_super_admin() or auth_has_permission('reminders.view') or auth_has_permission('invoices.view') );
drop policy if exists rem_wr on public.reminders;
create policy rem_wr on public.reminders for all using ( auth_is_super_admin() or auth_has_permission('reminders.create') or auth_has_permission('reminders.send') ) with check ( auth_is_super_admin() or auth_has_permission('reminders.create') or auth_has_permission('reminders.send') );


-- ============================================================
-- >>> migrations/0006_purchasing.sql
-- ============================================================
-- ISOPoz — Migration 0006 : achats (fournisseurs, produits, commandes, négociations)
-- Exécuter après 0005. Idempotent autant que possible.

-- ============================================================
-- Enum
-- ============================================================
do $$ begin
  create type po_status as enum ('brouillon','envoyee','negociation','recue','annulee');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Fournisseurs
-- ============================================================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  email text,
  phone text,
  address text,
  siret text,
  vat_number text,
  payment_terms text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_suppliers_updated on public.suppliers;
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();
create index if not exists idx_suppliers_name on public.suppliers(name);

-- ============================================================
-- Produits / marchandises
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  reference text,
  unit text default 'u',
  last_price_cents bigint,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- Commandes fournisseur
-- ============================================================
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  status po_status not null default 'brouillon',
  initial_total_cents bigint not null default 0,   -- somme des lignes (avant négo)
  negotiated_total_cents bigint,                    -- prix final négocié (si accord)
  notes text,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_po_updated on public.purchase_orders;
create trigger trg_po_updated before update on public.purchase_orders
  for each row execute function public.set_updated_at();
create index if not exists idx_po_supplier on public.purchase_orders(supplier_id);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  position integer not null default 0,
  product_id uuid references public.products(id) on delete set null,
  label text not null,
  qty numeric(12,2) not null default 1,
  unit_price_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_po_items_po on public.purchase_order_items(po_id);

-- Historique de négociation (CDC §27)
create table if not exists public.negotiations (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  at date not null default current_date,
  party text not null default 'isopoz' check (party in ('supplier','isopoz')),
  amount_cents bigint not null,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_negotiations_po on public.negotiations(po_id);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  received_at date not null default current_date,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Recalcul du total initial d'une commande
-- ============================================================
create or replace function public.recompute_po_totals(p_po_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total bigint;
begin
  update public.purchase_order_items pi
    set line_total_cents = round(pi.qty * pi.unit_price_cents)
    where pi.po_id = p_po_id;
  select coalesce(sum(line_total_cents),0) into v_total
    from public.purchase_order_items where po_id = p_po_id;
  update public.purchase_orders set initial_total_cents = v_total where id = p_po_id;
end; $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.suppliers            enable row level security;
alter table public.products             enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.negotiations         enable row level security;
alter table public.goods_receipts       enable row level security;

-- suppliers
drop policy if exists sup_sel on public.suppliers;
create policy sup_sel on public.suppliers for select using ( auth_is_super_admin() or auth_has_permission('suppliers.view') );
drop policy if exists sup_ins on public.suppliers;
create policy sup_ins on public.suppliers for insert with check ( auth_is_super_admin() or auth_has_permission('suppliers.create') );
drop policy if exists sup_upd on public.suppliers;
create policy sup_upd on public.suppliers for update using ( auth_is_super_admin() or auth_has_permission('suppliers.edit') ) with check ( auth_is_super_admin() or auth_has_permission('suppliers.edit') );
drop policy if exists sup_del on public.suppliers;
create policy sup_del on public.suppliers for delete using ( auth_is_super_admin() or auth_has_permission('suppliers.delete') );

-- products : lecture suppliers.view, écriture suppliers.edit/create
drop policy if exists prod_sel on public.products;
create policy prod_sel on public.products for select using ( auth_is_super_admin() or auth_has_permission('suppliers.view') or auth_has_permission('orders.view') );
drop policy if exists prod_wr on public.products;
create policy prod_wr on public.products for all using ( auth_is_super_admin() or auth_has_permission('suppliers.edit') or auth_has_permission('suppliers.create') ) with check ( auth_is_super_admin() or auth_has_permission('suppliers.edit') or auth_has_permission('suppliers.create') );

-- purchase_orders
drop policy if exists po_sel on public.purchase_orders;
create policy po_sel on public.purchase_orders for select using ( auth_is_super_admin() or auth_has_permission('orders.view') );
drop policy if exists po_ins on public.purchase_orders;
create policy po_ins on public.purchase_orders for insert with check ( auth_is_super_admin() or auth_has_permission('orders.create') );
drop policy if exists po_upd on public.purchase_orders;
create policy po_upd on public.purchase_orders for update using ( auth_is_super_admin() or auth_has_permission('orders.edit') ) with check ( auth_is_super_admin() or auth_has_permission('orders.edit') );
drop policy if exists po_del on public.purchase_orders;
create policy po_del on public.purchase_orders for delete using ( auth_is_super_admin() or auth_has_permission('orders.delete') );

drop policy if exists poi_sel on public.purchase_order_items;
create policy poi_sel on public.purchase_order_items for select using ( auth_is_super_admin() or auth_has_permission('orders.view') );
drop policy if exists poi_wr on public.purchase_order_items;
create policy poi_wr on public.purchase_order_items for all using ( auth_is_super_admin() or auth_has_permission('orders.create') or auth_has_permission('orders.edit') ) with check ( auth_is_super_admin() or auth_has_permission('orders.create') or auth_has_permission('orders.edit') );

-- negotiations
drop policy if exists nego_sel on public.negotiations;
create policy nego_sel on public.negotiations for select using ( auth_is_super_admin() or auth_has_permission('negotiations.view') or auth_has_permission('orders.view') );
drop policy if exists nego_wr on public.negotiations;
create policy nego_wr on public.negotiations for all using ( auth_is_super_admin() or auth_has_permission('negotiations.create') or auth_has_permission('negotiations.edit') ) with check ( auth_is_super_admin() or auth_has_permission('negotiations.create') or auth_has_permission('negotiations.edit') );

-- goods_receipts
drop policy if exists gr_sel on public.goods_receipts;
create policy gr_sel on public.goods_receipts for select using ( auth_is_super_admin() or auth_has_permission('orders.view') );
drop policy if exists gr_wr on public.goods_receipts;
create policy gr_wr on public.goods_receipts for all using ( auth_is_super_admin() or auth_has_permission('orders.edit') ) with check ( auth_is_super_admin() or auth_has_permission('orders.edit') );


-- ============================================================
-- >>> migrations/0007_notifications.sql
-- ============================================================
-- ISOPoz — Migration 0007 : ciblage des notifications
-- Exécuter après 0006. Idempotent.

-- Renvoie les user_id ayant une permission effective donnée
-- (super admin OU via rôles, moins les refus, plus les grants individuels).
create or replace function public.users_with_permission(perm text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.users where is_super_admin = true and status = 'active'
  union
  select ur.user_id
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  join public.users u on u.id = ur.user_id
  where p.key = perm and u.status = 'active'
    and not exists (
      select 1 from public.user_permissions up
      join public.permissions p2 on p2.id = up.permission_id
      where up.user_id = ur.user_id and p2.key = perm and up.granted = false
    )
  union
  select up.user_id
  from public.user_permissions up
  join public.permissions p on p.id = up.permission_id
  join public.users u on u.id = up.user_id
  where p.key = perm and up.granted = true and u.status = 'active';
$$;


-- ============================================================
-- >>> migrations/0008_hr.sql
-- ============================================================
-- ISOPoz — Migration 0008 : RH (fiches de paie, documents RH) + portail salarié
-- Exécuter après 0007. Idempotent.

-- Employee lié au compte courant
create or replace function public.auth_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from public.users where id = auth.uid();
$$;

-- ============================================================
-- Fiches de paie
-- ============================================================
create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  label text,
  net_cents bigint,
  storage_path text,          -- bucket privé hr-docs
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payslips_emp on public.payslips(employee_id, year, month);

-- Documents RH (contrats, absences, administratif)
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  year integer not null,
  doc_type text not null,
  name text not null,
  storage_path text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_empdocs_emp on public.employee_documents(employee_id, year, doc_type);

-- ============================================================
-- RLS — cloisonnement strict RH (CDC §29)
-- ============================================================
alter table public.payslips           enable row level security;
alter table public.employee_documents enable row level security;

-- Un salarié voit UNIQUEMENT ses propres fiches ; sinon hr.manage.
drop policy if exists payslips_sel on public.payslips;
create policy payslips_sel on public.payslips for select
  using ( auth_is_super_admin() or auth_has_permission('hr.manage') or employee_id = auth_employee_id() );
drop policy if exists payslips_wr on public.payslips;
create policy payslips_wr on public.payslips for all
  using ( auth_is_super_admin() or auth_has_permission('hr.manage') )
  with check ( auth_is_super_admin() or auth_has_permission('hr.manage') );

drop policy if exists empdocs_sel on public.employee_documents;
create policy empdocs_sel on public.employee_documents for select
  using ( auth_is_super_admin() or auth_has_permission('hr.manage') or employee_id = auth_employee_id() );
drop policy if exists empdocs_wr on public.employee_documents;
create policy empdocs_wr on public.employee_documents for all
  using ( auth_is_super_admin() or auth_has_permission('hr.manage') )
  with check ( auth_is_super_admin() or auth_has_permission('hr.manage') );

-- ============================================================
-- Portail salarié : lecture/écriture de SES propres demandes
-- (s'ajoute aux policies gestionnaire de 0004)
-- ============================================================
drop policy if exists lr_self_sel on public.leave_requests;
create policy lr_self_sel on public.leave_requests for select using ( employee_id = auth_employee_id() );
drop policy if exists lr_self_ins on public.leave_requests;
create policy lr_self_ins on public.leave_requests for insert with check ( employee_id = auth_employee_id() and status = 'pending' );

drop policy if exists mr_self_sel on public.material_requests;
create policy mr_self_sel on public.material_requests for select using ( employee_id = auth_employee_id() );
drop policy if exists mr_self_ins on public.material_requests;
create policy mr_self_ins on public.material_requests for insert with check ( employee_id = auth_employee_id() and status = 'pending' );

-- Le salarié voit ses propres affectations de planning + ses journées éphémères
drop policy if exists sa_self_sel on public.schedule_assignments;
create policy sa_self_sel on public.schedule_assignments for select using ( employee_id = auth_employee_id() );
drop policy if exists sch_self_sel on public.schedules;
create policy sch_self_sel on public.schedules for select using (
  exists (select 1 from public.schedule_assignments sa where sa.schedule_id = schedules.id and sa.employee_id = auth_employee_id())
);
drop policy if exists wd_self_sel on public.ephemeral_workdays;
create policy wd_self_sel on public.ephemeral_workdays for select using ( employee_id = auth_employee_id() );


-- ============================================================
-- >>> seed.sql
-- ============================================================
-- ISOPoz — Seed : catalogue de permissions + rôles système
-- Exécuter après 0001_core.sql. Idempotent.

-- ============================================================
-- Catalogue de permissions
-- ============================================================
insert into public.permissions (key, module, label) values
  ('clients.view','clients','Voir les clients'),
  ('clients.create','clients','Créer des clients'),
  ('clients.edit','clients','Modifier des clients'),
  ('clients.delete','clients','Supprimer des clients'),

  ('requests.view','requests','Voir les demandes'),
  ('requests.create','requests','Créer des demandes'),
  ('requests.edit','requests','Modifier des demandes'),
  ('requests.delete','requests','Supprimer des demandes'),
  ('requests.assign','requests','Assigner un gestionnaire'),

  ('quotes.view','quotes','Voir les devis'),
  ('quotes.create','quotes','Créer des devis'),
  ('quotes.edit','quotes','Modifier des devis'),
  ('quotes.delete','quotes','Supprimer des devis'),
  ('quotes.send','quotes','Envoyer des devis'),
  ('quotes.validate','quotes','Valider des devis'),

  ('projects.view','projects','Voir les chantiers'),
  ('projects.create','projects','Créer des chantiers'),
  ('projects.edit','projects','Modifier des chantiers'),
  ('projects.delete','projects','Supprimer des chantiers'),

  ('planning.view','planning','Voir le planning'),
  ('planning.create','planning','Créer des créneaux'),
  ('planning.edit','planning','Modifier le planning'),
  ('planning.delete','planning','Supprimer des créneaux'),

  ('teams.view','teams','Voir les équipes'),
  ('teams.create','teams','Créer des équipes'),
  ('teams.edit','teams','Modifier des équipes'),
  ('teams.delete','teams','Supprimer des équipes'),

  ('employees.view','employees','Voir les salariés'),
  ('employees.create','employees','Créer des salariés'),
  ('employees.edit','employees','Modifier des salariés'),
  ('employees.delete','employees','Supprimer des salariés'),

  ('ephemeral.view','ephemeral','Voir les journées éphémères'),
  ('ephemeral.create','ephemeral','Planifier des journées éphémères'),
  ('ephemeral.edit','ephemeral','Modifier des journées éphémères'),
  ('ephemeral.validate','ephemeral','Valider des journées éphémères'),

  ('equipment.view','equipment','Voir le matériel'),
  ('equipment.create','equipment','Créer du matériel'),
  ('equipment.edit','equipment','Modifier du matériel'),
  ('equipment.delete','equipment','Supprimer du matériel'),

  ('invoices.view','invoices','Voir les factures'),
  ('invoices.create','invoices','Créer des factures'),
  ('invoices.edit','invoices','Modifier des factures'),
  ('invoices.delete','invoices','Supprimer des factures'),
  ('invoices.send','invoices','Envoyer des factures'),
  ('invoices.mark_paid','invoices','Marquer payé'),

  ('payments.view','payments','Voir les paiements'),
  ('payments.create','payments','Enregistrer des paiements'),
  ('payments.edit','payments','Modifier des paiements'),
  ('payments.delete','payments','Supprimer des paiements'),

  ('reminders.view','reminders','Voir les relances'),
  ('reminders.create','reminders','Créer des relances'),
  ('reminders.send','reminders','Envoyer des relances'),

  ('suppliers.view','suppliers','Voir les fournisseurs'),
  ('suppliers.create','suppliers','Créer des fournisseurs'),
  ('suppliers.edit','suppliers','Modifier des fournisseurs'),
  ('suppliers.delete','suppliers','Supprimer des fournisseurs'),

  ('orders.view','orders','Voir les commandes'),
  ('orders.create','orders','Créer des commandes'),
  ('orders.edit','orders','Modifier des commandes'),
  ('orders.delete','orders','Supprimer des commandes'),

  ('negotiations.view','negotiations','Voir les négociations'),
  ('negotiations.create','negotiations','Créer des négociations'),
  ('negotiations.edit','negotiations','Modifier des négociations'),

  ('documents.view','documents','Voir les documents'),
  ('documents.upload','documents','Téléverser des documents'),
  ('documents.edit','documents','Modifier des documents'),
  ('documents.delete','documents','Supprimer des documents'),
  ('documents.download','documents','Télécharger des documents'),

  ('templates.view','templates','Voir les modèles'),
  ('templates.create','templates','Créer des modèles'),
  ('templates.edit','templates','Modifier des modèles'),
  ('templates.delete','templates','Supprimer des modèles'),

  ('hr.view','hr','Voir les documents RH'),
  ('hr.manage','hr','Gérer les documents RH'),

  ('analytics.view','analytics','Voir les analyses'),

  ('admin.users','admin','Gérer les utilisateurs'),
  ('admin.roles','admin','Gérer les rôles'),
  ('admin.permissions','admin','Gérer les permissions'),
  ('admin.settings','admin','Gérer les paramètres'),
  ('admin.audit','admin','Consulter le journal d''activité'),

  ('portal.self','portal','Accès portail salarié')
on conflict (key) do update set module = excluded.module, label = excluded.label;

-- ============================================================
-- Rôles système
-- ============================================================
insert into public.roles (name, description, is_system) values
  ('super_admin','Accès total (bypass des permissions)', true),
  ('gestionnaire','Rôle opérationnel principal', true),
  ('salarie','Salarié CDI/CDD — portail personnel', true),
  ('ephemere','Salarié éphémère', true)
on conflict (name) do nothing;

-- Gestionnaire : tout le périmètre opérationnel (sans admin.* ni hr.manage)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'gestionnaire'
  and p.module in ('clients','requests','quotes','projects','planning','teams',
                   'employees','ephemeral','equipment','invoices','payments',
                   'reminders','suppliers','orders','negotiations','documents',
                   'templates','analytics')
on conflict do nothing;

-- Salarié : portail perso
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'salarie' and p.key = 'portal.self'
on conflict do nothing;

-- ============================================================
-- Promotion du super admin (à exécuter une fois le compte créé via Supabase Auth)
-- Remplacer l'email puis exécuter :
-- ============================================================
-- update public.users set is_super_admin = true where email = 'admin@isopoz.fr';
-- insert into public.user_roles (user_id, role_id)
--   select u.id, r.id from public.users u, public.roles r
--   where u.email = 'admin@isopoz.fr' and r.name = 'super_admin'
--   on conflict do nothing;

