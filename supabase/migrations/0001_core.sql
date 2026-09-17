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
