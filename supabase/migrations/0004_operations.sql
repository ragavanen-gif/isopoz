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
