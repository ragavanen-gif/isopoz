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
