-- ISOPoz — Migration 0009 : site vitrine public + simulateur configurable
-- Exécuter après 0008. Idempotent. Gestion réservée à admin.settings.

-- ============================================================
-- Paramètres du site (singleton) — textes éditables depuis l'admin
-- ============================================================
create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'ISOPoz',
  tagline text not null default 'Votre spécialiste de l''isolation et de la pose',
  hero_title text not null default 'Isolation & rénovation, faites confiance à des experts',
  hero_subtitle text not null default 'Devis gratuit, intervention rapide, travaux garantis.',
  about_title text not null default 'À propos d''ISOPoz',
  about_text text not null default 'Entreprise spécialisée dans l''isolation thermique et la pose, nous accompagnons particuliers et professionnels avec un savoir-faire reconnu.',
  phone text default '',
  email text default 'contact@isopoz.fr',
  address text default '',
  cta_text text not null default 'Demandez votre devis gratuit',
  simulator_enabled boolean not null default true,
  simulator_title text not null default 'Estimez votre projet en 1 minute',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true) on conflict (id) do nothing;
drop trigger if exists trg_site_settings_updated on public.site_settings;
create trigger trg_site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- Avis clients
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  rating smallint not null default 5 check (rating between 1 and 5),
  content text not null,
  published boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Réalisations (portfolio)
-- ============================================================
create table if not exists public.realisations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  image_path text,            -- bucket public site-media
  published boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Simulateur : services configurables
-- ============================================================
create table if not exists public.simulator_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  unit_label text not null default 'm²',
  unit_price_cents bigint not null default 0,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Leads (contact + simulateur)
-- ============================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'contact' check (source in ('contact','simulator')),
  name text,
  email text,
  phone text,
  message text,
  simulator_data jsonb,
  estimate_cents bigint,
  status text not null default 'new' check (status in ('new','handled','archived')),
  created_at timestamptz not null default now()
);
create index if not exists idx_leads_status on public.leads(status, created_at desc);

-- ============================================================
-- Bucket public pour les images du site
-- ============================================================
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

-- Lecture publique du bucket site-media ; écriture via service_role (serveur)
drop policy if exists site_media_read on storage.objects;
create policy site_media_read on storage.objects for select
  using ( bucket_id = 'site-media' );

-- ============================================================
-- RLS : lecture publique du contenu publié, écriture admin.settings
-- ============================================================
alter table public.site_settings      enable row level security;
alter table public.reviews            enable row level security;
alter table public.realisations       enable row level security;
alter table public.simulator_services enable row level security;
alter table public.leads              enable row level security;

drop policy if exists site_read on public.site_settings;
create policy site_read on public.site_settings for select using ( true );
drop policy if exists site_write on public.site_settings;
create policy site_write on public.site_settings for all
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.settings') );

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using ( published = true or auth_is_super_admin() or auth_has_permission('admin.settings') );
drop policy if exists reviews_write on public.reviews;
create policy reviews_write on public.reviews for all
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.settings') );

drop policy if exists real_read on public.realisations;
create policy real_read on public.realisations for select using ( published = true or auth_is_super_admin() or auth_has_permission('admin.settings') );
drop policy if exists real_write on public.realisations;
create policy real_write on public.realisations for all
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.settings') );

drop policy if exists sim_read on public.simulator_services;
create policy sim_read on public.simulator_services for select using ( active = true or auth_is_super_admin() or auth_has_permission('admin.settings') );
drop policy if exists sim_write on public.simulator_services;
create policy sim_write on public.simulator_services for all
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.settings') );

-- leads : lecture admin.settings ; insertion via service_role (server action)
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') );
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update
  using ( auth_is_super_admin() or auth_has_permission('admin.settings') )
  with check ( auth_is_super_admin() or auth_has_permission('admin.settings') );

-- ============================================================
-- Données de démonstration (avis + services simulateur)
-- ============================================================
insert into public.simulator_services (name, description, unit_label, unit_price_cents, position) values
  ('Isolation combles perdus', 'Soufflage de laine minérale', 'm²', 2500, 1),
  ('Isolation des murs par l''intérieur', 'Doublage isolant', 'm²', 4500, 2),
  ('Isolation des sols', 'Isolation thermique des planchers', 'm²', 3500, 3)
on conflict do nothing;

insert into public.reviews (author_name, author_role, rating, content, position) values
  ('Marie L.', 'Particulier', 5, 'Travaux impeccables et équipe très professionnelle. Je recommande !', 1),
  ('Thomas B.', 'Gérant', 5, 'Devis clair, délais respectés. Un vrai savoir-faire.', 2)
on conflict do nothing;
