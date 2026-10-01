-- ISOPoz — Migration 0010 : Outils → Chiffrage (métré calorifuge)
-- Exécuter après 0009. Idempotent.

-- ============================================================
-- Permissions
-- ============================================================
insert into public.permissions (key, module, label) values
  ('tools.view','tools','Voir les outils de chiffrage'),
  ('tools.manage','tools','Gérer les outils de chiffrage (métré, prestations)')
on conflict (key) do update set module = excluded.module, label = excluded.label;

-- Accordées au rôle gestionnaire
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.name = 'gestionnaire' and p.key in ('tools.view','tools.manage')
on conflict do nothing;

-- ============================================================
-- Bibliothèque de prestations calorifuge (prix personnalisables)
-- ============================================================
create table if not exists public.estimation_prestations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  family text not null default 'hydraulique' check (family in ('hydraulique','aeraulique','autre')),
  network_type text,
  dimension text,            -- DN20, Ø160, 550x300…
  thickness text,            -- épaisseur isolant (25 mm…)
  material text,             -- laine de verre, coquille, mousse…
  insulation_class text,
  finish text,               -- PVC, tôle isoxale…
  unit text not null default 'ml' check (unit in ('ml','m2','u','forfait')),
  price_supply_cents bigint not null default 0,    -- fourniture
  price_install_cents bigint not null default 0,   -- pose
  margin_bps integer not null default 0,           -- marge/coefficient (points de base)
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_est_presta_updated on public.estimation_prestations;
create trigger trg_est_presta_updated before update on public.estimation_prestations
  for each row execute function public.set_updated_at();

-- ============================================================
-- Projets de métré (un plan PDF + mesures)
-- ============================================================
create table if not exists public.estimation_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  plan_path text,            -- bucket privé 'plans'
  plan_filename text,
  scale_factor double precision,  -- mètres réels par unité PDF de base (null = non calibré)
  measurements jsonb not null default '[]'::jsonb,  -- mesures/recherches/affectations
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_est_proj_updated on public.estimation_projects;
create trigger trg_est_proj_updated before update on public.estimation_projects
  for each row execute function public.set_updated_at();
create index if not exists idx_est_proj_created on public.estimation_projects(created_at desc);

-- ============================================================
-- Bucket privé pour les plans PDF
-- ============================================================
insert into storage.buckets (id, name, public)
values ('plans', 'plans', false)
on conflict (id) do nothing;

-- ============================================================
-- RLS
-- ============================================================
alter table public.estimation_prestations enable row level security;
alter table public.estimation_projects    enable row level security;

drop policy if exists est_presta_sel on public.estimation_prestations;
create policy est_presta_sel on public.estimation_prestations for select
  using ( auth_is_super_admin() or auth_has_permission('tools.view') );
drop policy if exists est_presta_wr on public.estimation_prestations;
create policy est_presta_wr on public.estimation_prestations for all
  using ( auth_is_super_admin() or auth_has_permission('tools.manage') )
  with check ( auth_is_super_admin() or auth_has_permission('tools.manage') );

drop policy if exists est_proj_sel on public.estimation_projects;
create policy est_proj_sel on public.estimation_projects for select
  using ( auth_is_super_admin() or auth_has_permission('tools.view') );
drop policy if exists est_proj_wr on public.estimation_projects;
create policy est_proj_wr on public.estimation_projects for all
  using ( auth_is_super_admin() or auth_has_permission('tools.manage') )
  with check ( auth_is_super_admin() or auth_has_permission('tools.manage') );
